# Engineering Kickoff

**TO:** Engineering Team  
**FROM:** Architecture  
**DATE:** 2026-07-29  
**RE:** Platform Implementation — Architecture Frozen

---

## Statement

The architecture is now **frozen**.

The **Platform Engineering Handbook** and **Engineering Implementation Package v1.0** are the authoritative specifications for all implementation over the next 2–3 years.

Your role has changed. You are no longer an architect. You are a **lead software engineer executing a specification**.

The biggest risk now is not poor code—**it is architectural drift**.

---

## Core Rules

These rules are non-negotiable. Every commit must satisfy them.

### 1. Do Not Redesign the Architecture

- The five layers (Workflow, Matter Record, Knowledge Hub, Engine, Presentation) are fixed.
- The feature lifecycle is fixed.
- The repository pattern is fixed.
- The event-driven model is fixed.

If you believe you've found a genuine limitation, raise it. Do not work around it. See "Decision-Making" (below).

### 2. Do Not Introduce New Architectural Patterns

- No new abstractions without approval.
- No "this time we'll skip the Repository because it's just this one query."
- No "Output Contracts are overkill for this small feature, let's inline it."
- No shortcuts. The patterns exist to prevent exactly these shortcuts.

### 3. Every Feature Must Follow the Prescribed Lifecycle

```
Activity (user triggers work)
    ↓
Output Contract (validates, resolves Hub references)
    ↓
Repository (writes to Matter Record)
    ↓
Unit of Work / Transaction (atomic boundary)
    ↓
Matter Record (legal fact now exists)
    ↓
Commit (transaction succeeds)
    ↓
Domain Event (emitted)
    ↓
Engine(s) (subscribe independently, compute output)
    ↓
Projection(s) (query all layers, display to users)
```

**No shortcuts. No reordering. Every step, every time.**

If a feature doesn't fit this flow, it's not designed yet. Raise it instead of inventing a workaround.

---

## Immediate Objective

**Begin with Feature #1: Domain Events Infrastructure.**

This is the foundation that every future feature depends on. Nothing else can be built until this is complete, tested, and proven bulletproof.

### Scope

Implement an event bus system that:

1. **EventBus Interface**
   - `publish(event: DomainEvent): Promise<void>`
   - `subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void`
   - Type-safe event handling (one handler per event type)

2. **Concrete Implementation (RedisEventBus or In-Process)**
   - If using Redis: pub/sub with list-backed queue for persistence
   - If in-process: in-memory with file-backed persistence for reliability
   - Choice is implementation detail; interface is the contract

3. **Domain Event Definitions**
   - Base `DomainEvent` interface
   - Event-specific types in `domain-events/` folder
   - Zod schemas for validation
   - Event names: past-tense facts (`hearing_scheduled`, not `schedule_hearing`)

4. **Event Publisher**
   - Injected into Output Contracts
   - Publishes only after database transaction commits
   - Never publishes if transaction rolls back

5. **Event Subscriber Registration**
   - Engines subscribe to specific event types
   - Multiple subscribers per event supported
   - Subscribers are decoupled from the Activity that emitted the event

6. **Publish-After-Commit Semantics**
   - Critical: Database write succeeds → commit → publish event
   - Never: publish event → write to DB (catastrophic if write fails)
   - Unit of Work pattern enforces this boundary

7. **At-Least-Once Delivery Guarantees**
   - Subscribers must be idempotent (safe to run twice)
   - Event IDs used to detect/skip duplicates
   - Failures retry with backoff

8. **Comprehensive Tests**
   - Unit tests: EventBus subscribes/publishes correctly
   - Integration tests: Events persist, survive restart
   - Failure tests: Retries work, idempotency enforced

### Non-Scope (Do Not Implement Yet)

- Matter Record entities
- Specific Engines
- UI layers
- Knowledge Hubs
- Business logic of any kind

This is infrastructure only. Get it right, and everything else flows from it.

### Definition of Done (Feature #1)

- ✅ EventBus interface defined and documented
- ✅ Concrete implementation complete and tested
- ✅ Domain event types defined (at least: `matter_created`, `hearing_scheduled`, `conflict_check_requested`)
- ✅ Event publisher works (tested with fake Output Contract)
- ✅ Subscriber registration works (tested with fake Engines)
- ✅ Publish-after-commit semantics enforced and tested
- ✅ At-least-once delivery demonstrated (persist/restart scenario)
- ✅ Unit test suite > 80% code coverage on EventBus
- ✅ Integration test suite proves persistence and restart
- ✅ No architectural rules violated
- ✅ Production deployment ready

---

## Implementation Order

Follow this order exactly. Do not skip ahead. Do not parallelize features across layers—build vertically.

1. **Domain Events Infrastructure** (2 weeks)
   - EventBus, event definitions, publisher, subscribers

2. **Matter Record Repositories** (2 weeks)
   - MatterRecordRepository interface
   - PostgresMatterRecordRepository implementation
   - UnitOfWork transaction boundary
   - Integration tests against real database

