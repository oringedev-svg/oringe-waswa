# START HERE

**Oringe Platform — Architecture Frozen, Implementation Roadmap Ready**

This folder contains the complete specification for building the Oringe platform over 2–3 years. **Start with this document.**

---

## What You Have

Four authoritative documents that define the platform architecture and implementation roadmap.

### 1. Platform Engineering Handbook v1.0
**File:** `platform-engineering-handbook.md`  
**Audience:** Everyone  
**Time:** 15 minutes  
**What it is:** The architectural philosophy and principles that will guide every implementation decision.

**Read this first.** It explains:
- The vision (event-driven legal operating system)
- The five layers and their responsibilities
- The feature lifecycle (Activity → Contract → Repository → Record → Event → Engine → Projection)
- The rules for each layer
- How to amend the architecture (rare; requires concrete evidence of limitation)

---

### 2. Engineering Implementation Package v1.0
**File:** `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md`  
**Audience:** Engineers  
**Time:** 30 minutes  
**What it is:** The practical roadmap for implementing every feature over the next 2–3 years.

**Read this second.** It contains:
- **Phase 1–9 roadmap** (2 weeks each, 9 weeks total)
- **Repository structure** (complete folder map)
- **Feature development blueprint** (exact template for every feature)
- **Repository interfaces** (every repository the platform needs)
- **Engine catalogue** (all 12 engines planned)
- **Knowledge Hub catalogue** (all 14 hubs)
- **Projection catalogue** (all UI views)
- **Engineering standards** (naming, transactions, testing, DI, error handling)
- **First 20 features in dependency order**
- **Anti-patterns blacklist** (15 violations; strictly forbidden)
- **Future expansion** (how new practice areas plug in)
- **Production-ready composition root example**

---

### 3. Engineering Kickoff
**File:** `ENGINEERING_KICKOFF.md`  
**Audience:** Development team  
**Time:** 10 minutes  
**What it is:** The transition from architecture to implementation. Establishes the rules, the immediate objective, and the definition of done.

