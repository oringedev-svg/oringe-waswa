import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requireAdminApi, getSessionProfile, isAdminRole } from '@/lib/auth'
import { userHasPermission } from '@/lib/permissions'
import { canTransition, transitionPermission, type WorkflowStatus } from '@/lib/editorialWorkflow'
import { saveRevision, getRevisions } from '@/lib/revisions'

const REVISIONED_FIELDS = ['title', 'excerpt', 'content', 'cover_image_url', 'category', 'tags'] as const

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const isUUID = /^[0-9a-f-]{36}$/i.test(params.id)
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*, authors:blog_authors(*), comments:blog_comments(*, replies:blog_comments(*)), status_history:blog_post_status_history(*)')
    .eq(isUUID ? 'id' : 'slug', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Only published posts are visible to the public, everything else (draft,
  // in review, unpublished, archived...) is admin-only, same as the list
  // endpoint's `admin=true` gate.
  if (data.status !== 'published') {
    const profile = await getSessionProfile()
    if (!profile || !isAdminRole(profile.role)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // Increment view count
  supabase.rpc('increment_blog_views', { post_id: data.id }).then(() => {})
  const revisions = await getRevisions('blog_posts', data.id)
  return NextResponse.json({ ...data, revisions })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()

  const { data: current, error: fetchError } = await supabase
    .from('blog_posts')
    .select('status, title, excerpt, content, cover_image_url, category, tags')
    .eq('id', params.id)
    .single()
  if (fetchError) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const fromStatus = current.status as WorkflowStatus
  const toStatus = body.status as WorkflowStatus | undefined
  const isTransition = toStatus !== undefined && toStatus !== fromStatus

  if (isTransition) {
    if (!canTransition(fromStatus, toStatus!)) {
      return NextResponse.json(
        { error: `Cannot move a post from "${fromStatus}" to "${toStatus}"` },
        { status: 400 }
      )
    }

    const requiredPermission = transitionPermission(fromStatus, toStatus!)
    if (requiredPermission) {
      const allowed = await userHasPermission(guard.profile.userId, guard.profile.role, requiredPermission)
      if (!allowed) {
        return NextResponse.json({ error: `Missing permission: ${requiredPermission}` }, { status: 403 })
      }
    }

    if (toStatus === 'changes_requested' && !body.review_comments) {
      return NextResponse.json({ error: 'review_comments is required when requesting changes' }, { status: 400 })
    }

    if (toStatus === 'scheduled' && !body.scheduled_at) {
      return NextResponse.json({ error: 'scheduled_at is required to schedule a post' }, { status: 400 })
    }
  }

  // 'authors' isn't a column on blog_posts, it's the separate blog_authors
  // table (see the GET handler's `authors:blog_authors(*)` join) and needs
  // its own write, not a spread into this update.
  const { authors, ...bodyForPost } = body
  const updates: Record<string, unknown> = { ...bodyForPost, updated_at: new Date().toISOString() }

  if (isTransition) {
    if (toStatus === 'ready_for_review') updates.submitted_for_review_at = new Date().toISOString()
    if (toStatus === 'approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = guard.profile.id
    }
    if (toStatus === 'published' && !body.published_at) updates.published_at = new Date().toISOString()
    if (toStatus === 'draft') {
      // Returning to draft (e.g. after edits) clears any stale review comments
      // from a previous round, unless the caller is the one setting changes_requested.
    }
  }

  const changedContentFields = REVISIONED_FIELDS.filter((f) => f in body && body[f] !== (current as Record<string, unknown>)[f])
  if (changedContentFields.length > 0) {
    const snapshot: Record<string, unknown> = {}
    for (const f of REVISIONED_FIELDS) snapshot[f] = (current as Record<string, unknown>)[f]
    await saveRevision('blog_posts', params.id, snapshot, guard.profile.id)
  }

  const { data, error } = await supabase.from('blog_posts').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The editor always sends the full author list, so this is a replace, not a merge.
  if (authors !== undefined) {
    await supabase.from('blog_authors').delete().eq('post_id', params.id)
    if (authors.length) {
      const { error: authorsError } = await supabase.from('blog_authors').insert(
        authors.map((a: { name: string; email?: string; role?: string }) => ({ ...a, post_id: params.id }))
      )
      if (authorsError) console.warn('Post updated but authors failed to sync:', authorsError.message)
    }
  }

  if (isTransition) {
    await supabase.from('blog_post_status_history').insert({
      post_id: params.id,
      from_status: fromStatus,
      to_status: toStatus,
      comments: body.review_comments || null,
      changed_by: guard.profile.id,
    })
  }

  await logAudit({ table_name: 'blog_posts', record_id: params.id, action: 'UPDATE', new_data: body })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('blog_posts').update({ status: 'archived' }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'blog_posts', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
