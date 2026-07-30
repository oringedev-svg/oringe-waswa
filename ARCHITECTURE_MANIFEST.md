# Architecture Manifest

**Complete Platform Specification — All Files Accounted For**

This manifest lists every document that defines the Oringe platform architecture and implementation roadmap. Everything you need to build the platform over 2–3 years is in this directory.

---

## The Five Canonical Documents

Read in this order:

### 1. START_HERE.md
**Purpose:** Navigation and orientation  
**Audience:** Everyone  
**Read Time:** 5 minutes  
**What it does:**
- Explains the complete documentation set
- Provides checklists for different roles (new engineer, feature designer, implementer)
- Links to all other documents
- Summarizes the feature lifecycle and five layers

**Next step after reading:** Read the Handbook

---

### 2. platform-engineering-handbook.md
**Purpose:** Architectural philosophy and principles  
**Audience:** Everyone, especially architects and lead engineers  
**Read Time:** 15 minutes  
**What it contains (10 parts):**
- **Part 1:** Vision (event-driven legal operating system)
- **Part 2:** Five layers (Workflow, Matter Record, Knowledge Hub, Engine, Presentation)
- **Part 3:** Feature lifecycle (UI → Activity → Contract → Repository → Record → Event → Engine → Projection)
- **Part 4:** Output Contracts (validation, repositories, transactions, testing)
- **Part 5:** Repository pattern (interfaces, testability, dependency injection)
- **Part 6:** Domain events and Engines (subscribers, idempotency, promotion)
- **Part 7:** Knowledge Hubs (purpose, design, adding new hubs)
- **Part 8:** Matter Record standards (naming, ownership, immutability, relationships)
- **Part 9:** Development standards (folder structure, dependency injection, logging, testing)
- **Part 10:** How to add a new feature (decision checklist, ADR template, amendment process)

**Key insight:** This handbook is **frozen**. Changes require concrete evidence of architectural limitation + ADR + explicit sign-off.

**Next step after reading:** Read the Implementation Package

---

### 3. ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md
**Purpose:** Practical roadmap for 2–3 years of implementation  
**Audience:** Engineers, team leads  
**Read Time:** 30 minutes  
**What it contains (13 parts):**
- **Part 1:** Implementation roadmap (9 phases, 2 weeks each, hard dependencies)
- **Part 2:** Complete repository structure (all folders prescribed)
- **Part 3:** Feature development blueprint (exact template for every feature)
- **Part 4:** Reference vertical slice (Schedule Hearing example)
- **Part 5:** Repository interfaces (all repositories needed with responsibilities)
- **Part 6:** Engine catalogue (12 engines: purpose, inputs, outputs)
- **Part 7:** Knowledge Hub catalogue (14 hubs: purpose, ownership)
- **Part 8:** Projection catalogue (major UI views: read-only queries)
- **Part 9:** Engineering standards (naming, transactions, logging, testing, validation, DI, error handling)
- **Part 10:** First 20 features (ordered by dependency)
- **Part 11:** Future expansion (how new practice areas plug in)
- **Part 12:** What must never be done (15 anti-patterns blacklist)
- **Part 13:** Production-ready composition root example

**Key insight:** This is your specification. Implement it as written.

**Next step after reading:** Read the Kickoff

---

