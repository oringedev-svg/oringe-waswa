# Auth & Permissions Architecture - Current State vs Needed State

**Date:** 2026-07-28  
**Status:** ⚠️ BROKEN - Needs Redesign

---

## The Problem: Why Kerry (a pupil) Has Admin Access

### Current Architecture (Broken)

```
Kerry's Account
    ↓
profiles.user_id = kerry-auth-id
profiles.role = ??? (admin or staff - WRONG!)
profiles.email = kerry@gmail.com
    ↓
requireAdminApi() checks: isAdminRole(profile.role)
    ↓
if (ADMIN_ROLES.includes('admin' || 'staff' || 'moderator')) → ACCESS GRANTED
    ↓
Kerry can access ALL admin functions (matters, assignments, etc.)
    ↓
❌ PROBLEM: Kerry is a pupil, not admin!
```

### Root Cause

1. **profiles.role** values are LIMITED
   - Current: `'admin', 'staff', 'moderator', 'client', 'volunteer', 'public'`
   - Missing: `'pupil', 'advocate', 'paralegal'`
   - Kerry's row has `role = 'staff'` or `role = 'admin'` (incorrect)

2. **No distinction between:**
   - User type (who they are) → profiles.role ❌ Not granular enough
   - Staff position (what they do) → team_members.position ❌ Not used for access control
   - Admin functions (what they can access) → requireAdminApi() ❌ Too coarse-grained

3. **team_members table exists but is NOT used for auth:**
   ```
   team_members:
   - profile_id → links to profiles
   - position = 'Attorney', 'Paralegal', 'Administrator', 'Admin Assistant'
   - BUT: permissions don't check this!
   ```

4. **Two incomplete permission systems:**
   - **OLD (003_permissions.sql):** Flat role-based, limited permissions
   - **NEW (028_entrora.sql):** Scope-aware, not fully integrated

---

## Current Database Schema

### profiles (Migration 001)
```sql
CREATE TABLE profiles (
  id UUID,
  user_id UUID,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT CHECK (role IN (
    'admin',        ← Firm-wide admin
    'staff',        ← Any staff member
    'moderator',    ← Content moderator
    'client',       ← External client
    'volunteer',    ← Volunteer
    'public'        ← Anonymous user
  )),
  -- ❌ MISSING: 'pupil', 'advocate', 'paralegal'
  -- ❌ NO firm_id initially (added in migration 028)
  -- ❌ NO position or department
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
);
```

**Problem:** 'role' field is too coarse. Everyone who works at the firm is 'staff'.

### team_members (Migration 001)
```sql
CREATE TABLE team_members (
  id UUID,
  profile_id UUID REFERENCES profiles(id),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  position TEXT,                   ← Attorney, Paralegal, etc.
  department TEXT DEFAULT 'Legal', ← Legal, Admin, etc.
  specializations TEXT[],
  bar_number TEXT,
  years_experience INT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
);
```

**Problem:** NOT used in auth/permissions. Purely informational.

### matter_people (Migration 001)
```sql
CREATE TABLE matter_people (
  id UUID,
  matter_id UUID,
  profile_id UUID,
  role TEXT DEFAULT 'client'  ← Matter-specific role: attorney, paralegal, client
);
```

**Better:** Matter-specific roles exist, but not firm-wide.

### NEW Authorization (Migration 028)
```sql
-- Scoped roles
CREATE TABLE roles (
  id UUID,
  firm_id UUID,
  name TEXT,
  is_system BOOLEAN
);

-- Role → Permission mapping
CREATE TABLE role_permissions (
  role_id UUID,
  permission_key TEXT,
  scope_type TEXT (firm|office|department|team|matter),
  scope_id UUID
);

-- User → Role assignment
CREATE TABLE user_roles (
  user_id UUID,
  role_id UUID,
  firm_id UUID
);

-- Direct permission grants
CREATE TABLE permission_grants (
  user_id UUID,
  permission_key TEXT,
  scope_type TEXT,
  scope_id UUID,
  expires_at TIMESTAMPTZ
);
```

