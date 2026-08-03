# OWA Legal Operating System: architecture blueprint

## Constitution

OWA is a legal operating system. A component owns business rules only within its boundary; user interfaces orchestrate commands and render results, but do not become the source of workflow, authorisation or reference-data truth.

```text
Platform
  Core systems -> shared engines -> hubs and catalogs -> runtime records
  -> UI applications and integrations
```

## Canonical language

| Concept | Canonical implementation | Never introduce as a parallel replacement |
|---|---|---|
| Matter | `legal_matters` | `matters` |
| Intake | `submissions`, `submission_events`, `submission_notes` | `intake_items` for normal legal intake |
| Instruction group | `engagements` | a second engagement wrapper |
| Runtime activity / queue item | `work_items` | `work_queue_items` |
| Accountable execution / review | `assignments` | a second assignment table |
| File evidence | `legal_documents` and revisions | a duplicate document store |
| Required outcome | `deliverables` / `deliverable_versions` | a file called a deliverable |

## Ownership boundaries

| System | Owns | Must not own | Primary engines / events |
|---|---|---|---|
| Client Relationship | profiles, client relationship view, portal access | Matter lifecycle | Auth, audit |
| Intake | submissions, evidence/notes, conflict handoff | Open Matter work | Lifecycle, conflict, notification |
| Matter Management | legal matters, engagement link, lifecycle, access, stage history | reusable taxonomy | Lifecycle, conflict, audit |
| Work Management | work items, work graph, trigger-generated activity | assignment review decisions | Workflow, routing |
| Assignment Management | accountable handovers, review, dependencies, ownership history | unclaimed work queue | Completion, SLA, notification |
| Documents/Artifacts | documents, revisions, artifacts, deliverable versions | Matter status | Revision, storage |
| Calendar | dated events, attendees, invitations | assignment ownership | notification, deadline |
| People | profiles, team members, skills, authority/capacity | work state | matching, authorisation |
| Hubs/Catalogs | firm-controlled reusable values and templates | one-off case data | audit, search |

## Hubs versus catalogs

Hubs are durable controlled reference data: Courts, Holidays, Institutions, Geography, Organisations and Knowledge. Catalogs are versioned definitions which seed runtime work: practice/matter taxonomy, activity types, assignment/completion definitions, deliverable and artifact types, templates, checklists, SLA and workflow policies. A Matter references Hubs and is instantiated from Catalog definitions; it must never mutate either to solve a case-specific need.

## Runtime graphs

```text
Engagement -> legal_matter -> work_item -> assignment -> deliverable -> artifact/document
                    |             \-> work_item_relationships
                    \-> matter_practice_areas
```

The `practice_area_id` on `legal_matters` remains the primary area for compatibility; `matter_practice_areas` is the authoritative many-to-many extension. `assignment_dependencies` guards completion after assignment; `work_item_relationships` models the activity graph before it is claimed.

## Non-negotiable rules

1. Matter lifecycle remains `lead -> conflict_check -> engagement_letter -> retainer_pending -> open -> on_hold/closed -> archived/declined`; no generic lifecycle replaces it.
2. Conflict clearance is a documented decision, not merely a search.
3. Promotion preserves one auditable story across Submission, Engagement, Matter, conflict records and documents.
4. A Work Item may remain unassigned in the pull queue. Claiming is a conditional, auditable operation; it creates the Assignment handover exactly once.
5. Deliverables describe what work owes; artifacts/documents are the produced evidence. Do not collapse those terms.
6. Hubs/catalog mutations are protected, attributed and archived rather than hard-deleted when referenced.
7. Engines live in server/domain services. UI controls are never authority.

## Immediate implementation sequence

1. Apply migration `044_reconciled_work_runtime.sql`.
2. Route workflow-triggered `work_items` through the queue/claim API where pull assignment is desired; retain explicit direct assignments for push work.
3. Add multi-practice controls to Matter create/edit and propagate all linked areas to conflict/matching queries.
4. Expose deliverables, assignment dependencies, health/SLA, skills/capacity and ownership history from the existing V3 schema in the Assignment UI.
5. Complete Hub CRUD for Police Stations and Prisons before treating them as operational reference truth.