### 4. ENGINEERING_KICKOFF.md
**Purpose:** Transition from architecture to implementation  
**Audience:** Development team  
**Read Time:** 10 minutes  
**What it establishes:**
- Core non-negotiable rules (do not redesign, do not introduce patterns)
- Immediate objective (Feature #1: Domain Events Infrastructure)
- Implementation order (Features #1–9 in strict sequence)
- Deliverables per feature
- Definition of done
- Decision-making framework
- Priority: correctness over speed

**Key insight:** From this point onwards, you are executing a specification, not making architectural decisions.

**Next step after reading:** Begin Feature #1

---

### 5. ARCHITECTURE_FREEZE_SUMMARY.md
**Purpose:** Quick reference and recap  
**Audience:** Everyone  
**Read Time:** 5 minutes  
**What it provides:**
- Core architecture in one page (five layers diagram)
- Why this architecture matters (prevents catastrophic failure mode)
- The team's new responsibility
- Non-negotiable standards
- What must never happen
- Biggest risk now (architectural drift)

**When to use:** Whenever you need a reminder of the frozen architecture or the five layers

---

## Reference Implementation Files

These are production-ready examples to study and follow:

### 6. schedule-hearing.output-contract.ts
**Purpose:** Reference implementation of an Output Contract  
**Audience:** Engineers implementing features  
**What it shows:**
- Input schema with Zod validation
- Matter Record entity types
- Repository interfaces (Matter Record, Knowledge Hub, Event Publisher)
- The complete `execute()` method showing:
  - Shape validation
  - Referential validation (Knowledge Hub lookups)
  - Matter Record write via Repository
  - Timeline append (one transaction)
  - Domain event emission (after commit)

**How to use:** Copy this structure for every new Output Contract. It is the pattern.

**Key learnings:**
- Activity layer never touches the database
- Contracts are the only authorised write path
- Knowledge Hub references are validated server-side
- All writes in one transaction
- Event published after commit, never before
- No Engine is called directly; all subscribe asynchronously

---

### 7. hearings_and_courts_schema.sql
**Purpose:** Reference schema for Knowledge Hub + Matter Record layer  
**Audience:** Database engineers  
**What it defines:**
- **Knowledge Hub tables:** `court_divisions`, `judges`, `registry_contacts`, `filing_requirements`
- **Matter Record table:** `hearings` (and `hearing_documents` junction)
- **RLS policies:** Firm isolation on all tables, public_read on Hub data
- **Indexes:** For performance on common queries (matter_id, date, judge_id)
- **Relationships:** Knowledge Hub cascading (court → division → judge)

**How to use:** This is the exact pattern for every new Matter Record table:
1. Create the table with `firm_id` + `source_activity_id`
2. Add soft-delete (`deleted_at`)
3. Enable RLS immediately
4. Create policies (firm_isolation, possibly public_read for Hubs)
5. Add indexes on frequently queried columns

**Key learnings:**
- Every Matter Record write has `source_activity_id` (traceability)
- Knowledge Hub is read-only; Matter Record links via FK (never denormalized copies)
- RLS enforces firm isolation at the database level
- One hearing → one calendar event (via FK link, not duplicate data)

---

## How to Use These Files

### Scenario 1: You're New to the Project
1. Read `START_HERE.md` (5 min) — understand the documentation
2. Read `platform-engineering-handbook.md` (15 min) — understand philosophy
3. Read `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` (30 min) — understand roadmap
4. Study `schedule-hearing.output-contract.ts` (20 min) — understand implementation pattern
5. Read `ENGINEERING_KICKOFF.md` (10 min) — understand your role
6. You now understand the entire platform architecture (80 minutes)

### Scenario 2: You're Designing a Feature
1. Check `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` Part 10 — Feature Development Blueprint
2. Check `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` Parts 5–9 — Repositories, Engines, Hubs, Projections
3. Study `schedule-hearing.output-contract.ts` — copy this pattern
4. Check `hearings_and_courts_schema.sql` — copy this schema pattern
5. Design your feature following the exact same lifecycle

### Scenario 3: You're Implementing a Feature
1. Follow `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` Part 3 — Feature Development Blueprint
2. Use `schedule-hearing.output-contract.ts` as your template
3. Use `hearings_and_courts_schema.sql` as your schema template
4. Refer to `ENGINEERING_KICKOFF.md` Core Rules constantly
5. Before submitting a PR, check against `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` Part 12 (anti-patterns blacklist)

### Scenario 4: You Hit a Decision Point
1. Check `platform-engineering-handbook.md` (all parts)
2. Check `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` (all parts)
3. Check `ARCHITECTURE_FREEZE_SUMMARY.md` (quick answers)
4. If still unclear, **raise the issue instead of inventing a solution**

### Scenario 5: You Spot Something Wrong
1. If it's existing code violating anti-patterns: flag for refactoring, don't replicate
2. If it's a genuine architectural limitation: write an ADR (see Handbook Part 10.2)
3. If it's unclear: ask before coding

---

## File Sizes & Purposes

| File | Size | Purpose | Read When |
|------|------|---------|-----------|
| **START_HERE.md** | 13 KB | Navigation guide | First thing, always |
| **platform-engineering-handbook.md** | 35 KB | Philosophy & principles | Deep understanding needed |
| **ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md** | 67 KB | Roadmap & standards | Planning features, before coding |
| **ENGINEERING_KICKOFF.md** | 16 KB | Implementation rules | Transition to execution |
| **ARCHITECTURE_FREEZE_SUMMARY.md** | 11 KB | Quick reference | Need a reminder |
| **schedule-hearing.output-contract.ts** | 8 KB | Reference code | Before implementing any feature |
| **hearings_and_courts_schema.sql** | 6 KB | Reference schema | Before adding any table |
| **ARCHITECTURE_MANIFEST.md** | This file | Index & usage guide | Getting oriented |

---

## The Feature Lifecycle (Memorize This)

Every feature, without exception, follows this path:

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
| **Workflow (Activity)** | Decide what work happens, who does it, when | ScheduleHearingActivity |
| **Matter Record** | Permanent legal facts about a case | `hearings`, `legal_issues`, `negotiations` |
| **Knowledge Hub** | Reference data independent of any case | Courts, Judges, Practice Areas |
| **Engines** | Compute derived output asynchronously | DeadlineEngine, ConflictEngine |
| **Presentation (Projection)** | Display all layers via pure queries | Calendar, Timeline, Dashboard |

---

## Immediate Next Steps

**Monday morning:**

1. Print or bookmark all five canonical documents
2. Read `START_HERE.md` (5 minutes)
3. Read `platform-engineering-handbook.md` (15 minutes)
4. Read `ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md` (30 minutes)
5. Study `schedule-hearing.output-contract.ts` (20 minutes)
6. Read `ENGINEERING_KICKOFF.md` (10 minutes)

**After that:**

- Begin Feature #1: Domain Events Infrastructure (2 weeks)
- Follow the exact pattern for Features #2–9
- Every feature uses the same lifecycle

---

## The Biggest Risk Now

**Architectural drift.**

Not poor code. Not missing features. Not performance issues.

One feature cuts a corner → next team copies it → within three features the architecture is unrecognizable → features that took 2 weeks now take 8 weeks.

These documents exist to prevent that. They make the architecture so explicit that shortcuts are impossible.

**Your job:** Follow the specification exactly. Flag deviations. Raise ambiguities instead of inventing solutions.

---

## Status

- ✅ **Architecture:** Frozen (see Handbook "How This Handbook May Be Amended")
- ✅ **Implementation Roadmap:** 9 phases, 2 weeks each, hard dependencies defined
- ✅ **Repository Structure:** Complete folder map prescribed
- ✅ **Feature Template:** Blueprint for every feature (reference implementation provided)
- ✅ **Engineering Standards:** Naming, testing, transactions, DI, validation all documented
- ✅ **Reference Implementation:** Schedule Hearing (schema + contract)
- ✅ **Anti-patterns Blacklist:** 15 violations strictly forbidden
- ✅ **Decision Framework:** How to resolve ambiguity without inventing solutions

**No ambiguity remains. There are no unanswered questions about how to build this platform.**

The only risk is that someone invents a shortcut instead of following the specification.

---

## Print This Stack

Everything you need is in this directory:

```
oringe-waswa/
├── START_HERE.md                                    ← Read this first
├── platform-engineering-handbook.md                 ← Philosophy
├── ENGINEERING_IMPLEMENTATION_PACKAGE_v1.0.md       ← Roadmap
├── ENGINEERING_KICKOFF.md                           ← Implementation rules
├── ARCHITECTURE_FREEZE_SUMMARY.md                   ← Quick reference
├── ARCHITECTURE_MANIFEST.md                         ← This file
├── schedule-hearing.output-contract.ts              ← Reference implementation
├── hearings_and_courts_schema.sql                   ← Reference schema
└── [rest of project]
```

Pin these eight files in Slack. Refer to them constantly. They are your authoritative specification.

---

**Document Version:** 1.0  
**Effective:** 2026-07-29  
**Architecture Status:** Frozen  
**Implementation:** Ready to begin  

Good luck. Build it right.