**Better:** But NOT integrated into requireAdminApi() yet!

---

## How Auth Works (Current)

### Login Flow
```
1. User logs in with email/password
2. Supabase creates auth session
3. getSessionProfile() called:
   - Fetches profiles row by user_id
   - Returns: { id, userId, email, fullName, role }
4. requireAdminApi() checks:
   - if (!profile) → 401 Unauthorized
   - if (!isAdminRole(profile.role)) → 403 Forbidden
5. isAdminRole() checks:
   - return ['admin', 'staff', 'moderator'].includes(profile.role)
```

### The Bug
```
Kerry's profile.role = 'staff'  (should be 'pupil')
    ↓
isAdminRole('staff') = true
    ↓
requireAdminApi() grants access
    ↓
Kerry can see ALL matters, assignments, submissions
    ↓
❌ BUG: Pupil should NOT have admin access!
```

---

## What Should Happen

### Proper Architecture

```
User Type (WHO)                 | Staff Position (WHAT)          | Access Level (WHAT)
─────────────────────────────── | ────────────────────────────── | ─────────────────────
profiles.role = 'pupil'         | (no team_members row)          | Trainee Dashboard
                                |                                | - See assigned work
                                |                                | - Submit completed work
                                |                                | - No admin access
─────────────────────────────── | ────────────────────────────── | ─────────────────────
profiles.role = 'advocate'      | team_members.position =        | Staff Dashboard
(lawyer with bar number)        | 'Attorney'                     | - Manage own assignments
                                |                                | - Assign to others
                                |                                | - Review work (if senior)
─────────────────────────────── | ────────────────────────────── | ─────────────────────
profiles.role = 'staff'         | team_members.position =        | Staff Dashboard
(non-lawyer staff)              | 'Paralegal', 'Administrator'   | - Limited access
                                |                                | - Based on position
─────────────────────────────── | ────────────────────────────── | ─────────────────────
profiles.role = 'admin'         | team_members.position =        | Full Admin Access
(firm administrator)            | 'Managing Partner'              | - All features
                                |                                | - Manage users/roles
                                |                                | - Configure firm
─────────────────────────────── | ────────────────────────────── | ─────────────────────
profiles.role = 'client'        | (no team_members row)          | Client Portal
(external client)               |                                | - View matters
                                |                                | - See documents
                                |                                | - No staff access
```

### Role Hierarchy (NEW)

```
System Roles (in roles table):
  ├─ admin_full               (Managing Partner)
  │  └─ Create users, manage roles, access everything
  │
  ├─ attorney_senior          (Senior Attorney)
  │  ├─ Create/manage assignments
  │  ├─ Approve work
  │  ├─ Send to client
  │  └─ View firm matters
  │
  ├─ attorney_junior          (Junior Attorney / Associate)
  │  ├─ Claim assignments
  │  ├─ Submit work
  │  ├─ Request review
  │  └─ View assigned matters
  │
  ├─ paralegal                (Paralegal / Clerk)
  │  ├─ Perform legal research
  │  ├─ Draft documents
  │  └─ View assigned matters
  │
  ├─ pupil                    (Pupil in Chambers)
  │  ├─ View assigned work
  │  ├─ Submit work for review
  │  └─ Learn system (read-only)
  │
  ├─ advocate                 (External Advocate)
  │  ├─ View assigned matters
  │  ├─ Submit work
  │  └─ Limited visibility
  │
  └─ client                   (External Client)
     ├─ View own matters
     ├─ See documents
     └─ Communicate via portal
```

---

## The Fix Required

### Phase 1: Data Model (This Session)

#### 1. Update profiles.role CHECK constraint
```sql
ALTER TABLE profiles 
DROP CONSTRAINT profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
  'admin',       -- Firm administrator
  'advocate',    -- Lawyer with bar number
  'pupil',       -- Trainee / law school graduate
  'staff',       -- Non-lawyer support staff
  'client',      -- External client
  'volunteer',   -- Volunteer
  'public'       -- Unauthenticated
));
```

