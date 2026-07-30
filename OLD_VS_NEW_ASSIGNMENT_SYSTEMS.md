# Old vs New Assignment Systems - Complete Comparison

**Created:** 2026-07-28  
**Purpose:** Help you decide which system to use going forward

---

## Quick Overview

| Aspect | Old System | New System |
|--------|-----------|-----------|
| **Table** | `matter_tasks` | `assignments` |
| **Workflow** | None (just assigned/done) | 8-state lifecycle |
| **State** | 2 states | 8 states |
| **Approval** | Not required | Built-in |
| **Messages** | None | Full thread |
| **Auto-progression** | No | Yes (configurable) |
| **Client sending** | Not built | Built-in |
| **Audit trail** | Minimal | Complete |
| **Created** | 2024 (early) | 2026-07-28 (today) |

---

## THE OLD SYSTEM (`matter_tasks`)

### What It Does
Simple task assignment on matters:
- "Do this work, mark it done"
- No workflow, no approval
- No discussion thread

### Database
```sql
matter_tasks
├── id
├── matter_id (which matter)
├── title (what to do)
├── assigned_to (team_members.id)
├── due_date
├── status ('open' or 'done')
├── done_at (when finished)
└── created_by
```

### How It's Used Currently

**On Admin Submission Detail Page:**
```
┌─ Submission Detail
│
├─ [Assign To dropdown]
│  └─ Dropdown shows: Kerry, Sharon, etc.
│
└─ Click "Assign To Kerry"
   └─ Creates matter_task: { assigned_to: kerry_team_id, status: 'open' }
```

**Kerry Sees It On:**
```
/desk → "My Tasks" section
```

### Workflow (Very Simple)
```
Task Created (status: open)
    ↓
Person sees it on /desk
    ↓
Person marks it done (status: done)
    ↓
Done
```

### Limitations

1. **No approval step** — Kerry marks it done, no one reviews
2. **No feedback loop** — No way to say "needs revision"
3. **No discussion** — Can't add notes/comments
4. **No pipeline connection** — Doesn't control matter progression
5. **No client notification** — Can't send completed work to client
6. **No audit trail** — Just who/when, no why
7. **No reassignment** — If assigned wrong, manual fixes needed
8. **Flat status** — only "open" or "done", no nuance

### Example Use Case (What It's Good For)

```
Partner: "Kerry, please proofread this letter"
↓ (Creates task via "Assign To")
Kerry: "Done, I've marked it complete"
↓
Partner: "Thanks, I'll review"
(Partner has to manually check the /desk to know when it's done)
```

---

## THE NEW SYSTEM (`assignments`)

### What It Does
Professional workflow for legal work with full lifecycle:
- Create assignment within a pipeline stage
- Assignee accepts, starts, submits
- Assigner reviews, approves/rejects
- Can send completed work to client
- Full audit trail of everything

### Database
```sql
assignments
├── id
├── matter_id (which matter)
├── stage_id (which pipeline stage)
├── status (8 states)
├── assigned_by (who assigned it)
├── assigned_to (team_members.id)
├── instructions (detailed brief)
├── assigned_at, accepted_at, started_at, submitted_at, completed_at
└── rejection_reason, rejected_by

assignment_messages (audit thread)
├── assignment_id
├── sender_id
├── message_type ('Comment', 'Review', 'System', 'Decision')
├── content
└── created_at

documents (deliverables)
├── assignment_id
├── file_name
├── document_type
├── is_final_version
├── requires_review
├── approved_at
└── approved_by
```

### How It's Used

**Via Admin Dashboard:**
```
/admin/assignments/page
├─ "Assigned to me" section (for assignees)
└─ "Created by me" section (for assigners)
```

**Via Assignment Detail Page:**
```
/admin/assignments/[id]
├─ Details (matter, dates, instructions)
├─ Message thread (discussion with types)
├─ Documents section
├─ Timeline (shows all state changes)
└─ Actions (buttons for accept/start/submit/approve/reject)
```

**Kerry Sees It On:**
```
/desk → "My Tasks" section
BUT ALSO with full workflow controls
```

### Workflow (Full Lifecycle)

