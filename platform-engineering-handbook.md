# Platform Engineering Handbook v1.0

*Internal engineering documentation. Read this before writing code.*

**Status: Architecture frozen.** The five layers and the principles listed
below are not open for redesign in this document. If implementation exposes
a genuine limitation, see "How This Handbook May Be Amended" at the end —
that is the only sanctioned path to changing anything here.

---

# Part 1 — Vision

This platform is not a legal case management CRUD tool. It is an
**event-driven legal operating system**.

The failure mode we are deliberately avoiding is the one every practice
management product eventually falls into: a pile of independent modules —
Cases, Hearings, Documents, Witnesses, Payments — each with its own screen,
its own data entry, its own inconsistent notion of what a "matter" is. That
architecture rewards adding features and punishes maintaining them. Every
new module is a new place data can drift out of sync with reality, and a
new screen someone has to remember to fill in.

Instead, this platform treats a legal matter the way a hospital treats a
patient file: a single, continuously enriched record, populated as a
byproduct of the work being done, not as a separate data-entry task. A
lawyer scheduling a hearing shouldn't feel like they're "using the Hearings
module" — they're doing their job, and the record grows because of it.

That requires a strict separation of concerns:

- **Workflow** decides what work happens.
- **Matter Record** holds what is true about a case.
- **Knowledge Hub** holds what the firm knows independent of any case.
- **Engines** compute what can be derived from the above.
- **Presentation** shows all of it, without owning any of it.

Every rule in this handbook exists to protect that separation, because the
separation is what keeps the system legible as it grows from one Activity
to a hundred. A platform that gets this right doesn't get harder to extend
over time — it gets easier, because every new capability is an instance of
a pattern the team has already built four times, not a bespoke decision.

---

# Part 2 — The Five Layers

## 2.1 Workflow Layer

**Owns:** Practice Areas, Matter Types, Activities, Work Items, Trigger
Rules, Assignments, Scheduler.

**Responsibility:** deciding what work happens next, who does it, and when.

**Anti-pattern:** an Activity or Work Item accumulating fields that are
really legal facts about the matter (e.g. a "hearing_date" column sitting
on a Work Item because it was convenient at the time). If a piece of data
would still matter after the Activity is complete and archived, it belongs
in the Matter Record, not the Workflow layer.

## 2.2 Matter Record Layer

**Owns:** Matter, Matter People, Hearings, Legal Issues, Arguments,
Authorities, Evidence, Witnesses, Opposing Parties, Documents, Notes, Fees,
Correspondence, Service Records, Outcomes, Timeline.

**Responsibility:** the permanent, factual legal file. What users open when
they open a matter.

**Anti-pattern:** a new "module" table that duplicates an existing concept
under a new name because it was faster than reusing it — e.g. a
`negotiation_parties` table instead of reusing `matter_people` with a new
role. This is exactly the Zoho-style drift this architecture exists to
prevent.

## 2.3 Knowledge Hub Layer

**Owns:** Courts, Court Divisions, Judges, Registry Contacts, Filing
Requirements, Practice Areas, Matter Types, Legal Authorities, Professional
Types, Industries, Document Types, Coverage Areas, Organisation Types.

**Responsibility:** reference data that exists independent of any specific
matter, maintained by administrators, referenced by ID.

**Anti-pattern:** copying a Hub value into a Matter Record entity instead of
referencing it (e.g. storing a judge's name as a string on a hearing
instead of `judge_id`). This is the single most common way Hub data quietly
goes stale across hundreds of matters.

## 2.4 Engine Layer

**Owns:** Deadline Engine, Conflict Engine, Cost Forecast Engine, AI
Analysis Engine, Recommendation Engine, Risk Engine, Document Assembly,
Billing Engine, Analytics Engine — and their output tables.

**Responsibility:** computing derived output from Workflow + Matter Record +
Knowledge Hub state, in response to Domain Events.

**Anti-pattern:** an Engine writing directly to a Matter Record table
"just this once" because promotion felt like unnecessary ceremony for an
obviously-correct calculation. There is no obviously-correct calculation
exception. See Part 6.

## 2.5 Presentation Layer (Projection)