#### 2. Create staff_type column on team_members
```sql
ALTER TABLE team_members ADD COLUMN staff_type TEXT 
CHECK (staff_type IN (
  'managing_partner',  -- Senior partner / managing director
  'attorney_senior',   -- Senior lawyer with oversight
  'attorney_junior',   -- Associate / trainee lawyer
  'paralegal',         -- Paralegal / legal assistant
  'secretary',         -- Administrative / secretarial
  'consultant'         -- External consultant
));
```

#### 3. Seed roles table with system roles
```sql
INSERT INTO roles (firm_id, name, description, is_system) VALUES
  (firm_id, 'admin_full', 'Full Administrator (Managing Partner)', true),
  (firm_id, 'attorney_senior', 'Senior Attorney (Partner)', true),
  (firm_id, 'attorney_junior', 'Junior Attorney (Associate)', true),
  (firm_id, 'paralegal', 'Paralegal / Clerk', true),
  (firm_id, 'pupil', 'Pupil in Chambers', true),
  (firm_id, 'advocate', 'External Advocate', true),
  (firm_id, 'client', 'External Client', true);
```

#### 4. Seed role_permissions with CRUD permissions
```sql
INSERT INTO role_permissions (role_id, permission_key, scope_type, scope_id) VALUES
  -- admin_full can do everything
  (admin_full_id, 'create_matter', 'firm', NULL),
  (admin_full_id, 'read_matter', 'firm', NULL),
  (admin_full_id, 'update_matter', 'firm', NULL),
  (admin_full_id, 'delete_matter', 'firm', NULL),
  (admin_full_id, 'manage_users', 'firm', NULL),
  (admin_full_id, 'manage_roles', 'firm', NULL),
  
  -- attorney_senior can manage assignments + approve
  (attorney_senior_id, 'create_assignment', 'firm', NULL),
  (attorney_senior_id, 'read_assignment', 'firm', NULL),
  (attorney_senior_id, 'update_assignment', 'firm', NULL),
  (attorney_senior_id, 'approve_assignment', 'firm', NULL),
  (attorney_senior_id, 'send_to_client', 'firm', NULL),
  
  -- attorney_junior can accept/complete assignments
  (attorney_junior_id, 'read_assignment', 'firm', NULL),
  (attorney_junior_id, 'update_assignment', 'matter', NULL),  -- Only own matters
  (attorney_junior_id, 'submit_assignment', 'matter', NULL),
  
  -- paralegal can view and work on assignments
  (paralegal_id, 'read_assignment', 'matter', NULL),
  (paralegal_id, 'update_assignment', 'matter', NULL),
  
  -- pupil can only view and submit
  (pupil_id, 'read_assignment', 'matter', NULL),
  (pupil_id, 'submit_assignment', 'matter', NULL),
  
  -- client can see own matters
  (client_id, 'read_matter', 'matter', NULL);
```

### Phase 2: Auth Integration (Next)

#### Update requireAdminApi() to use new system
```typescript
export async function requireAdminApi(): Promise<...> {
  const profile = await getSessionProfile()
  if (!profile) return { response: 401 }
  
  // NEW: Check user_roles + role_permissions
  const userRole = await checkUserRole(profile.userId, 'firm')
  if (!userRole || !isAdminRole(userRole)) {
    return { response: 403 }
  }
  
  return { profile }
}
```

#### Add permission checking to routes
```typescript
// Instead of: requireAdminApi()
// Use: requirePermissionApi('create_assignment', { scopeType: 'firm' })

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('create_assignment', { 
    scopeType: 'matter',
    scopeId: matterId 
  })
  
  if ('response' in guard) return guard.response
  
  // User has permission, proceed
}
```

### Phase 3: Frontend Implementation (After)

#### Update /admin pages to show role-based UI
```tsx
// Only show "Manage Users" if user has 'manage_users' permission
{permissions.includes('manage_users') && <UserManagement />}

// Only show "Create Assignment" if user has 'create_assignment' permission
{permissions.includes('create_assignment') && <CreateAssignment />}
```

