# Assignment Workflow Testing & Documentation

## System Status

✅ **Migrations Applied:**
- Migration 029: Profiles RLS fix
- Migration 031: Assignment lifecycle + pipeline stages

✅ **Database Verification:**
- `assignments` table: Ready (0 rows)
- `pipeline_stages` table: Ready (4 rows seeded)
- `assignment_messages` table: Ready (0 rows)
- `documents` table: Ready (0 rows)

✅ **API Tests Passed:**
- Create assignment
- State transitions (Assigned → Accepted → In Progress → Submitted)
- Add assignment messages (Comment, Review types)
- Query team members and matter_people

---

## API Endpoints

### 1. Create Assignment
**POST** `/api/assignments`

```json
{
  "matter_id": "73b4f3c3-4ce4-40c4-8c90-b352526fb005",
  "assigned_to": "99e7e836-efc0-4f7b-9f61-4fdaeeef71f1",
  "stage_id": "abc123...",
  "instructions": "Please review this matter and prepare a summary"
}
```

**Validation:**
- ✓ Assignee cannot be a client on the matter
- ✓ Assignee must be active team member
- ✓ Returns 400 if assignee is client

---

### 2. List Assignments
**GET** `/api/assignments?[matter_id=X][&assigned_to=Y][&status=Submitted]`

Query parameters:
- `matter_id` — filter by matter
- `assigned_to` — filter by team member
- `status` — filter by status (Assigned, Accepted, In Progress, Submitted, Approved, Rejected, Revoked, Cancelled)

Returns:
```json
{
  "assignments": [
    {
      "id": "aef40998-512d-49ee-800d-c083ceacf474",
      "matter_id": "73b4f3c3-4ce4-40c4-8c90-b352526fb005",
      "status": "Assigned",
      "assigned_to": "99e7e836-efc0-4f7b-9f61-4fdaeeef71f1",
      "assigned_by": "admin-id",
      "assigned_at": "2026-07-28T12:00:00Z",
      ...
    }
  ]
}
```

---

### 3. Get Assignment Detail
**GET** `/api/assignments/[id]`

Returns full assignment with:
- All metadata
- Assignment messages (Comment, Review, System, Decision types)
- Linked documents
- Timestamps for each state

```json
{
  "id": "aef40998-512d-49ee-800d-c083ceacf474",
  "status": "Submitted",
  "matter": { "id": "...", "matter_number": "OW-2026-3911", "title": "..." },
  "assignee": { "profile": { "full_name": "Sharon Nambafu" } },
  "assigned_by_user": { "full_name": "Oringe Waswa" },
  "messages": [
    {
      "id": "...",
      "sender_id": "...",
      "message_type": "Comment",
      "content": "Great work on this matter!",
      "created_at": "2026-07-28T12:30:00Z"
    }
  ],
  "documents": [
    { "id": "...", "file_name": "summary.pdf", "file_path": "..." }
  ]
}
```

---

### 4. Assignment State Transitions
**PATCH** `/api/assignments/[id]`

**Accept** (Assigned → Accepted)
```json
{ "action": "accept" }
```
- Only assignee can accept
- Creates System message: "X accepted this assignment"

**Start** (Accepted → In Progress)
```json
{ "action": "start" }
```
- Only assignee can start
- Creates System message: "X started work on this assignment"

**Submit** (In Progress → Submitted)
```json
{
  "action": "submit",
  "message": "Work is ready for review" (optional)
}
```
- Only assignee can submit
- Creates System + optional Comment message

**Approve** (Submitted → Approved)
```json
{
  "action": "approve",
  "message": "Looks great, well done!" (optional)
}
```
- Only assigner can approve
- Creates System + optional Decision message
- Marks `completed_at`

**Reject** (Submitted → Rejected)
```json
{
  "action": "reject",
  "rejection_reason": "Needs revision to section 3",
  "message": "Please revise..." (optional)
}
```
- Only assigner can reject
- Must provide rejection_reason
- Creates System + optional Review message

