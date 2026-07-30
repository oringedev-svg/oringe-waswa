# Permission System Fix - Action Plan

**Created:** 2026-07-28  
**Priority:** 🔴 CRITICAL  
**Impact:** Auth/Access Control  

---

## Executive Summary

**Problem:** Kerry (a pupil/trainee) has full admin access to all matters and can perform all actions. This is a security and role isolation issue.

**Root Cause:** 
- `profiles.role` enum missing 'pupil' and 'advocate' values
- Kerry's profile incorrectly has `role = 'staff'` instead of `'pupil'`
- `requireAdminApi()` treats all 'staff' as admins
- No fine-grained permissions (CRUD-oriented) implemented yet

**Risk Level:** HIGH
- Pupils/trainees can see confidential client information
- Pupils/trainees can modify or delete matters
- No audit trail of who did what
- Violates role isolation principle

---

## Immediate Actions (This Week)

### Action 1: Fix profiles.role Enum
**File:** Create migration `031_fix_profiles_role_enum.sql`

```sql
-- Drop old constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with complete role set
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
  'admin',      -- Firm administrator / managing partner
  'advocate',   -- Lawyer with bar number (licensed practitioner)
  'pupil',      -- Trainee / law school graduate in chambers
  'staff',      -- Support staff (paralegal, secretary, etc.)
  'client',     -- External client / end user
  'volunteer',  -- Volunteer
  'public'      -- Unauthenticated / public visitor
));

-- Verify all current profiles have valid roles
SELECT DISTINCT role FROM profiles;

-- These should be empty. If not, investigate:
SELECT id, email, role FROM profiles 
WHERE role NOT IN ('admin','advocate','pupil','staff','client','volunteer','public');
```

**Verify:** `SELECT DISTINCT role FROM profiles;` → should show only valid roles

### Action 2: Verify and Fix Kerry's Role
**Run manually or create a data migration:**

```sql
-- Check current state
SELECT id, email, full_name, role 
FROM profiles 
WHERE email LIKE '%kerry%' OR email LIKE '%pupil%';

-- If role = 'staff', fix to 'pupil'
UPDATE profiles 
SET role = 'pupil' 
WHERE email = 'kerry@gmail.com' OR email LIKE '%kerry%';

-- Verify
SELECT email, role FROM profiles WHERE role = 'pupil';
```

**Expected Result:**
```
kerry@gmail.com | pupil
```

### Action 3: Audit All User Roles
**Find users who shouldn't have admin access:**

```sql
-- List all non-admin staff and their actual positions
SELECT 
  p.email,
  p.role,
  tm.position,
  tm.staff_type,
  p.is_active
FROM profiles p
LEFT JOIN team_members tm ON p.id = tm.profile_id
WHERE p.role IN ('staff', 'admin')
ORDER BY p.role, p.email;
```

**For each row, verify:**
- ✅ Is this person actually a staff member? (Should have team_members row)
- ✅ Is their position correct? (attorney, paralegal, secretary?)
- ✅ Should they have admin access? (Only if managing partner)
- ✅ Are they actively employed? (is_active = true)

**Fix example:**
```sql
-- If John is a paralegal, not an admin
UPDATE profiles 
SET role = 'staff' 
WHERE email = 'john@firm.com';

-- Ensure he has a team_members record
INSERT INTO team_members (profile_id, full_name, email, position, department)
VALUES (john_id, 'John Doe', 'john@firm.com', 'Paralegal', 'Legal');
```

### Action 4: Update /admin Route Guard (Temporary)
**File:** `src/middleware.ts` or `src/app/admin/layout.tsx`

Add a quick check until full RBAC is implemented:

```typescript
// Prevent pupil/advocate/client from accessing /admin
const publicRoles = ['pupil', 'advocate', 'client', 'volunteer', 'public']
if (publicRoles.includes(profile.role)) {
  return NextResponse.redirect(new URL('/desk', request.url))
}
```

**This is a patch - not the final solution.**

### Action 5: Create Dashboard for Pupils
**File:** Create `src/app/pupil-desk/page.tsx`

Pupils should see:
- ✅ My Assignments (only those assigned to me)
- ✅ Submit Work (accept/start/submit workflow)
- ✅ My Learning Materials (read-only resources)
- ❌ NO access to /admin
- ❌ NO ability to create assignments
- ❌ NO ability to approve work