---

## Specific Fix for Kerry

### Current State (Wrong)
```
Kerry's Profile:
  id: kerry-id
  user_id: kerry-auth-id
  email: kerry@gmail.com
  role: 'staff'          ← WRONG! Should be 'pupil'
  full_name: Kerry
  is_active: true
```

### Fix
```sql
UPDATE profiles 
SET role = 'pupil' 
WHERE email = 'kerry@gmail.com';

-- Remove from team_members if incorrectly added
DELETE FROM team_members 
WHERE profile_id = kerry-id AND staff_type IS NULL;

-- VERIFY:
SELECT id, email, role FROM profiles WHERE email = 'kerry@gmail.com';
-- Should show: role = 'pupil'
```

### Expected Behavior After Fix
```
Kerry logs in
    ↓
profile.role = 'pupil'
    ↓
requireAdminApi() checks: isAdminRole('pupil')
    ↓
isAdminRole('pupil') = false
    ↓
✅ Access DENIED to /admin/matters
✅ Can access /desk (assignee view only)
✅ Can see assignments where assigned_to = kerry_team_id
✅ Can accept/start/submit work
❌ Cannot create assignments (no permission)
❌ Cannot approve work (no permission)
```

---

## Comparison: Old vs New Architecture

| Aspect | Current (Broken) | Proposed (Fixed) |
|--------|------------------|-----------------|
| **Role definition** | profiles.role only | profiles.role + team_members.staff_type |
| **Role values** | 6 options (missing pupil/advocate) | 7 options (complete set) |
| **Access control** | Coarse (admin/staff/public) | Fine-grained (CRUD + scope) |
| **Permission source** | profiles.role | user_roles + role_permissions |
| **Scope awareness** | None | Full (firm/office/department/team/matter) |
| **Auditability** | Minimal | Complete (security_audit table) |
| **Extensibility** | Hard (must edit CHECK constraint) | Easy (add rows to roles table) |
| **Integration** | Ad-hoc per API | Unified via requirePermissionApi() |
| **Super admin control** | Manual SQL | Admin UI with role management |

---

## Implementation Order

### Priority 1 (This Session)
- [x] Fix profiles.role enum to include pupil/advocate
- [ ] Update Kerry's profile.role to 'pupil'
- [ ] Verify /admin access is now denied to pupil
- [ ] Verify /desk access shows only assigned work

### Priority 2 (Next Session)
- [ ] Migrate to Entrora system fully
- [ ] Create role_permissions seeding script
- [ ] Update requireAdminApi() to use new system
- [ ] Add requirePermissionApi() to all routes

### Priority 3 (Future)
- [ ] Build Admin UI for role management
- [ ] Add per-role dashboards
- [ ] Implement email/Slack notifications per role
- [ ] Add role-based audit logging

---

## Questions This Raises

1. **Are there other users with wrong roles?**
   - Check: `SELECT email, role FROM profiles WHERE role = 'staff';`
   - Filter: Who should actually be pupil/advocate/paralegal?

2. **What should team_members.staff_type be for existing staff?**
   - Manually assign or infer from position field?

3. **Should pupils see other pupils' work?**
   - No: Scope assignments to individual pupil only
   - Yes: Pupils see all work (learning mode)

4. **Can advocates work on firm matters?**
   - Yes: Assign them via matter_people with attorney role
   - Restrict: Set scope_type = 'matter' for their permissions

5. **Who should manage roles - super admin only?**
   - Yes: Only admin_full role can manage_roles
   - Or: Senior partners can manage team members?

---

## Summary

**The problem:** Kerry has `profile.role = 'staff'` which grants admin access via `requireAdminApi()`.

**Root cause:** profiles.role enum is incomplete (missing 'pupil'/'advocate') and too coarse-grained.

**The fix:** 
1. Update roles enum 
2. Implement scoped role permissions 
3. Integrate Entrora authorization system
4. Audit all user roles

**Timeline:** Phase 1 this session, Phase 2 next, Phase 3 ongoing.