**Revoke** (Any status except Approved/Revoked/Cancelled → Revoked)
```json
{ "action": "revoke" }
```
- Only assigner can revoke
- Creates System message: "X revoked this assignment"

---

### 5. Available Assignees (with eligibility)
**GET** `/api/assignments/available-assignees?matter_id=[id]`

Returns team members with eligibility status:
```json
{
  "assignees": [
    {
      "id": "99e7e836-efc0-4f7b-9f61-4fdaeeef71f1",
      "full_name": "Sharon Nambafu",
      "position": "Attorney",
      "is_eligible": true,
      "ineligible_reason": null
    },
    {
      "id": "client-team-member-id",
      "full_name": "Jane Doe",
      "position": "Attorney",
      "is_eligible": false,
      "ineligible_reason": "This person is a client on this matter and cannot be assigned work"
    }
  ]
}
```

---

### 6. Reassign After Rejection/Revocation
**POST** `/api/assignments/[id]/reassign`

**Return to original assignee:**
```json
{ "return_to_assignee": true }
```

**Assign to different person:**
```json
{
  "assign_to": "new-team-member-id",
  "message": "Reassigning to someone with more experience" (optional)
}
```
- Validates new assignee is not a client

**Claim for yourself:**
```json
{ "claim": true }
```
- You must be in team_members table

**Cancel assignment:**
```json
{ "cancel": true }
```

---

## UI Pages

### `/admin/assignments`
**Assignment Dashboard**
- **Assigned to me** section
  - Shows all open assignments assigned to the logged-in user
  - Grid/List view toggle
  - Color-coded by status
  - Due date warnings

- **Created by me** section
  - Shows all assignments the user has delegated
  - Grid/List view toggle
  - Track which team members are working on what

### `/admin/assignments/[id]`
**Assignment Detail Page**
- **Left (2/3):**
  - Details card: Matter, assignee, dates, instructions
  - Rejection reason (if rejected)
  - Attachments section (documents)
  - Discussion thread (messages with types)

- **Right sidebar (1/3):**
  - **Actions** section
    - Context-aware buttons based on status
    - Accept, Start, Submit (for assignee)
    - Approve, Reject (for assigner)
    - Rejection form when needed
  
  - **Timeline** section
    - Assigned date
    - Accepted date (if applicable)
    - Started date (if applicable)
    - Submitted date (if applicable)

---

## State Machine

```
┌─────────┐
│ Assigned │ (Created, waiting for assignee action)
└────┬────┘
     │ accept (assignee only)
     ▼
┌─────────┐
│Accepted │ (Assignee acknowledged, ready to start)
└────┬────┘
     │ start (assignee only)
     ▼
┌──────────────┐
│ In Progress  │ (Work is underway)
└────┬────────┘
     │ submit (assignee only)
     ▼
┌─────────────┐
│ Submitted   │ (Awaiting review)
└──┬─────┬───┘
   │     │
   │approve (assigner only)
   │     │
   │     └──────┐
   │            │
   │            ▼
   │        ┌──────────┐
   │        │ Approved │ (Complete)
   │        └──────────┘
   │
   │reject (assigner only)
   │            │
   │            ▼
   │        ┌──────────┐
   │        │ Rejected │ (Awaiting reassignment decision)
   │        └──────────┘
   │
   └─ OR revoke (assigner only, from any status except Approved/Revoked/Cancelled)
            │
            ▼
        ┌─────────┐
        │ Revoked │ (Awaiting reassignment decision)
        └─────────┘

All states can be transitioned to "Cancelled" by assigner.
```

---

## Message Types

| Type | Use Case | User | Example |
|------|----------|------|---------|
| **System** | Auto-generated state changes | System | "Sharon Nambafu started work on this assignment" |
| **Comment** | General discussion | Assignee/Assigner | "I found an issue in section 3" |
| **Review** | Feedback during submission | Assigner | "Needs revision to handle edge cases" |
| **Decision** | Approval/rejection outcome | Assigner | "Great work, this is ready to file" |

---

## Client-as-Team-Member Blocking

