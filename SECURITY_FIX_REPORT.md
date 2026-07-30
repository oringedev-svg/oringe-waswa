# Security Fix: Pupil Account Could See All Matters

**Date:** 2026-07-29
**Status:** ✅ FIXED & VERIFIED

---

## Correction to earlier analysis

My previous session's `ARCHITECTURE_ANALYSIS.md` and `PERMISSION_FIX_ACTION_PLAN.md` guessed at the cause without reading the full migration history, and got two things wrong:

- **`profiles.role` already includes `'pupil'` and `'advocate'`** — added in [016_staff_roles.sql](supabase/migrations/016_staff_roles.sql). Kerry's row is already correctly `role = 'pupil'`. No enum fix was needed.
- **A modular, CRUD-oriented permission UI already exists** at [/admin/users](src/app/admin/users/page.tsx) — role dropdown + per-permission checkboxes, backed by the `permissions` catalog and `user_permissions` grants table (migration 003, extended in 016). This is exactly the "modular and CRUD" system you asked about; it didn't need to be built.

Treat those two files as superseded by this one.

---

## What was actually wrong

Kerry's account was correctly configured (`role: 'pupil'`, zero permission grants, `team_members.position: 'Pupil'`). The bug was in the **API routes**, not her account.

The middleware ([src/middleware.ts](src/middleware.ts)) intentionally lets any signed-in role — including `pupil` and `admin_assistant` — reach `/admin` pages and `/api` routes. That's by design: the comment in the middleware says permission is meant to be "gated permission-by-permission at the API layer." But several routes never implemented that second gate. They just queried the database and returned everything, to anyone who got past the front door.

`GET /api/files/matters` (the matter list) had **no permission check at all**:

```typescript
// Before: any signed-in user, any role, got every matter in the firm
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('legal_matters').select('*')...
  return NextResponse.json({ data, count })
}
```

`GET /api/files/matters/[id]` (matter detail) had **no auth check whatsoever** — not even confirming a session existed. Same for its `DELETE` (archive).

I verified the actual impact directly against the database: Kerry's account has 1 legitimate matter link (via `matter_people`) and 0 assignments, but the firm has 17 matters total. Before the fix, she could see and open all 17. That's the exact complaint — "I accessed all matters under Kerry's account."

The same pattern (zero guard, not a role problem) showed up in several other routes:

| Route | Exposure |
|---|---|
| `GET/DELETE /api/files/matters/[id]` | Any matter, full detail, by ID — no check |
| `GET /api/files/documents`, `[id]` | Any document across the firm |
| `GET/POST /api/people` | Every client/contact profile, firm-wide |
| `PATCH /api/people/[id]` | Could change **any profile's role**, including granting `admin` — a privilege-escalation path |
| `GET/PATCH/DELETE /api/submissions/[id]`, bulk delete | Intake data, unrestricted |
| `GET/PATCH/DELETE /api/appointments`, `[id]` | Client scheduling data, unrestricted |
| `GET/POST/PATCH/DELETE /api/settings/keys` | **Third-party API keys**, no check at all |
| `GET /api/audit-log` | Compliance audit trail, no check |

---

## The fix

### 1. New scoping helper: [src/lib/matterScope.ts](src/lib/matterScope.ts)

```typescript
export async function getMatterAccessScope(profile: SessionProfile): Promise<MatterScope> {
  if (profile.role === 'admin') return { all: true }

  const hasManageMatters = await userHasPermission(profile.userId, profile.role, 'manage_matters')
  if (hasManageMatters) return { all: true }  // staff's existing default

  // Everyone else: only matters they're personally tied to
  //   - a matter_people entry (client, co-counsel, etc.)
  //   - the assignee on an assignment for that matter
  ...
  return { all: false, matterIds }
}
```

This preserves today's behavior for `admin` and for `staff`/anyone else holding `manage_matters` (the permission staff already get by default from `/admin/users`). It only changes what a `pupil` or `admin_assistant` — or anyone with no explicit grant — can see: their own linked matters instead of the whole docket.

This is deliberately **not** "block pupils from matters." The assignment workflow depends on a pupil reaching the matter they're actually assigned to, so the fix scopes access rather than removing it.

### 2. Applied the scope check to matters and documents
- `GET /api/files/matters` — filters the list by scope
- `GET/PATCH/DELETE /api/files/matters/[id]` — 403s if the matter isn't in scope; edits/deletes now also require `manage_matters`
- `GET/POST /api/files/documents`, `GET/PATCH/DELETE /api/files/documents/[id]` — scoped via the parent matter

### 3. Added baseline guards where there was none at all
- `people` (list/detail): `requireAdminApi()` for read, `manage_users` for role/status changes (closes the self-promotion-to-admin path)
- `submissions/[id]`, `submissions/bulk`: `requireAdminApi()`
- `appointments`, `appointments/[id]`: `requireAdminApi()` on read/write (public booking `POST` on the base path is untouched, that's intentional per the middleware's own carve-out)
- `settings/keys`: `requirePermissionApi('manage_settings')` (admin-only by default)
- `audit-log`: `requirePermissionApi('manage_settings')`
- `ai/admin-assistant/execute`: `requireAdminApi()` added for defense in depth, though it was already effectively covered — it forwards the caller's session cookie to the underlying `/api` route it's acting on, so every fix above already applied to AI-driven actions too

### 4. Fixed compile errors introduced earlier this session
- Removed a dead `toggleTask` function calling `toast.info` (not a real `react-hot-toast` method)
- `MatterPipeline`'s inline "Assign Task" quick-add now resolves the correct `pipeline_stages.id` from the currently-viewed lifecycle stage (via matching `key`), instead of missing the `stage_id` the new assignments API requires

---

## Verification

Queried the database directly before writing the fix:

```
TOTAL MATTERS IN FIRM: 17
KERRY MATTER_PEOPLE LINKS: 1
KERRY TEAM_MEMBER: found (position: Pupil)
KERRY ASSIGNMENTS: 0
KERRY manage_matters GRANT: none
```

With `getMatterAccessScope` applied, Kerry's effective scope is `{ all: false, matterIds: ['bfacf958-...'] }` — **1 matter, not 17**. `npx tsc --noEmit` passes clean across the whole project after all changes.

---

## What this does NOT do

- It doesn't touch `profiles.role`, `team_members`, or any user's data — nothing needed correcting there.
- It doesn't add a new roles/permissions UI — `/admin/users` already does modular, per-permission, CRUD-style grants, and now the routes actually enforce what it grants.
- It doesn't lock pupils out of matters entirely — they still reach matters they're assigned to or linked on, which is what the assignment workflow requires.

## Remaining lower-priority gaps (not fixed, noted for later)

A handful of routes still have no guard: `blog` (mutations), `mail/subscribers`, `mail/campaigns`, `team/messages`, `certificates`, `coverage`, `insights`. These are content/marketing surfaces, not client-confidential legal data, so they were lower priority than matters/documents/people/keys. Worth a follow-up pass if you want the same treatment applied there.