**Read this third.** It states:
- **Core rules** (do not redesign, do not introduce patterns, follow the lifecycle)
- **Immediate objective** (Feature #1: Domain Events Infrastructure)
- **Implementation order** (Features #1–9 in strict sequence)
- **Deliverables per feature** (what must be implemented)
- **Definition of done** (when a feature is complete)
- **Decision-making framework** (how to resolve ambiguity)

---

### 4. Architecture Freeze Summary
**File:** `ARCHITECTURE_FREEZE_SUMMARY.md`  
**Audience:** Everyone  
**Time:** 5 minutes  
**What it is:** A concise summary of what was frozen, why, and what it means for the team.

**Read this when you need a recap.** It covers:
- The core architecture in one page
- Why this architecture prevents the failure mode
- The team's new responsibility (execution, not architecture)
- Non-negotiable standards
- What must never happen
- The biggest risk now (architectural drift)

---

## How to Use These Documents

### If You're New to the Project

1. Read **Handbook** (15 min) — understand the vision and five layers
2. Read **Implementation Package** (30 min) — understand the roadmap and structure
3. Read **Kickoff** (10 min) — understand the rules and immediate next steps
4. Read **Freeze Summary** (5 min) — understand what was frozen and why

**Total time:** ~60 minutes. You'll know the entire platform architecture.

### If You're Designing a Feature

1. Check **Handbook Part 10.1** — Does my feature fit the decision checklist?
2. Check **Implementation Package Part 10** — What's the exact development blueprint?
3. Check **Engineering Package Part 5–9** — Which repositories, engines, projections do I need?
4. Check **Kickoff** — What's my definition of done?

### If You're Implementing a Feature

1. Follow **Implementation Package Part 3** — Feature Development Blueprint
2. Refer to **Schedule Hearing reference implementation** (in Handbook Part 3 and provided `schedule-hearing.output-contract.ts`)
3. Follow **Kickoff** — Core Rules and Standards
4. Check code against **Implementation Package Part 12** — Anti-patterns blacklist

### If You Hit a Decision Point

1. Check **Handbook** (all parts)
2. Check **Implementation Package** (all parts)
3. Check **Freeze Summary** (for quick answers)
4. If still unclear, **raise the issue instead of inventing a solution**

### If You Spot an Anti-Pattern

Check **Implementation Package Part 12** — What Must Never Be Done. If you find existing code violating a rule:
- Do not replicate it
- Flag it for refactoring
- Use the pattern from the specification instead

---

## The Immediate Objective

**Begin with Feature #1: Domain Events Infrastructure.**

**Scope:** Implement an event bus system that is the foundation for every future feature.

**Deliverables:**
- EventBus interface
- Concrete implementation (Redis or in-process)
- Domain event definitions (types, schemas, validation)
- Event publisher (injectable, publish-after-commit)
- Event subscriber registration (decoupled)
- At-least-once delivery guarantees
- Comprehensive unit and integration tests

**Timeline:** 2 weeks  
**Success criteria:** All acceptance criteria met, all tests pass, architecture proven.

See **Engineering Kickoff** ("Immediate Objective") for complete details.

---

## The Feature Lifecycle (Memorize This)

Every feature without exception follows this path:

```
Activity (user triggers work)
    ↓
Output Contract (validates, resolves Knowledge Hub references)
    ↓
Repository (writes to Matter Record via Transaction)
    ↓
Unit of Work / Transaction (atomic boundary)
    ↓
Matter Record (legal fact is now permanent)
    ↓
Commit (database transaction succeeds)
    ↓
Domain Event (emitted asynchronously)
    ↓
Engine(s) (subscribe independently, compute output)
    ↓
Projection(s) (pure queries over all layers, display to UI)
```

**No shortcuts. No reordering. Every step, every time.**

---

## The Five Layers (Memorize This)

| Layer | Responsibility | Example |
|-------|---|---|
| **Workflow (Activity)** | Decides what work happens, who does it, when | ScheduleHearingActivity |
| **Matter Record** | Permanent legal facts about a case | `hearings`, `legal_issues`, `negotiations` |
| **Knowledge Hub** | Reference data independent of any case | Courts, Judges, Practice Areas |
| **Engines** | Compute derived output asynchronously | DeadlineEngine, ConflictEngine |
| **Presentation (Projection)** | Display all layers via pure queries | Calendar, Timeline, Dashboard |

---

## The Non-Negotiables

**Never do this:**

- ❌ Activities writing to the database
- ❌ Engines writing to Matter Record
- ❌ Duplicate entities (negotiation_parties instead of matter_people)
- ❌ Projections persisting business data
- ❌ Business logic in UI
- ❌ Generic repository methods
- ❌ Skipping validation
- ❌ Direct Engine-to-Engine communication

**Always do this:**

- ✅ All Matter Record writes through Output Contracts
- ✅ All writes in a single transaction (UnitOfWork)
- ✅ All writes traceable (`source_activity_id`)
- ✅ Events published after commit (never before)
- ✅ RLS enabled on all new tables immediately
- ✅ Repository methods domain-shaped (`createHearing`, not `insert`)
- ✅ Server-side validation mandatory
- ✅ Tests: unit (fake repos) + integration (real DB)

See **Engineering Package Part 12** for the complete blacklist.

---

## Definition of Done

A feature is complete only if:

- ✅ Follows the prescribed feature lifecycle exactly
- ✅ All acceptance criteria met
- ✅ All tests pass (unit + integration)
- ✅ Code reviewed and approved
- ✅ Database migrations tested and reversible
- ✅ RLS policies enforced
- ✅ All deliverables implemented (migration, repos, contract, event, engine, projection, API, UI, tests)
- ✅ Production deployment ready

---

## Decision-Making Protocol

When you face a decision:

1. **Check the Handbook** (Platform Engineering Handbook v1.0)
2. **Check the Implementation Package** (Engineering Implementation Package v1.0)
3. **Check this summary** (Architecture Freeze Summary)
4. **If still unclear, raise the issue.** Do not invent a solution.

---

## The Biggest Risk Now

**Architectural drift.**

Not poor code. Not missing features. Not performance issues.

One feature cuts a corner → the next team copies it → within three features, the architecture is unrecognizable → what took 2 weeks now takes 8 weeks.

Your job:
- Follow the specification exactly
- Flag deviations immediately
- Prevent shortcuts
- Optimize for correctness and consistency

---

## Documents You Have

| Document | File | Purpose |
|----------|------|---------|
| **Handbook** | `platform-engineering-handbook.md` | Philosophy, principles, rules |
| **Implementation Package** | `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` | Roadmap, structure, standards |
| **Kickoff** | `ENGINEERING_KICKOFF.md` | Transition to execution |
| **Freeze Summary** | `ARCHITECTURE_FREEZE_SUMMARY.md` | Quick reference |
| **This guide** | `START_HERE.md` | Navigation |

Print all of them. Pin them in Slack. Refer to them constantly.

---

## Reference Implementation

The **Schedule Hearing** feature is the complete reference implementation.

**Files:**
- SQL schema: `hearings_and_courts_schema.sql` (in the provided zip)
- Output Contract: `schedule-hearing.output-contract.ts` (in the provided zip)
- Documentation: Handbook Part 3 (worked example)
- Implementation Package Part 4 (reference vertical slice)

**Study this implementation.** It shows:
- Exactly how an Output Contract is structured
- Exactly how validation works
- Exactly how repositories are called
- Exactly how domain events are emitted
- Exactly how Engines subscribe
- Exactly how tests are organized

Every other feature will follow this exact same pattern.

---

## Phase 1 Implementation Order

Build these in this exact sequence. Do not skip ahead.

1. **Domain Events Infrastructure** (2 weeks)
2. **Matter Record Repositories** (2 weeks)
3. **Output Contract Pattern** (1 week)
4. **Schedule Hearing Reference** (1 week)
5. **Knowledge Hub** (1 week)
6. **Conflict Engine** (2 weeks)
7. **Deadline Engine** (2 weeks)
8. **Calendar Projection** (1 week)
9. **Timeline Projection** (1 week)

**Total Phase 1:** 6 weeks

Once Phase 1 is complete and merged, the architecture is proven. Phase 2–9 flow naturally.

---

## Checklists

### Before You Start

- [ ] Read Handbook (15 min)
- [ ] Read Implementation Package (30 min)
- [ ] Read Kickoff (10 min)
- [ ] Study Schedule Hearing reference implementation (20 min)
- [ ] Understand the feature lifecycle (Activity → Contract → Repository → Record → Event → Engine → Projection)
- [ ] Understand the five layers and their responsibilities

### Before You Code a Feature

- [ ] Check the Implementation Package for the feature blueprint
- [ ] Identify all repositories, engines, projections needed
- [ ] Design the database migration (with RLS)
- [ ] Design the Output Contract (with validation)
- [ ] Design the domain event (with payload)
- [ ] Identify which Engines subscribe
- [ ] Identify which Projections display it
- [ ] Write the tests first (TDD)

### Before You Submit a PR

- [ ] All tests pass (unit + integration)
- [ ] Code follows naming conventions (Part 9.2)
- [ ] All deliverables present (migration, repos, contract, event, engine, projection, API, UI, tests)
- [ ] No anti-patterns (Part 12)
- [ ] Structured logging implemented (Part 9.7)
- [ ] Error handling uses domain types (Part 9.10)
- [ ] PR description links to relevant specification sections
- [ ] Definition of done satisfied

---

## Questions?

Before inventing a solution, check:

1. Handbook?
2. Implementation Package?
3. Freeze Summary?
4. This guide?

If still unclear, **raise the issue**. Do not code around ambiguity.

---

## Next Steps

1. **Read the four documents** (total ~60 minutes)
2. **Study the Schedule Hearing reference** (~20 minutes)
3. **Begin Feature #1: Domain Events Infrastructure**

That's it. The architecture is ready. The roadmap is clear. Everything else flows from executing the specification.

---

**Status:** Architecture Frozen  
**Effective:** 2026-07-29  
**Implementation:** Ready to begin  
**First Feature:** Domain Events Infrastructure (2 weeks)

Good luck. Build it right.