```
┌─ Assigner creates assignment
│  └─ Sends to assignee (Kerry)
│
├─ Kerry receives
│  └─ Status: "Assigned"
│  └─ Can see in /desk
│
├─ Kerry accepts
│  └─ Status: "Accepted"
│  └─ Signals she's ready
│
├─ Kerry starts work
│  └─ Status: "In Progress"
│  └─ Notifies assigner
│
├─ Kerry does work
│  └─ Uploads documents
│  └─ Can add comments in thread
│
├─ Kerry submits
│  └─ Status: "Submitted"
│  └─ Notifies assigner
│  └─ Assigner can now review
│
├─ EITHER:
│  ├─ Assigner approves
│  │  └─ Status: "Approved"
│  │  └─ Auto-progression (if configured)
│  │  └─ Can send to client
│  │
│  └─ Assigner rejects
│     └─ Status: "Rejected"
│     └─ Provides reason
│     └─ Choice: return to Kerry OR reassign to someone else
│
└─ (If rejected) Reassignment or revision
   └─ Can move back to "Assigned" and send to different person
```

### Capabilities

1. ✅ **Approval required** — Professional review step
2. ✅ **Feedback loop** — Reject with detailed reason
3. ✅ **Discussion thread** — Comments, reviews, decisions in one place
4. ✅ **Pipeline control** — Auto-advance matter to next stage on approval
5. ✅ **Client notification** — Send completed work via email
6. ✅ **Full audit trail** — Every action logged with timestamps
7. ✅ **Reassignment** — Easy to return or reassign without manual fixes
8. ✅ **Rich status** — 8 states capture the full journey
9. ✅ **Messages with types** — Comment vs Review vs Decision vs System
10. ✅ **Documents** — Track what was delivered

### Example Use Case (What It's Good For)

```
Partner: "Kerry, draft a legal opinion for matter X"
└─ Creates assignment with instructions
   └─ Stage: "Legal Opinion"
   └─ Deadline: Friday

Kerry receives notification
└─ Clicks accept
   └─ Matter shows as "Assigned → Accepted"
   └─ Signals she's acknowledged

Kerry drafts opinion
├─ Uploads document
└─ Adds comment: "First draft ready for your review"

Kerry finishes
└─ Clicks "Submit Work"
   └─ Matter shows as "In Progress → Submitted"
   └─ Notification sent to Partner

Partner reviews
├─ Reads Kerry's work
├─ Reviews document
└─ Either:
   ├─ APPROVES:
   │  └─ Matter auto-advances to "Engagement Letter" stage
   │  └─ Partner clicks "Send to Client"
   │  └─ Client gets professional email with the legal opinion
   │
   └─ REJECTS:
      └─ Partner provides specific feedback
      └─ Status becomes "Rejected"
      └─ Kerry sees reason: "Needs more case law citations"
      └─ Partner can:
         ├─ Return to Kerry (try again)
         ├─ Reassign to colleague with more expertise
         ├─ Claim for self (Partner does it)
         └─ Cancel (not needed)

(If returned) Kerry revises
└─ Resubmits
   └─ Full thread shows revision history
```

---

## Side-by-Side Comparison Table

| Feature | Old (`matter_tasks`) | New (`assignments`) |
|---------|---------------------|-------------------|
| **Creation** | Via "Assign To" dropdown on submission | Via /admin/assignments or API |
| **Status states** | 2 (open, done) | 8 (Assigned, Accepted, In Progress, Submitted, Approved, Rejected, Revoked, Cancelled) |
| **Approval required** | ❌ No | ✅ Yes |
| **Rejection feedback** | ❌ No | ✅ Yes with reason |
| **Discussion thread** | ❌ No | ✅ Yes (Comment, Review, Decision, System) |
| **Accept/Start flow** | ❌ No | ✅ Yes |
| **Matter progression** | ❌ Manual | ✅ Auto (configurable) |
| **Send to client** | ❌ Not built | ✅ Yes (professional email) |
| **Reassignment** | ❌ Manual process | ✅ Built-in UI |
| **Audit trail** | ⚠️ Minimal (who/when) | ✅ Complete (all actions + messages) |
| **Document tracking** | ❌ No | ✅ Yes (versions, approval) |
| **Message types** | ❌ No | ✅ Yes (4 types for organization) |
| **Timeline** | ❌ No | ✅ Yes (visual) |
| **Scope** | Single task | Within a pipeline stage |
| **Complexity** | Simple | Richer workflow |

---

## Use Case Scenarios

### Scenario 1: Simple Proofreading Task
```
OLD: Good fit
- "Kerry, please proofread this letter"
- Kerry marks done
- Done

NEW: Overkill
- All the workflow states unnecessary
- Just needs "done" status
```

### Scenario 2: Complex Legal Opinion with Review
```
OLD: Doesn't fit
- Kerry finishes opinion
- Partner doesn't get notification
- Can't send feedback if needs revision
- No way to send to client after approval

NEW: Perfect fit
- Clear workflow
- Kerry submits, partner reviews
- If rejected, reason provided
- Revision history in thread
- Send to client when approved
- Auto-advance to next stage
```