3. **Output Contract Pattern** (1 week)
   - Define contract structure (schema, repositories, event emission)
   - Implement one reference contract to prove the pattern
   - Document via code

4. **Schedule Hearing Reference Implementation** (1 week)
   - ScheduleHearingOutputContract (reference already exists)
   - ScheduleHearingActivity
   - API endpoint
   - All tests passing

5. **Knowledge Hub** (1 week)
   - Courts, Court Divisions, Judges repositories
   - Read-only interfaces
   - Seeding and RLS policies

6. **Conflict Engine** (2 weeks)
   - Subscriber to `matter_created`, `matter_person_added`
   - Computes conflicts, stores proposed results
   - Unit and integration tests

7. **Deadline Engine** (2 weeks)
   - Subscriber to `hearing_scheduled`
   - Computes filing deadlines (uses Judge preferences from Hub)
   - Stores proposed results

8. **Calendar Projection** (1 week)
   - Pure query over `hearings` + `calendar_events`
   - React component
   - No new tables, no new business data

9. **Timeline Projection** (1 week)
   - Pure query over `matter_stage_history`
   - React component

Only after #9 is complete, move to Phase 2 features.

---

## Engineering Standards

Every implementation must comply with standards in the **Engineering Implementation Package v1.0**.

### The Non-Negotiables

**No Activity writes to the database.**
```typescript
// ❌ WRONG
export class ScheduleHearingActivity {
  async execute(input) {
    await supabase.from("hearings").insert(...);
  }
}

// ✅ CORRECT
export class ScheduleHearingActivity {
  async execute(input) {
    return await this.contract.execute(input);
  }
}
```

**All Matter Record writes go through Output Contracts.**
```typescript
// ❌ WRONG: Repository called directly
const hearing = await matterRecordRepo.createHearing(input);

// ✅ CORRECT: Output Contract calls Repository
const hearing = await contract.execute(input);
// ...which internally calls matterRecordRepo.createHearing(input)
```

**No Engine writes to Matter Record.**
```typescript
// ❌ WRONG: Engine mutates record
eventBus.subscribe("hearing_scheduled", async (event) => {
  await supabase.from("deadlines").insert(...); // Unauthorized
});

// ✅ CORRECT: Engine stores proposal
eventBus.subscribe("hearing_scheduled", async (event) => {
  await deadlineEngineRepo.saveProposal({...}); // deadline_engine_results
});
```

**All writes are in one transaction.**
```typescript
// ❌ WRONG: Two independent writes
await matterRecordRepo.createHearing(hearing);
await matterRecordRepo.appendTimeline(timeline); // If this fails, orphaned hearing

// ✅ CORRECT: Atomic transaction
await uow.transaction(async (txn) => {
  await matterRecordRepo.createHearing(hearing, txn);
  await matterRecordRepo.appendTimeline(timeline, txn);
});
```

**All new tables have RLS enabled immediately.**
```sql
-- ✅ CORRECT
CREATE TABLE hearings (
  firm_id uuid NOT NULL REFERENCES firms(id),
  ...
);

ALTER TABLE hearings ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON hearings
  FOR ALL TO public
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());
```

**All writes are traceable.**
```typescript
// Every Matter Record entity includes:
{
  source_activity_id: uuid, // Which Activity created this?
  created_at: timestamp,    // When?
}
```

**Repository methods are domain-shaped, not generic.**
```typescript
// ❌ WRONG
export interface Repository {
  find(table: string, where: any): Promise<any[]>;
  insert(table: string, data: any): Promise<any>;
}

// ✅ CORRECT
export interface MatterRecordRepository {
  createHearing(hearing: CreateHearingInput): Promise<Hearing>;
  appendTimelineEntry(entry: TimelineEntry): Promise<void>;
}
```

**Validation is always server-side.**
```typescript
// ✅ CORRECT: Client validation is UX; server is security
const input = ScheduleHearingInput.parse(req.body);
if (!input) throw new ValidationError("Invalid input");
```

**Events are only published after commit.**
```typescript
// ✅ CORRECT
try {
  await uow.transaction(async (txn) => {
    await matterRecordRepo.createHearing(hearing, txn);
  });
  await uow.commit(); // Write succeeds
  await eventBus.publish({ type: "hearing_scheduled", ... }); // THEN publish
} catch (err) {
  await uow.rollback(); // Write failed; don't publish
}
```

---

## Deliverables Per Feature

A feature is not complete until all applicable layers are implemented.

### For Every Feature (Minimum)

- [ ] Database migration(s) with RLS
- [ ] Repository interface additions
- [ ] Repository implementation (concrete DB layer)
- [ ] Output Contract (if adding Matter Record entities)
- [ ] Domain event type(s)
- [ ] Engine subscriber(s), where applicable
- [ ] Projection(s), where applicable
- [ ] API endpoint(s)
- [ ] UI component(s)
- [ ] Unit tests (fake repositories, no DB)
- [ ] Integration tests (real database)
- [ ] Documentation updates

### Tests Checklist