**Owns:** nothing business-related. Only user-experience configuration —
saved filters, dashboard layout, column preferences, favourites.

**Responsibility:** showing data from the other four layers via live
queries (or read-optimised caches/materialised views, which are a
performance detail, not a new source of truth).

**Anti-pattern:** a dashboard or report backed by its own table that gets
written to directly, becoming a second, divergent source of truth for data
that already exists in the Matter Record. If a projection seems to need
its own table, the fix is almost always "the Matter Record or Engine layer
is missing an entity" — not "give the projection a table."

---

# Part 3 — Feature Lifecycle

Every feature, without exception, traces this exact path. If you can't
trace a feature through all seven steps, it isn't designed yet.

```
 UI
  │  user fills a form / triggers an action
  ▼
 Activity (Workflow Layer)
  │  declares: what work is this, what does it collect,
  │  what Output Contract executes it
  ▼
 Output Contract
  │  validates input (shape + referential)
  │  resolves Knowledge Hub references
  │  writes Matter Record entities via Repository, in one transaction
  ▼
 Matter Record (updated)
  │  the legal fact now exists
  ▼
 Domain Event emitted
  │  e.g. hearing_scheduled
  ▼
 Engine(s) subscribed to that event react, asynchronously
  │  produce versioned, Engine-owned output (status: proposed)
  │  (optionally, later: a user promotes it into the Matter Record
  │   via its own Activity + Output Contract)
  ▼
 Presentation
     Timeline, Calendar, Dashboard, Matter File, Reports, Portal
     — all pure queries over the layers above, nothing new persisted
```

Worked example (Schedule Hearing):

1. UI: lawyer submits a "Schedule Hearing" form.
2. Activity: `ScheduleHearing` receives the collected input.
3. Output Contract: `ScheduleHearingOutputContract.execute()` validates the
   court/division/judge combination against the Knowledge Hub, then writes
   a `hearings` row and appends a `matter_stage_history` entry, atomically.
4. Matter Record: the hearing now exists as a legal fact.
5. Event: `hearing_scheduled` is published.
6. Engine: Deadline Engine, subscribed independently, computes proposed
   filing deadlines and stores them in `deadline_engine_results` with
   `status: proposed`.
7. Presentation: the Calendar shows the hearing (via
   `calendar_events.hearing_id`), the Timeline shows the scheduling event,
   and the Matter File's "Upcoming Deadlines" widget shows the proposed
   deadlines pending user confirmation — none of this required a new table.

---

# Part 4 — Output Contracts

## 4.1 Purpose

An Output Contract is the single, exclusive, validated entry point through
which an Activity's collected information becomes Matter Record fact. It
exists so that "how does data get into the system" has exactly one answer,
everywhere, for every feature.

## 4.2 Structure

Every Output Contract module, in order:
1. Input schema (typed validator — Zod or equivalent). No untyped payloads
   reach the write layer.
2. The Matter Record entity type(s) it produces.
3. Repository interface(s) it depends on — Matter Record (read/write) and
   Knowledge Hub (read-only).
4. A Domain Event Publisher interface.
5. The contract class/function itself, exposing a single `execute()`.

This is not a suggested shape — it's the shape. See
`schedule-hearing.output-contract.ts` for the literal reference.

## 4.3 Validation

Two mandatory passes:
- **Shape validation** — types, required fields, formats, enums.
- **Referential validation** — do the Knowledge Hub IDs given actually
  exist, and are they mutually consistent (a judge belongs to the division
  given, a division belongs to the court given)? This only happens
  server-side, inside the contract; client-side validation is UX, not a
  substitute.

## 4.4 Repositories

The contract depends on Repository *interfaces* only, injected via
constructor. It never imports a database client, an ORM model, or writes
raw SQL. See Part 5.

## 4.5 Emitted Events

Exactly one primary Domain Event per successful execution, named as a past
-tense fact (`hearing_scheduled`, not `schedule_hearing`), with a payload
containing IDs and the minimum data an Engine subscriber needs to decide
whether to act — not the full entity. Secondary events (e.g. a timeline
append) may be emitted if useful, but the primary event is the canonical
signal other layers key off.

## 4.6 Error Handling