```typescript
// Check: user is pupil
if (profile.role !== 'pupil') redirect('/unauthorized')

// Show only assignments where:
// - assigned_to = current team_member_id
// - status = 'Assigned' or 'Accepted' or 'In Progress'
const assignments = await supabase
  .from('assignments')
  .select('*')
  .eq('assigned_to', currentTeamMemberId)
  .in('status', ['Assigned', 'Accepted', 'In Progress'])
```

---

## Phase 2: Implement Modular CRUD Permissions (Next Week)

### Step 1: Seed role_permissions Table
```sql
INSERT INTO role_permissions (role_id, permission_key, scope_type, scope_id) VALUES
-- ADMIN role: Full access
('admin-role-id', 'create_matter', 'firm', NULL),
('admin-role-id', 'read_matter', 'firm', NULL),
('admin-role-id', 'update_matter', 'firm', NULL),
('admin-role-id', 'delete_matter', 'firm', NULL),
('admin-role-id', 'create_assignment', 'firm', NULL),
('admin-role-id', 'read_assignment', 'firm', NULL),
('admin-role-id', 'update_assignment', 'firm', NULL),
('admin-role-id', 'approve_assignment', 'firm', NULL),
('admin-role-id', 'send_to_client', 'firm', NULL),
('admin-role-id', 'manage_users', 'firm', NULL),
('admin-role-id', 'manage_roles', 'firm', NULL),

-- ADVOCATE (Senior Lawyer) role
('advocate-role-id', 'create_matter', 'firm', NULL),
('advocate-role-id', 'read_matter', 'firm', NULL),
('advocate-role-id', 'update_matter', 'firm', NULL),
('advocate-role-id', 'create_assignment', 'firm', NULL),
('advocate-role-id', 'read_assignment', 'firm', NULL),
('advocate-role-id', 'update_assignment', 'firm', NULL),
('advocate-role-id', 'approve_assignment', 'firm', NULL),
('advocate-role-id', 'send_to_client', 'firm', NULL),
-- ❌ NO: manage_users, manage_roles, delete_matter

-- PUPIL role
('pupil-role-id', 'read_assignment', 'matter', NULL),  -- Only assigned matters
('pupil-role-id', 'update_assignment', 'matter', NULL), -- Only own assignments
('pupil-role-id', 'submit_assignment', 'matter', NULL),
-- ❌ NO: create, delete, approve, send_to_client, admin functions

-- STAFF (Support) role
('staff-role-id', 'read_matter', 'firm', NULL),
('staff-role-id', 'update_matter', 'firm', NULL),
('staff-role-id', 'read_assignment', 'firm', NULL),
('staff-role-id', 'update_assignment', 'firm', NULL),
-- ❌ NO: create_matter, approve_assignment, send_to_client

-- CLIENT role (External)
('client-role-id', 'read_matter', 'matter', NULL),     -- Only own matters
-- ❌ NO: update, create, admin functions
```

### Step 2: Update requireAdminApi()
```typescript
// File: src/lib/auth.ts

export async function requireAdminApi(): Promise<...> {
  const profile = await getSessionProfile()
  if (!profile) return { response: 401 }
  
  // NEW: Check user's roles
  const admin = createAdminClient()
  const { data: userRoles } = await admin
    .from('user_roles')
    .select('role_id')
    .eq('user_id', profile.userId)
  
  if (!userRoles || userRoles.length === 0) {
    return { response: 403 }
  }
  
  // Only 'admin' role can access /admin
  const isAdmin = userRoles.some(ur => 
    ur.role_id === 'admin-role-id'
  )
  
  if (!isAdmin) {
    return { response: 403 }
  }
  
  return { profile }
}
```

### Step 3: Add requirePermissionApi() to Routes
```typescript
// File: src/app/api/assignments/route.ts

export async function POST(req: NextRequest) {
  // Instead of: const guard = await requireAdminApi()
  // Use: const guard = await requirePermissionApi('create_assignment')
  
  const guard = await requirePermissionApi('create_assignment', {
    scopeType: 'firm'
  })
  
  if ('response' in guard) return guard.response
  
  // User has permission, proceed
  const { matter_id, assigned_to, stage_id, instructions } = await req.json()
  // ...
}
```

---

## Phase 3: Super Admin UI for Role Management (2-3 Weeks)