**Output Contracts:**
- [ ] One test per validation rule (must reject invalid)
- [ ] Happy-path test (entity created, event published, correct payload)
- [ ] Idempotency test (same key twice = one entity, not two)

**Repositories:**
- [ ] Integration tests against real database
- [ ] Transaction behavior (commit/rollback)
- [ ] Referential integrity enforcement
- [ ] Concurrency tests (optimistic locking)

**Engines:**
- [ ] Subscriber test with fake event
- [ ] Fake repository, no real database
- [ ] Idempotency test (same event twice = one result)
- [ ] Retry/failure handling

**Projections:**
- [ ] Query test (joins correct tables, returns expected shape)
- [ ] React component renders without errors
- [ ] No writes, no mutations

---

## Decision-Making Framework

If implementation reveals ambiguity or a decision point:

### Step 1: Check the Handbook

Read **Platform Engineering Handbook v1.0**. Does it answer your question?

Example questions:
- "Should this be a new table?" → See Part 8.1 (Matter Record extension test)
- "Can this Engine write to the record?" → See Part 6 (Engines are read-only)
- "How do we handle validation?" → See Part 4 (Output Contracts)

### Step 2: Check the Implementation Package

Read **Engineering Implementation Package v1.0**. Does it clarify?

Example questions:
- "Which folder for this component?" → See Part 2 (Repository Structure)
- "What's the testing strategy?" → See Part 9 (Engineering Standards)
- "Is this an anti-pattern?" → See Part 12 (Blacklist)

### Step 3: Raise It (Do Not Invent)

If the answer is still unclear, **raise the issue instead of inventing a solution**.

Do not:
- Introduce a new abstraction
- Deviate from the lifecycle
- "Just this once" bypass the pattern

**Do:**
- Document the ambiguity clearly
- Propose a solution that fits the architecture
- Wait for approval before implementing

---

## Definition of Done

A feature is complete only if:

### Architecture Compliance
- [ ] Follows the prescribed feature lifecycle (Activity → Contract → Repository → Record → Event → Engine → Projection)
- [ ] No rules from Part 9 / Part 12 violated
- [ ] No shortcuts, no workarounds, no "just this once"

### Functional Completeness
- [ ] All acceptance criteria met
- [ ] All specified deliverables implemented
- [ ] User-facing behavior works as designed

### Testing
- [ ] Unit tests pass (contracts, Engines)
- [ ] Integration tests pass (repositories, projections)
- [ ] 80%+ code coverage on new code
- [ ] No failing tests in main branch

### Code Quality
- [ ] Follows naming conventions (Part 8.2 / Part 9.2)
- [ ] Structured logging implemented (Part 9.7)
- [ ] Error handling uses domain types (Part 9.10)
- [ ] Dependency injection wired through composition root

### Deployment Readiness
- [ ] Database migrations tested and reversible
- [ ] RLS policies enforced
- [ ] No sensitive data in logs
- [ ] Monitoring/alerting configured (where applicable)
- [ ] Documentation updated (if applicable)

### Production Standards
- [ ] Code reviewed and approved
- [ ] All tests passing on main
- [ ] No regressions in related features
- [ ] Ready to deploy immediately

---

## Priority: Correctness Over Speed

The platform is designed to scale from one feature to a hundred without getting harder.

**Optimise for:**
1. **Correctness** — the code does what it claims
2. **Maintainability** — future engineers can extend it
3. **Consistency** — every feature looks identical
4. **Speed** — last

If you rush a feature and cut corners, you will:
- Add 5× the time to future features (technical debt)
- Make the codebase unpredictable
- Break the architecture others depend on

If you implement it correctly the first time:
- Every future feature uses the same pattern
- The codebase stays legible
- The architecture survives 100+ features

**Choose correctness.**

---

## Communication

### When You're Stuck

Raise an issue in Slack or via PR comment. Do not code around ambiguity.

### When You Finish a Feature

1. Open a PR
2. Ensure all tests pass
3. Request review
4. Link to the relevant section of the Engineering Implementation Package ("This follows Part 9 / Section 9.3")
5. Confirm all deliverables are present

### When You Spot a Violation

If you find existing code that violates the architecture:
- Do not replicate it
- Flag it for refactoring
- Use the pattern from the Package instead

---

## Start Here

1. Read **Platform Engineering Handbook v1.0** (all parts; 15 minutes)
2. Read **Engineering Implementation Package v1.0** (all parts; 30 minutes)
3. Study the **Schedule Hearing reference implementation** (`schedule-hearing.output-contract.ts`)
4. Read this **Engineering Kickoff**
5. **Begin Feature #1: Domain Events Infrastructure** (2 weeks)

Once Feature #1 is complete and merged, the team will have proven the architecture. Everything else flows naturally.

---

## Questions?

Before inventing a solution, check the Handbook or Package. If still unclear, ask.

**The biggest risk now is not poor code. It is architectural drift.**

Don't drift. Follow the plan.

---

**Document Version:** 1.0  
**Effective:** Immediately  
**Architecture Status:** Frozen  
**Next Review:** After Feature #1 ships