- Validation errors are a distinct, catchable error type — never a raw
  database error surfaced to the Activity/UI layer.
- Persistence failures are translated by the Repository into stable
  domain-level errors (`NotFoundError`, `ConflictError`,
  `ConcurrencyError`) before reaching the contract.
- A failed `execute()` leaves zero partial state — guaranteed by the
  transaction boundary (4.7), not by manual cleanup code.

## 4.7 Transaction Boundaries

All Matter Record writes within one `execute()` call happen in a single
transaction, managed at the Repository/Unit-of-Work layer. Domain Events
are published only *after* the transaction commits — never publish for a
write that might still roll back.

## 4.8 Idempotency & Versioning

Every contract accepts an idempotency key (typically `sourceActivityId`).
Repositories detect duplicate executions and no-op or return the existing
entity rather than duplicating it. This is mandatory because Activities can
be retried by the Scheduler or redelivered by a queue.

Matter Record entities central to the legal record (hearing outcomes,
orders) follow the immutability rules in Part 8.5 — Output Contracts for
those entities model state transitions, not arbitrary field overwrites.

## 4.9 Testing Expectations

Minimum bar, per contract:
- One test per validation rule (shape and referential), asserting
  rejection.
- One happy-path test: correct entity written, correct event published
  with correct payload — tested against **fake, in-memory** Repository and
  Publisher implementations, no real database required.
- One idempotency test: same key executed twice → one entity, not two.

---

# Part 5 — Repository Pattern

## 5.1 What Activities Can Call