### Create Admin Panel at `/admin/settings/roles`

**Features:**
1. List all roles (Admin, Advocate, Staff, Pupil, Client)
2. For each role:
   - ✏️ Edit name & description
   - ➕ Add/remove permissions
   - 🔗 Add/remove users from role
   - 📊 Show which users have this role
3. List all users with their assigned roles
4. Bulk assign roles to users
5. Audit log of role changes

**Example UI:**
```
Roles
├─ Admin (5 users)
│  ├─ Permissions: 
│  │  ✅ create_matter, read_matter, update_matter, delete_matter
│  │  ✅ manage_users, manage_roles
│  └─ Users:
│     ├─ John (Managing Partner)
│     ├─ Sarah (Senior Partner)
│     └─ ...
│
├─ Advocate (12 users)
│  ├─ Permissions:
│  │  ✅ create_matter, read_matter, update_matter
│  │  ✅ create_assignment, approve_assignment
│  │  ❌ manage_users, manage_roles
│  └─ Users:
│     ├─ Kerry (Senior Attorney) ← Select to edit
│     └─ ...
│
├─ Pupil (3 users)
│  ├─ Permissions:
│  │  ✅ read_assignment, update_assignment, submit_assignment
│  │  ❌ approve_assignment, create_matter
│  └─ Users:
│     ├─ Kerry (Pupil in Chambers)
│     └─ ...
```

---

## Testing Checklist

### Test 1: Kerry Cannot Access /admin
```
❌ Before: Kerry logs in → navigates to /admin/matters → sees all matters
✅ After: Kerry logs in → navigates to /admin/matters → redirected to /desk
```

### Test 2: Kerry Can Only See Assigned Work
```
❌ Before: Kerry sees all assignments in firm
✅ After: Kerry only sees assignments where assigned_to = kerry_team_id
```

### Test 3: Kerry Cannot Create Assignments
```
❌ Before: Kerry clicks "Create Work Item" → creates assignment
✅ After: "Create Work Item" button is hidden or disabled for pupil
```

### Test 4: Kerry Cannot Approve Work
```
❌ Before: Kerry can click "Approve" button
✅ After: "Approve" button is hidden for non-advocate roles
```

### Test 5: Only Admins Can Manage Users
```
❌ Before: Anyone with 'staff' role can access /admin/settings/users
✅ After: Only 'admin' role can access user management
```

---

## Files to Create/Modify

| File | Action | Reason |
|------|--------|--------|
| `supabase/migrations/031_fix_profiles_role_enum.sql` | CREATE | Fix profiles.role enum |
| `supabase/migrations/032_seed_role_permissions.sql` | CREATE | Populate role_permissions |
| `src/lib/auth.ts` | MODIFY | Update requireAdminApi() |
| `src/middleware.ts` | CREATE | Add role check middleware |
| `src/app/pupil-desk/page.tsx` | CREATE | Pupil dashboard |
| `src/app/admin/settings/roles/page.tsx` | CREATE | Role management UI |
| `src/app/api/users/route.ts` | MODIFY | Use requirePermissionApi() |
| `src/app/api/assignments/route.ts` | MODIFY | Use requirePermissionApi() |

---

## Success Criteria

✅ All users have correct roles based on their position  
✅ Pupils see only their assigned work  
✅ Pupils cannot access /admin  
✅ Pupils cannot create/approve assignments  
✅ Advocates can manage assignments  
✅ Admins can manage users and roles  
✅ All permission checks logged in security_audit table  
✅ Role changes auditable  

---

## Summary

| Aspect | Current | After Fix |
|--------|---------|-----------|
| **Kerry's access** | Full admin | Pupil dashboard only |
| **Role granularity** | 6 values (missing pupil) | 7 values (complete) |
| **Permission model** | Coarse (admin/staff) | Fine-grained (CRUD + scope) |
| **Audit trail** | None | Complete (security_audit) |
| **Super admin control** | Manual SQL | Admin UI |
| **Enforcement** | Weak | Strong (middleware + API guards) |

**Timeline:**
- Week 1: Fix immediate issues + verify roles
- Week 2: Implement CRUD permissions
- Week 3: Build role management UI
- Ongoing: Audit and maintain

**Recommendation:** Start with Action 1-5 this week. The role enum fix is critical.