### Scenario 3: Multi-Level Approval
```
OLD: Broken
- Junior attorney drafts
- Senior attorney reviews
- Partner signs off
- Needed way to track multi-level handoff

NEW: Ideal
- Junior creates assignment with draft
- Senior reviews, provides feedback
- If approved, senior's approval advances matter
- Partner creates new assignment for final review/signature
- Full audit trail of all reviewers
```

### Scenario 4: Client-Facing Deliverables
```
OLD: Missing
- Document completed
- No built-in way to send to client
- Manual email required
- No proof of delivery

NEW: Built-in
- Work completed and approved
- Click "Send to Client"
- Professional email sent
- Tracked in assignment thread
```

---

## Decision Framework

### Use the OLD System If:
- ✅ Simple task tracking (just "do this, mark done")
- ✅ No approval needed
- ✅ No client notification
- ✅ No workflow/stages
- ✅ Quick, ad-hoc work assignments
- ✅ You just need to track "who did what"

### Use the NEW System If:
- ✅ Work requires review/approval
- ✅ Need to track "In Progress" state
- ✅ Might need to reject and ask for revision
- ✅ Need to send completed work to client
- ✅ Matter progression depends on assignment completion
- ✅ Need full audit trail
- ✅ Multi-step workflow (draft → review → approve → deliver)
- ✅ Professional service delivery

---

## My Recommendation

For a **law firm**, the **NEW system** is better because:

1. **Legal work needs review** — everything goes through partner approval
2. **Client communication** — "work is complete, here's what we delivered"
3. **Compliance** — full audit trail of who did what and when
4. **Revision handling** — "needs more research, go back"
5. **Professional workflow** — matches real legal work processes
6. **Matter progression** — assignments control pipeline, not manual clicks
7. **Documentation** — keeps track of deliverables per assignment

The **OLD system** was adequate before the workflow was built, but now it's outdated for anything beyond "grab this quick task."

---

## Path Forward - Three Options

### Option A: Full Migration to New System (Recommended)
```
✅ Deprecate "Assign To" field on submission page
✅ Use /admin/assignments for all work assignments
✅ Integrate into workflow: submission → matter → assignments
✅ Eventually remove old matter_tasks table
✅ Client for: complex review, approval, delivery workflows
✗ Cost: Requires UI changes on submission page
⏱ Timeline: 1-2 weeks for full integration
```

### Option B: Parallel Systems (Transitional)
```
✅ Keep both systems running
✅ Use OLD for simple tasks (proofread, quick review)
✅ Use NEW for complex workflows (opinions, drafts, deliverables)
✅ Let team choose based on task complexity
✗ Cost: Maintenance burden, confusion about which to use
✗ Risk: Tasks get lost in wrong system
⏱ Timeline: Ongoing (no end date)
```

### Option C: Keep Old System Only (Not Recommended)
```
✅ Simpler (one system)
✗ Missing: approval, client notification, audit trail
✗ Not suitable for complex legal work
✗ Can't send deliverables to client
✗ No workflow support
⏱ Timeline: Means new system code goes unused
```

---

## My Suggestion

**Go with Option A: Full Migration**

**Phased approach:**
1. **Week 1:** Wire up "Assign To" on submission page to create assignments (new system)
2. **Week 2:** Update /desk to show both old and new tasks (backward compatibility)
3. **Week 3:** Train team on new workflow
4. **Week 4:** Deprecate old matter_tasks once comfortable
5. **Week 5+:** Archive old system

This gives you:
- One system for all assignment types
- Professional workflow for complex work
- Client notification support
- Full audit trail
- Clear approval/rejection process
- Gradual transition without losing data

---

## What This Means for Kerry

### With OLD System:
```
Kerry sees: Simple task "Proofread letter"
Kerry does: Completes it, marks done
Process: Done
```

### With NEW System:
```
Kerry sees: Full assignment with details
Kerry does: Accepts → Starts → Submits
Assigner: Reviews → Approves
Process: Work sent to client via email
Audit trail: Everything tracked
```

---

## Questions to Answer for Yourself

1. **Do you want approval workflow?** (NEW: yes, OLD: no)
2. **Do you need to send deliverables to clients?** (NEW: yes, OLD: no)
3. **Do you need revision/rejection feedback?** (NEW: yes, OLD: no)
4. **Do you need full audit trail?** (NEW: yes, OLD: minimal)
5. **Are most assignments simple or complex?** (Simple: OLD might work, Complex: NEW required)

---

## Bottom Line

**OLD System = Email follow-ups, manual tracking**  
**NEW System = Automated workflow, professional delivery, compliance**

For a law firm, you want the NEW system.

Would you like me to proceed with **Option A** (wiring up the new system as the primary assignment method)?