Nothing storage-related. An Activity calls exactly one thing: its Output
Contract's `execute()`. It does not import a Repository, a database client,
or an ORM model. This is Rule 1 (Part 1's non-negotiables) and it is
enforced by code review and, ideally, a lint rule restricting imports from
the Workflow layer.

## 5.2 What Contracts Can Call

Output Contracts call Repository *interfaces* (Matter Record, read-write;
Knowledge Hub, read-only) and a Domain Event Publisher interface — nothing
else. A contract never imports a concrete database driver, ORM class, or
another contract directly.

## 5.3 What Repositories Expose

A narrow, domain-shaped interface: `createHearing(...)`,
`appendTimelineEntry(...)`, `getCourtDivision(id)`. Method names describe
what the caller wants, not how storage achieves it. Repositories are the
**only** code in the entire platform permitted to contain SQL, an ORM
query builder call, or any storage-specific logic.

## 5.4 What Repositories Must Never Expose

- Raw query builders, raw SQL strings, or connection objects to callers.
- Generic `find(table, filter)` style methods — every method is specific
  and named for the domain operation it performs. A generic escape hatch
  defeats the entire purpose of the pattern within one sprint of being
  added.
- Cross-entity writes without a transaction boundary — if a Repository
  method needs to write to two tables, it manages that atomically itself
  or via the Unit of Work it's handed; it never leaves partial-write risk
  to the caller.

## 5.5 Transaction Management

Repository methods invoked together within one Output Contract execution
are wrapped in a single transaction via a Unit of Work handle, passed to
the contract at the start of `execute()`. Commit happens once, at the end,
on success; rollback happens automatically on any thrown error.

## 5.6 Dependency Injection

Repositories and Publishers are constructor-injected into Output
Contracts. Wiring — which concrete implementation binds to which interface
— happens in one composition root per deployment target (API server,
background worker, test harness). Pick one DI approach platform-wide
(container or plain factory functions) and do not mix styles across
features.

## 5.7 Optimistic Locking

Matter Record entities that can be concurrently edited carry a `version`
integer or `updated_at`-based check. An update fails explicitly
(`ConcurrencyError`) rather than silently overwriting a concurrent change.

## 5.8 Testing Approach

- Repository implementations: integration-tested against a real database,
  one suite per repository — transactional behaviour, constraint
  enforcement, idempotency.
- Output Contracts: unit-tested against fake in-memory repositories — fast,
  no database, isolated from persistence correctness (Part 4.9).

# Part 6 — Domain Events & Engines

## 6.1 Event Publishing

Output Contracts publish events after their transaction commits (Part
4.7). Event names are past-tense facts (`hearing_scheduled`,
`document_filed`, `conflict_check_requested`). Payloads carry IDs and the
minimal context a subscriber needs — subscribers that need more query the
Matter Record or Knowledge Hub directly by ID, they don't rely on the event
payload growing to include everything.

## 6.2 Subscribers

Engines subscribe to event types independently of the Activity/Contract
that emits them (Rule 4 — no direct invocation, in either direction). Adding
a new subscriber to an existing event requires zero changes to Workflow or
Matter Record code. Multiple Engines may subscribe to the same event.

## 6.3 Engine Outputs

Stored in Engine-owned tables (`deadline_engine_results`,
`conflict_engine_results`, `risk_assessments`, etc.), never in Matter
Record tables. Every row: `matter_id`, `computed_at`, the triggering
event, a `status` (`proposed` / `superseded` / `promoted`), and enough
context to explain *why* the Engine produced this result.

## 6.4 Versioning

Engine tables are **append-only**. Recomputation produces a new row, marks
the prior one `superseded`, and never overwrites in place. "Current" is a
query, not a schema assumption. Engines must be fully recomputable from
Workflow + Matter Record + Knowledge Hub state at any time — never
dependent on their own prior output as an irrecoverable source of truth.

## 6.5 Promotion

The only path from Engine output to Matter Record fact: an explicit user
action, itself an Activity with its own (typically small) Output Contract,
which writes the accepted value into the Matter Record and marks the
source Engine row `promoted`. No Engine ever writes to a Matter Record
table under any circumstance, including "obviously correct" calculations.

## 6.6 Auditability

Every Engine output row is traceable to the event that triggered it and,
if promoted, to the Activity/user that promoted it. This is what turns "the
AI suggested a deadline" into a real audit trail rather than an opaque
number that appeared in the matter.

## 6.7 Idempotency

Event handlers must be safe to run at-least-once (the bus may redeliver).
Processing the same event twice produces the same stored result — checked
via the triggering event's ID, not re-derived from scratch each time in a
way that could double-write.

## 6.8 Retries & Failure Handling

Failed Engine handlers retry with backoff; after retries are exhausted, the
attempt is recorded as `failed`, not silently dropped. An Engine failure
must never block, delay, or roll back the Activity/Output Contract that
emitted the triggering event — Engines are downstream and asynchronous by
design.

---

# Part 7 — Knowledge Hubs

## 7.1 The Hubs

| Hub | Contains |
|---|---|
| Courts | Court name, type, jurisdiction |
| Court Divisions | Divisions within a court (e.g. Commercial, Family) |
| Judges | Judge, tied to a division, with filing preferences |
| Registry Contacts | Registrar/clerk contacts per court or division |
| Practice Areas | Employment, Commercial, Conveyancing, etc. |
| Document Types | Category taxonomy for documents |
| Industries | Client/opposing-party industry classification |
| Professional Types | Advocate, Notary, Commissioner of Oaths, etc. |
| Coverage Areas | Geographic areas the firm operates in |

## 7.2 Why Hubs Exist

Hubs are an **optimisation and reuse mechanism**, not Matter data. The
underlying question a Hub answers is always: *"does the firm need to know
this regardless of whether any particular matter exists?"* A court exists
whether or not you have a case before it. A hearing date does not — it only
exists because a specific matter has a specific hearing. That distinction
is the entire test for whether something belongs in a Hub.

The payoff: update a judge's filing preferences once, and every matter
referencing that judge benefits immediately, with zero backfill.

## 7.3 Adding a New Hub

1. Confirm it passes the test in 7.2 — matter-independent, reused across
   many matters, administrator-maintained, relatively slow-changing.
2. Add the table, following the `firm_isolation` RLS pattern (with
   `public_read` only if the data is genuinely non-proprietary reference
   data, like `courts` — most Hub tables are not public).
3. Seed it via migration with jurisdiction-appropriate data, not
   hand-entered through the UI on day one.
4. Soft-delete only (`deleted_at`) — historical matters may reference
   entries indefinitely.
5. Wire it into the relevant Output Contract(s) as a read-only reference,
   never copied into Matter Record fields.

---

# Part 8 — Matter Record Standards

## 8.1 Designing a New Matter Entity

Before adding a table, check whether an existing entity, extended with a
new value (a new `role` on `matter_people`, a new `category` on
`legal_documents`), already models the concept. Prefer extension over a new
table. Add a new table only when the concept has genuinely distinct
structure and lifecycle — e.g. `hearings` is a real new table because a
hearing has fields and states nothing else has; a "Respondent" is not a new
table because it's just `matter_people` with `role = 'respondent'`.

Worked examples from the current roadmap:

| Concept | New table? | Reasoning |
|---|---|---|
| Hearings | Yes | Distinct fields (court, judge, outcome), distinct lifecycle |
| Witnesses | No | `matter_people` with `role = 'witness'` |
| Opposing Parties | No | `matter_people` with appropriate role |
| Legal Issues / Arguments / Authorities | Yes | Distinct linked structure (Issue → Argument → Authority → Evidence) |
| Evidence | No (mostly) | Metadata on `legal_documents`, not a separate entity, unless evidence exists that isn't a document (e.g. physical exhibit) |
| Negotiations | Yes | Distinct lifecycle (offers, counter-offers, outcome) not modeled elsewhere |
| Settlement Offers | Probably a child of Negotiations, not standalone |

## 8.2 Naming Conventions

- Tables: `snake_case`, plural (`hearings`, `legal_issues`).
- Foreign keys: `<entity>_id` (`matter_id`, `judge_id`).
- Domain Events: `<entity>_<past_tense_verb>` (`hearing_scheduled`,
  `issue_raised`).
- Output Contract classes: `<ActivityName>OutputContract`
  (`ScheduleHearingOutputContract`).
- Repository methods: verb + entity, never generic (`createHearing`, not
  `insert` or `save`).

## 8.3 Ownership

Every Matter Record table carries `firm_id` and uses the `firm_isolation`
RLS policy already established platform-wide. No Matter Record table is
`public_read`.

## 8.4 Audit Requirements

Every row traces to the Activity execution that created it
(`source_activity_id`) and, transitively, to the user who triggered that
Activity. This is part of the Output Contract's mandatory write shape
(Part 4), not an optional column added later.

## 8.5 Immutability Rules

Entities central to the legal record — hearing outcomes, filed orders,
finalised pleadings — do not support arbitrary field mutation once
finalised. Model state transitions explicitly (`scheduled` → `held`, with
outcome recorded as part of the transition, not a later silent edit).
Corrections after finalisation are additive (a correcting entry that
references the original), not overwrites, wherever legal accuracy of
history matters. Genuinely pre-finalisation, low-stakes data (a draft
note) can mutate freely.

## 8.6 Relationships

Matter Record entities relate to each other within a matter, and to
Knowledge Hub entities by foreign key reference only (never denormalised
copies — Part 2.3's anti-pattern). They never hold a foreign key into an
Engine-owned table; if a promoted Engine value becomes a legal fact, the
Matter Record stores the value itself, not a pointer back to the Engine row
that suggested it.

---

# Part 9 — Development Standards

## 9.1 Folder Structure (per capability/module)

```
/activities/<capability>/
    activity.ts              # Activity definition: triggers, follow-ups
    <capability>.contract.ts # Output Contract: schema, entity type,
                              #   repository interfaces, execute()
    <capability>.repository.ts   # Concrete Repository implementation
    <capability>.contract.test.ts    # Unit tests (fake repos)
    <capability>.repository.test.ts  # Integration tests (real DB)

/engines/<engine-name>/
    subscriber.ts             # event subscription + handler
    <engine-name>.repository.ts
    <engine-name>.test.ts

/knowledge-hub/<hub-name>/
    <hub-name>.repository.ts  # read-only interface + implementation

/projections/<view-name>/
    query.ts                  # pure read query across layers
    view.tsx / view.ts        # presentation
```

No feature's code should be scattered outside this shape without a
documented reason.

## 9.2 Naming

Consistent with Part 8.2. Beyond entities: booleans read as questions
(`isFinalised`, not `finalisedFlag`); event payload keys use the same
casing convention as the entity type they describe.

## 9.3 Dependency Injection

One composition root per deployment target. Contracts and Engine
subscribers receive dependencies via constructor, never via global
singletons or ambient imports of concrete implementations.

## 9.4 Repositories & Transactions

Per Part 5. No exceptions for "just this one quick migration script" —
scripts that write Matter Record data go through the same Output Contracts
as everything else, or they're not writing legal facts.

## 9.5 Validation

Every Output Contract has a typed input schema (Part 4.3). No `any`
reaching a write path. Validation errors are a distinct type from
persistence errors from day one.

## 9.6 Testing

Per Parts 4.9 and 5.8. Coverage expectation: every Output Contract has
unit tests; every Repository has integration tests; every Engine has a
subscriber test with a fake event and fake repository.

## 9.7 Logging

Every Output Contract execution logs, at minimum: Activity name, matter
ID, user ID, success/failure, and (on failure) the error type. Every Engine
handler logs: event ID consumed, processing outcome, and retry count on
failure. Logs are structured (JSON), not string-formatted, so they're
queryable in production.

## 9.8 Events

Per Part 6.1. Event schemas are versioned in code (a TypeScript type per
event), and a breaking change to an event payload requires updating every
subscriber in the same change — event payloads are not a place to "just
add a field and see what happens."

## 9.9 No Shortcuts

The following are never acceptable, regardless of deadline pressure:
writing to a Matter Record table outside an Output Contract; an Engine
writing to a Matter Record table at all; a projection persisting business
data; skipping the transaction boundary "because it's just one table
today."

---

# Part 10 — How to Add a New Feature

## 10.1 Decision Checklist

Walk these questions in order for any new capability:

1. **Does it belong to Workflow?**
   Is this new work to be performed, or new information about existing
   work? If it's new work → define an Activity. If it's just new
   information collected by an *existing* Activity → extend that
   Activity's Output Contract instead of creating a new Activity.

2. **Does it introduce new Matter facts?**
   If yes, does an existing Matter Record entity already model it (Part
   8.1's extension-over-new-table test)? If a new entity is genuinely
   needed, design it per Part 8.

3. **Does it belong in a Hub?**
   Apply the test in Part 7.2. If yes, it's Hub data, referenced by ID,
   never Matter data.

4. **Does an Engine calculate it?**
   Is this value derived/computed rather than directly asserted by a user?
   If yes, it's Engine output (Part 6), not a direct Matter Record write —
   even if the computation feels trivial.

5. **What Output Contract is required?**
   New contract, or an extension of an existing one? Write its spec per
   Part 4 before writing code.

6. **Which events are emitted?**
   Name them as past-tense facts. Define the payload as the minimum
   context a subscriber needs.

7. **Which Engines subscribe?**
   Existing Engines, a new Engine, or none yet (still emit the event
   regardless — free future-proofing).

8. **Which presentation views consume it?**
   List them. Confirm each is a pure query, introducing no new persisted
   business data (Part 2.5 / Part 9).

If any answer doesn't fit cleanly into an existing layer, stop and write an
ADR (10.2) rather than freelancing a workaround.

## 10.2 Architecture Decision Record (ADR) Template

Use this for any decision that deviates from, extends, or clarifies this
handbook.

```markdown
# ADR-<number>: <short title>

## Status
Proposed / Accepted / Superseded by ADR-<number>

## Context
What capability were we implementing? What part of the Standard (Part 10.1)
didn't fit, and why?

## Decision
What did we decide to do instead?

## Consequences
What does this mean for future features that resemble this one? Does this
change the handbook itself, or is it a one-off documented exception?

## Alternatives Considered
What else did we consider, and why was it rejected?
```

ADRs are stored alongside this handbook and referenced from it once
accepted. An accepted ADR that generalises becomes a handbook revision
(see below); one that doesn't generalise remains a documented,
justified, one-off exception.

---

# How This Handbook May Be Amended

This handbook is frozen unless implementation exposes a genuine
limitation — not a preference, not a shortcut taken under deadline
pressure. An amendment requires:

1. A concrete implementation attempt that actually hit the limitation
   (not a hypothetical).
2. A written ADR (10.2) describing what rule it violated and why the rule
   didn't fit.
3. Explicit sign-off before the exception is generalised into a handbook
   revision.

Absent all three, every feature conforms to this handbook as written, or it
does not merge.
