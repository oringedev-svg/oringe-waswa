import { createAdminClient } from '@/lib/supabase'
import { getCurrentFirmId } from '@/lib/domainEvents'

// CheckPermission, per the Authorization capability spec. Every other
// capability's command handler is meant to call this before executing,
// which is why the handoff README says to build it early rather than last.
//
// What this adds over the existing flat userHasPermission() check is SCOPE:
//
//   I1  every check resolves at a specific scope (firm/office/department/
//       team/matter), never a bare "has permission".
//   I2  resolution is hierarchical and ADDITIVE: a grant at a broader scope
//       is visible at every narrower scope beneath it, and a narrower grant
//       can never revoke a broader one.
//   I4  a direct PermissionGrant can only ever ADD to what roles already
//       give; there is no deny path, by design.
//   I6  compliance-sensitive commands must resolve to a ROLE, never to an
//       individual override, so authority stays auditable at role level.

export type ScopeType = 'firm' | 'office' | 'department' | 'team' | 'matter'

/** Broadest first. A grant at any scope covers every scope after it (I2). */
const SCOPE_ORDER: ScopeType[] = ['firm', 'office', 'department', 'team', 'matter']

/**
 * Commands where a direct individual grant must NOT be sufficient (I6).
 * These are the ones the specs flagged as compliance-sensitive; the list
 * grows as capabilities land.
 */
export const COMPLIANCE_SENSITIVE = new Set<string>([
  'force_close_matter',
  'waive_conflict_check',
  'approve_knowledge_item',
  'manage_authorization',
])

export interface PermissionQuery {
  userId: string
  permissionKey: string
  scopeType?: ScopeType
  scopeId?: string | null
  /**
   * Whether a denial writes to security_audit. Callers that fall back to
   * another check on denial pass false and audit once themselves, so a
   * request that is ultimately allowed never leaves a "denied" record.
   */
  audit?: boolean
}

export interface PermissionResult {
  allowed: boolean
  /** Which path granted it, so a denial or grant can be explained. */
  via: 'role' | 'direct_grant' | 'none'
  reason?: string
}

function coveringScopes(scopeType: ScopeType): ScopeType[] {
  // Every scope at or broader than the one asked about (I2).
  const idx = SCOPE_ORDER.indexOf(scopeType)
  return SCOPE_ORDER.slice(0, idx + 1)
}

/**
 * Resolve whether an actor may perform a command at a given scope.
 * Denials of compliance-sensitive commands are written to security_audit
 * (spec §5: denied attempts are recorded, not just successes).
 */
export async function checkPermission(q: PermissionQuery): Promise<PermissionResult> {
  const { userId, permissionKey } = q
  const scopeType: ScopeType = q.scopeType ?? 'firm'
  const supabase = createAdminClient()
  const scopes = coveringScopes(scopeType)

  let result: PermissionResult = { allowed: false, via: 'none' }

  try {
    // --- role-derived (the primary path) ---
    const { data: roleRows, error: roleErr } = await supabase
      .from('user_roles')
      .select('role_id, role_permissions:roles(role_permissions(permission_key, scope_type, scope_id))')
      .eq('user_id', userId)

    if (roleErr) {
      // Migration 028 not applied on this deployment: fall back to the
      // existing flat check rather than locking everyone out.
      if (/does not exist/i.test(roleErr.message)) {
        return { allowed: false, via: 'none', reason: 'authorization tables not migrated' }
      }
      throw roleErr
    }

    const grantsFromRoles = (roleRows ?? []).flatMap(r => {
      const role = (r as { role_permissions?: { role_permissions?: unknown[] } }).role_permissions
      return (role?.role_permissions ?? []) as { permission_key: string; scope_type: ScopeType; scope_id: string | null }[]
    })

    const roleMatch = grantsFromRoles.some(g =>
      g.permission_key === permissionKey &&
      scopes.includes(g.scope_type) &&
      // A NULL scope_id means "everything at this scope_type".
      (g.scope_id === null || g.scope_id === q.scopeId)
    )

    if (roleMatch) {
      result = { allowed: true, via: 'role' }
    } else if (!COMPLIANCE_SENSITIVE.has(permissionKey)) {
      // --- direct grant (additive override, I4) ---
      // Skipped entirely for compliance-sensitive commands (I6).
      const { data: direct } = await supabase
        .from('permission_grants')
        .select('scope_type, scope_id, expires_at')
        .eq('user_id', userId)
        .eq('permission_key', permissionKey)

      const now = Date.now()
      const directMatch = (direct ?? []).some(g =>
        scopes.includes(g.scope_type as ScopeType) &&
        (g.scope_id === null || g.scope_id === q.scopeId) &&
        (!g.expires_at || new Date(g.expires_at).getTime() > now)
      )
      if (directMatch) result = { allowed: true, via: 'direct_grant' }
    } else {
      result = {
        allowed: false,
        via: 'none',
        reason: 'compliance-sensitive: requires a role, not an individual grant (I6)',
      }
    }
  } catch (err) {
    console.error('[checkPermission] failed:', err)
    return { allowed: false, via: 'none', reason: 'check failed' }
  }

  if (!result.allowed && q.audit !== false) {
    await recordSecurityAudit({
      eventType: 'PermissionCheckDenied.v1',
      actor: userId,
      permissionKey,
      scopeType,
      scopeId: q.scopeId ?? null,
      outcome: 'denied',
      detail: { reason: result.reason ?? 'no matching grant' },
    })
  }

  return result
}

export interface SecurityAuditInput {
  eventType: string
  actor?: string | null
  subjectUserId?: string | null
  permissionKey?: string | null
  scopeType?: string | null
  scopeId?: string | null
  outcome?: 'allowed' | 'denied'
  detail?: Record<string, unknown>
}

/** Append to the security audit log (separate from domain_events by design). */
export async function recordSecurityAudit(input: SecurityAuditInput): Promise<void> {
  try {
    const firmId = await getCurrentFirmId()
    const supabase = createAdminClient()
    const { error } = await supabase.from('security_audit').insert({
      firm_id: firmId,
      event_type: input.eventType,
      actor: input.actor ?? null,
      subject_user_id: input.subjectUserId ?? null,
      permission_key: input.permissionKey ?? null,
      scope_type: input.scopeType ?? null,
      scope_id: input.scopeId ?? null,
      outcome: input.outcome ?? 'allowed',
      detail: input.detail ?? {},
    })
    if (error && !/does not exist/i.test(error.message)) {
      console.error('[security_audit] insert failed:', error.message)
    }
  } catch (err) {
    console.error('[security_audit] threw:', err)
  }
}
