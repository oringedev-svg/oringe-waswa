# Architecture Freeze Summary

**Date:** 2026-07-29  
**Status:** FROZEN  
**Last Amendment:** Never (this is the baseline)

---

## What Just Happened

The Oringe platform architecture has been designed, documented, and **frozen**.

Three authoritative documents now exist:

1. **Platform Engineering Handbook v1.0** (`platform-engineering-handbook.md`)
   - *Architectural philosophy and principles*
   - The five layers (Workflow, Matter Record, Knowledge Hub, Engine, Presentation)
   - The feature lifecycle
   - Rules for every layer
   - How the handbook may be amended

2. **Engineering Implementation Package v1.0** (`ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md`)
   - *Practical engineering roadmap for 2–3 years*
   - 9-phase implementation plan
   - Repository structure (all folders)
   - Feature development blueprint
   - Repository interfaces (all repositories needed)
   - Engine catalogue (12 engines)
   - Knowledge Hub catalogue (14 hubs)
   - Projection catalogue (major UI views)
   - Engineering standards (naming, transactions, testing, DI, etc.)
   - First 20 features in dependency order
   - Anti-patterns blacklist (15 violations)
   - New practice area expansion (Immigration example)

3. **Engineering Kickoff** (`ENGINEERING_KICKOFF.md`)
   - *Transition from architecture to implementation*
   - Core rules (non-negotiable)
   - Immediate objective (Feature #1: Domain Events)
   - Implementation order (Features #1–9)
   - Standards compliance checklist
   - Definition of done
   - Decision-making framework
   - Priority: correctness over speed

---

## The Core Architecture (TL;DR)

### Five Immutable Layers

```
┌──────────────────────────────────────┐
│  Presentation Layer (Projection)     │  ← pure queries, no new data
├──────────────────────────────────────┤
│  Engine Layer                        │  ← async subscribers, compute output
├──────────────────────────────────────┤
│  Domain Events                       │  ← async signals between layers
├──────────────────────────────────────┤
│  Matter Record Layer                 │  ← legal facts, immutable history
├──────────────────────────────────────┤
│  Knowledge Hub (reference layer)     │  ← read-only, administered
├──────────────────────────────────────┤
│  Workflow Layer (Activities)         │  ← user-triggered work
└──────────────────────────────────────┘
```

### Feature Lifecycle (No Exceptions)

```
Activity (user triggers)
    ↓
Output Contract (validates, resolves references)
    ↓
Repository (writes to Matter Record)
    ↓
Unit of Work / Transaction
    ↓
Matter Record (legal fact written)
    ↓
Commit
    ↓
Domain Event (emitted asynchronously)
    ↓
Engine(s) (subscribe, compute output)
    ↓
Projection(s) (query and display)
```

### Key Principles

1. **Single source of truth per concept**
   - One table per entity type (no `negotiation_parties` when `matter_people` exists)
   - No denormalized copies (Hub data referenced by ID, not copied)

2. **Separation of concerns**
   - Activities don't touch the database
   - Engines don't write to Matter Record
   - Projections don't own business data
   - Repository layer is the only place SQL is written

3. **Auditability**
   - Every Matter Record write traces to `source_activity_id`
   - Every Engine output traces to the event that triggered it
   - Domain events are versioned
   - No silent mutations

4. **Asynchrony and Decoupling**
   - Activities and Engines never communicate directly
   - Engines subscribe to events independently
   - Engines produce "proposed" output; users promote it
   - No Engine failure blocks the Activity that triggered it

5. **Testability**
   - Output Contracts tested against fake repositories (no DB)
   - Repositories tested against real database (integration tests)
   - Engines tested with fake events (no real events)
   - Each layer can be tested in isolation

---

## Why This Matters

### What We're Avoiding

The reason this architecture exists is to prevent the catastrophic failure mode **every practice management product eventually hits**:

- A pile of independent modules (Cases, Hearings, Documents, Witnesses, Payments)
- Each with its own data entry screen
- Each with its own inconsistent notion of what a "matter" is
- Data drifting out of sync with reality
- Every new module adding 5 more screens someone has to remember to fill in
- Features getting harder to add over time, not easier

### What We're Building

A platform where:
- A lawyer does their job (schedule a hearing)
- The system captures it as a legal fact
- Other systems react automatically (deadlines, calendar, conflicts)
- No extra data entry
- Everything stays in sync
- Every new feature follows the same pattern
- Adding the 100th feature is as easy as the 1st

---

## The Team's New Responsibility

You are no longer architecting. **You are executing a specification.**

Your job:
- Build Feature #1 (Domain Events) bulletproof
- Then build Features #2–9 following the exact same pattern
- Prevent architectural drift by flagging deviations
- Raise ambiguities instead of inventing workarounds
- Optimize for correctness and consistency, not speed

---

## The Implementation Roadmap

| Phase | Features | Timeline | Objective |
|-------|----------|----------|-----------|
| **1** | Domain Events, Matter Record, Output Contracts, Conflict Engine | Weeks 1–6 | Prove the architecture end-to-end |
| **2** | Scheduling, Deadlines, Calendar, Timeline | Weeks 7–12 | Court calendar integration |
| **3** | Legal Issues, Arguments, Evidence, Risk Engine | Weeks 13–18 | Legal analysis structure |
| **4** | Negotiation, Settlement, Negotiation Engine | Weeks 19–24 | Dispute resolution workflows |
| **5** | Witnesses, Testimony, Exam Scheduling | Weeks 25–30 | Witness management |
| **6** | Document Templates, Assembly | Weeks 31–36 | Automated drafting |
| **7** | Analytics, Reporting, Dashboards | Weeks 37–42 | Firm metrics |
| **8** | AI Enrichment (Classification, Entity Extraction, Risk) | Weeks 43–48 | Intelligent assistance (non-blocking) |
| **9** | Compliance, Audit, Data Retention | Weeks 49–52 | Regulatory readiness |

---

## Non-Negotiable Standards

Every implementation must satisfy these. Zero exceptions.

### Code

- [ ] Repository pattern only (no Activities touching the database)
- [ ] Output Contracts only (no direct writes from elsewhere)
- [ ] Domain events only (no Activities calling Engines)
- [ ] Transaction boundaries via UnitOfWork
- [ ] All writes traceable (`source_activity_id`)
- [ ] No raw SQL outside repositories
- [ ] No business logic in Activities
- [ ] No business logic in UI
- [ ] No Engine writes to Matter Record
- [ ] All new tables have RLS enabled

### Testing

- [ ] Unit tests for Output Contracts (fake repos, no DB)
- [ ] Integration tests for Repositories (real DB)
- [ ] Subscriber tests for Engines (fake events)
- [ ] Query tests for Projections
- [ ] 80%+ code coverage on new code

### Naming

- [ ] Tables: `snake_case`, plural
- [ ] Events: `<entity>_<past_tense>` (`hearing_scheduled`)
- [ ] Contracts: `<Activity>OutputContract`
- [ ] Repository methods: verb + entity (`createHearing`, not `insert`)
- [ ] Booleans: `is<Adjective>` (`isFinalised`)

### Deployment

- [ ] Database migrations tested and reversible
- [ ] RLS policies enforced
- [ ] No sensitive data in logs
- [ ] Production deployment ready

---

## What Must Never Happen

15 anti-patterns are documented in Part 12 of the Engineering Implementation Package. They are strictly forbidden.

Examples:
- ❌ Activities writing SQL
- ❌ Engines writing to Matter Record
- ❌ Duplicate entities (negotiation_parties instead of reusing matter_people)
- ❌ Projections persisting data
- ❌ Business logic in UI
- ❌ Generic repository methods (find, insert, query)
- ❌ Skipping validation
- ❌ Direct Engine-to-Engine communication

If you spot an anti-pattern in existing code, flag it for refactoring. Do not replicate it.

---

## Decision-Making Protocol

When you face a decision:

**Step 1:** Check the Handbook (Part 1–9)  
**Step 2:** Check the Implementation Package (Part 1–12)  
**Step 3:** Check this summary  
**Step 4:** If still unclear, raise the issue. Do not invent a solution.

---

## Definition of Done (Complete Feature)

A feature ships when:

- ✅ Architecture compliance verified (follows lifecycle exactly)
- ✅ All acceptance criteria met
- ✅ All tests pass (unit + integration)
- ✅ Code reviewed and approved
- ✅ Database migrations tested
- ✅ No regressions in other features
- ✅ Production deployment ready

---

## If Architecture Reveals a Genuine Limitation

This is the only path to amending the frozen architecture:

1. **Concrete implementation attempt** that hit the limitation (not hypothetical)
2. **Written ADR (Architecture Decision Record)** explaining:
   - What rule it violated
   - Why the rule didn't fit
   - What you're proposing instead
3. **Explicit sign-off** before the exception is generalized

See **Part 10.2** (Architecture Decision Record Template) in the Handbook.

---

## Starting Point

**You are here:**

- Architecture is frozen ✅
- Specifications are complete ✅
- Documentation is comprehensive ✅

**Next:**

1. Read the three documents (Handbook, Package, Kickoff)
2. Study the Schedule Hearing reference implementation
3. Begin Feature #1: Domain Events Infrastructure
4. Prove the architecture end-to-end
5. Everything else flows from there

---

## The Biggest Risk Now

**Architectural drift.**

Not poor code. Not missing features. Not performance issues.

**Drift** — one feature cuts a corner, the next team member copies it, and within three features the architecture is unrecognizable.

Your job is to:
- Follow the specification exactly
- Flag deviations immediately
- Prevent shortcuts
- Optimize for correctness and consistency

**Do this right, and in 2–3 years you'll have a platform that's easy to extend, a pleasure to work with, and auditable end-to-end.**

---

## Documents

- `platform-engineering-handbook.md` — Philosophy and principles
- `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` — Roadmap and standards
- `ENGINEERING_KICKOFF.md` — Transition to execution
- `ARCHITECTURE_FREEZE_SUMMARY.md` — This document

All four are canonical. Print them. Refer to them constantly. They are your specification.

---

**Frozen:** 2026-07-29  
**Status:** No redesign permitted  
**Next milestone:** Feature #1 complete and merged  
**Review:** After Feature #1 (will validate that architecture holds)

---

Good luck. Build it right.