When an assignment is created:

1. **API Validation:**
   - Checks if `assignee.profile_id` appears in `matter_people` with `role = 'client'`
   - Returns 400 if true: "Cannot assign work to someone who is a client on this matter"

2. **UI Display:**
   - `/api/assignments/available-assignees` returns all team members
   - Team members who are clients show as **disabled** with reason
   - Dropdown UI shows them but prevents selection

3. **Example:**
   ```
   Sharon Nambafu        [Eligible]
   Jane Doe             [Ineligible] This person is a client on this matter...
   John Smith           [Eligible]
   ```

---

## Manual Testing Checklist

### Test 1: Create Assignment
- [ ] POST `/api/assignments` with valid data
- [ ] Verify assignment created with status "Assigned"
- [ ] Verify system message created

### Test 2: Assignee Accept
- [ ] GET assignment detail
- [ ] PATCH with action "accept"
- [ ] Verify status changed to "Accepted"
- [ ] Verify accepted_at timestamp set
- [ ] Verify message logged

### Test 3: Assignee Start Work
- [ ] PATCH with action "start"
- [ ] Verify status "In Progress"
- [ ] Verify started_at timestamp

### Test 4: Assignee Submit
- [ ] PATCH with action "submit"
- [ ] Verify status "Submitted"
- [ ] Verify submitted_at timestamp
- [ ] Add comment with PATCH

### Test 5: Assigner Approve
- [ ] PATCH with action "approve"
- [ ] Verify status "Approved"
- [ ] Verify completed_at timestamp
- [ ] Verify Decision message created

### Test 6: Reject & Reassign
- [ ] Create new assignment
- [ ] PATCH to Submit
- [ ] PATCH with action "reject" and reason
- [ ] Verify status "Rejected"
- [ ] POST to reassign with assign_to parameter
- [ ] Verify new assignment created and old one updated

### Test 7: Client Blocking
- [ ] Add a team member as client to a matter via matter_people
- [ ] GET `/api/assignments/available-assignees?matter_id=X`
- [ ] Verify that person shows as ineligible
- [ ] Try to create assignment with that person
- [ ] Verify API returns 400 error

### Test 8: UI - Assignment Dashboard
- [ ] Navigate to `/admin/assignments`
- [ ] Verify "Assigned to me" section loads
- [ ] Verify "Created by me" section loads
- [ ] Test grid/list view toggle
- [ ] Click on assignment to open detail page

### Test 9: UI - Assignment Detail
- [ ] Open assignment detail page
- [ ] Verify all metadata displayed correctly
- [ ] Click state transition button (Accept, Start, etc.)
- [ ] Verify UI updates after action
- [ ] Add a comment in the message thread
- [ ] Verify message appears with correct type

### Test 10: UI - Grid View on Submissions
- [ ] Navigate to `/admin/submissions`
- [ ] Click grid view toggle
- [ ] Verify submissions render as cards in grid
- [ ] Click list view toggle
- [ ] Verify table reappears

---

## Known Limitations & Future Work

1. **Reassignment UI** — The reassignment options after rejection/revocation are currently placeholder buttons in the UI. Full implementation pending.

2. **Approval Auto-progression** — The `pipeline_stages.auto_advance` field is configured but not yet wired to automatically move matters to the next stage. This requires additional logic in the approval handler.

3. **Documents** — The documents table structure exists but document upload/linking UI is not yet built. Currently just shows metadata.

4. **Notifications** — Assignment state changes are logged as messages but no notification system (email, Slack, etc.) is implemented yet.

5. **Permissions** — All assignment actions currently check admin API guard. Fine-grained role permissions (assign_work, approve_work, etc.) should be enforced.

---

## Next Steps

1. **Test the workflow end-to-end** in browser with real user accounts
2. **Build reassignment UI** for after-rejection workflow
3. **Implement auto-progression** so matters advance when assignments approved
4. **Add grid view** to more list pages (matters, staff, clients, users)
5. **Build document upload** UI for assignments
6. **Wire up notifications** for assignment state changes
