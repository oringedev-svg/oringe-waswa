# Engineering Implementation Package v1.0

**Status: Production-Ready Implementation Manual**

This document is the engineer's complete roadmap for building the platform over 2–3 years. It is derived from the frozen architecture (see `platform-engineering-handbook.md`). **Do not redesign. Do not introduce new concepts. Implement as specified.**

---

## PART 1: Implementation Roadmap

### Phase Architecture

Implementation is organized into four phases, each with hard dependencies on prior phases. Each phase unlocks new capabilities and stabilizes architectural patterns.

---

### PHASE 1: Foundation & Legal Intake (Weeks 1–6)

**Objective:** Establish the event-driven architecture by implementing the simplest legal workflow: public intake form → matter creation → conflict check.

**Deliverables:**
- Domain events infrastructure (publish/subscribe with at-least-once guarantees)
- Output Contracts pattern validated with intake workflow
- Repository abstraction working with real Postgres
- RLS policies for firm isolation
- First Matter Record entities: `legal_matters`, `matter_people`
- First Engine: Conflict Engine (reads, no writes)

**Dependencies:**
- Supabase PostgreSQL with existing RLS infrastructure
- Existing `submissions` table
- Domain event bus (in-process, Redis-backed, or queue-backed)

**Key Acceptance Criteria:**
1. ✅ Public submits intake form → `submissions` created
2. ✅ Output Contract validates and creates `legal_matters` row
3. ✅ `hearing_scheduled` event emitted on matter creation
4. ✅ Conflict Engine subscribes, computes conflicts, stores result in `conflict_engine_results` (status: proposed)
5. ✅ User can promote Engine output via a "Confirm Conflict" Activity
6. ✅ Zero partial writes on any failure (transaction boundaries proven)
7. ✅ All writes through Output Contracts, never raw SQL from Activity layer
8. ✅ RLS enforces firm isolation on all new Matter Record tables

**Estimated Complexity:** **MEDIUM**
- Event bus integration is the architectural linchpin; get this right.
- Repository pattern is new to the team; expect one full week of design debate.
- RLS policies already exist; copy the pattern.

**Deliverable Code Structure:**
```
src/
  activities/
    intake/
      ReceiveSubmissionActivity.ts
      intake.contract.ts
      intake.repository.ts
      intake.contract.test.ts
      intake.repository.test.ts
      
  engines/
    ConflictEngine/
      subscriber.ts
      conflict.repository.ts
      conflict.test.ts
      
  knowledge-hub/
    (none yet)
    
  projections/
    SubmissionList.ts
    MatterFile.ts
```

---

### PHASE 2: Scheduling & Deadlines (Weeks 7–12)

**Objective:** Implement Schedule Hearing (the reference vertical slice) plus the Deadline Engine, proving the architecture handles court calendars and cascading legal deadlines.

**Deliverables:**
- Knowledge Hub: `courts`, `court_divisions`, `judges`, `registry_contacts`, `filing_requirements`
- Matter Record: `hearings`, `hearing_documents`
- Output Contracts: ScheduleHearing (reference implementation exists)
- Domain Event: `hearing_scheduled`
- Engine: DeadlineEngine (computes dates, stores proposed; user promotes via Activity)
- Calendar Projection (pure query over `hearings` + `calendar_events`)
- Timeline Projection (all `matter_stage_history` events)

**Dependencies:**
- Phase 1 complete: Domain events, Output Contracts pattern, RLS
- Supabase storage for Knowledge Hub seeding

**Key Acceptance Criteria:**
1. ✅ Lawyer schedules hearing → `hearings` row created via ScheduleHearingOutputContract
2. ✅ Hearing appears in Calendar and Timeline without extra writes
3. ✅ `hearing_scheduled` event emitted
4. ✅ DeadlineEngine subscribes, computes filing deadlines (based on judge preferences from Hub)
5. ✅ Proposed deadlines stored in `deadline_engine_results`, status: proposed
6. ✅ Lawyer can review and promote deadlines via "Confirm Deadline" Activity
7. ✅ Knowledge Hub read-only from contract perspective (court/division/judge refs valid)
8. ✅ Calendar shows only scheduled hearings; no deadlines auto-written to Matter Record

**Estimated Complexity:** **MEDIUM-HIGH**
- Deadline computation logic is domain-specific; collaborate with domain expert.
- Calendar projection query must be efficient (large matter files = large hearing lists).
- Judge preferences as JSONB require careful validation.

**Deliverable Code Structure:**
```
src/
  activities/
    hearing/
      ScheduleHearingActivity.ts
      schedule-hearing.contract.ts
      schedule-hearing.repository.ts
      schedule-hearing.contract.test.ts
      schedule-hearing.repository.test.ts
      
  engines/
    DeadlineEngine/
      subscriber.ts
      deadline.repository.ts
      deadline.test.ts
      
  knowledge-hub/
    courts/
      courts.repository.ts
    judges/
      judges.repository.ts
    divisions/
      divisions.repository.ts
    registry/
      registry.repository.ts
      
  projections/
    Calendar.ts
    Timeline.ts
```

---

### PHASE 3: Evidence, Legal Issues & Arguments (Weeks 13–18)

**Objective:** Extend Matter Record to hold legal analysis. Prove that complex linked structures (Issue → Argument → Authority → Evidence) follow the same pattern.

**Deliverables:**
- Matter Record: `legal_issues`, `legal_arguments`, `legal_authorities`, `evidence_metadata`
- Output Contracts: RaiseIssue, AddArgument, CiteAuthority, LinkEvidence (each a small contract)
- Engine: LegalAnalysisEngine (optional; produces risk/coverage suggestions)
- Legal Issues Projection (tree view of issue → argument → evidence)

**Dependencies:**
- Phase 2 complete: Knowledge Hub pattern
- New Knowledge Hub: `legal_authorities`, `legal_instruments`, `coverage_areas`

**Key Acceptance Criteria:**
1. ✅ Lawyer raises legal issue for matter → `legal_issues` row, emits event
2. ✅ Lawyer adds argument supporting/opposing issue → `legal_arguments` row
3. ✅ Lawyer cites authority (case law, statute) → `legal_authorities` KB ref + `legal_argument_authorities` junction
4. ✅ Lawyer links evidence to argument → `evidence_metadata` metadata on `legal_documents`, not a separate entity
5. ✅ LegalAnalysisEngine (if built) produces risk score (optional, status: proposed)
6. ✅ Projection shows clean tree: Issue (status, date) → Arguments → Citations → Evidence counts

**Estimated Complexity:** **MEDIUM**
- Entity relationships are straightforward; the risk is over-normalizing.
- LegalAnalysisEngine is optional in Phase 3; can be Phase 4 if time is tight.

---

### PHASE 4: Negotiation & Settlement (Weeks 19–24)

**Objective:** Model negotiation workflow: offers, counter-offers, acceptance, settlement.

**Deliverables:**
- Matter Record: `negotiations`, `negotiation_offers`
- Output Contracts: BeginNegotiation, MakeOffer, AcceptOffer, SettleCase
- Engine: NegotiationInsightEngine (tracks momentum, highlights stalled offers)
- Negotiation Timeline Projection

**Dependencies:**
- Phase 3 complete: Evidence and Issue structures
- Domain expert input on negotiation lifecycle

**Key Acceptance Criteria:**
1. ✅ Lawyer begins negotiation (parties, scope, opening position) → records as `negotiations` row
2. ✅ Lawyer makes offer → `negotiation_offers` row with amount, terms, expiry
3. ✅ Counter-offer recorded (party/date/amount/terms)
4. ✅ NegotiationInsightEngine detects stalled (no movement > 14 days) or converging
5. ✅ Lawyer accepts final offer → triggers SettleCase Activity if configured
6. ✅ Projection shows offer timeline with visual convergence

**Estimated Complexity:** **MEDIUM**

---

### PHASE 5: Testimony & Witness Management (Weeks 25–30)

**Objective:** Record and track witness testimony, exam schedules, and cross-examination notes.

**Deliverables:**
- Matter Record: `matter_people` with role = 'witness', `witness_testimony`, `exam_schedules`
- Output Contracts: ScheduleExamination, RecordTestimony, UpdateExamStatus
- Engine: WitnessPreparednessEngine (tracks readiness, flags missing affidavits)

**Dependencies:**
- Phase 2 complete: Hearing and Calendar infrastructure
- Phase 3 complete: Evidence structures

**Estimated Complexity:** **LOW-MEDIUM**
- Reuses existing `matter_people` table; minimal new structure.

---

### PHASE 6: Document Assembly & Templates (Weeks 31–36)

**Objective:** Enable lawyers to generate documents from templates (pleadings, affidavits, memoranda).

**Deliverables:**
- Knowledge Hub: `document_templates`, `template_variables`
- Output Contracts: GenerateDocument (validates variable bindings, creates `legal_documents`)
- Engine: DocumentQualityEngine (optional; checks completeness)

**Dependencies:**
- Phase 3 complete: Evidence and Legal Issues (populate template variables)

**Estimated Complexity:** **MEDIUM-HIGH**
- Template rendering engine; choose early (Handlebars, Liquid, custom).
- Variable binding validation is critical; test exhaustively.

---

### PHASE 7: Reporting & Analytics (Weeks 37–42)

**Objective:** Dashboards, reports, and metrics over all recorded legal work.

**Deliverables:**
- Analytics Engine (read-only, no writes, materialised views for performance)
- Dashboards: Firm overview, practice area breakdown, case pipeline
- Reports: Matter closure rates, billing realization, deadline adherence
- Client Portal: Retained matters, document access (read-only)

**Dependencies:**
- All prior phases complete
- BI tool integration (Metabase, Grafana, or in-house)

**Estimated Complexity:** **MEDIUM**
- All data already exists; this is pure querying.
- Performance: materialised views for heavy aggregations.

---

### PHASE 8: AI Enrichment & Automation (Weeks 43–48)

**Objective:** Non-blocking AI suggestions: classification, entity extraction, risk assessment, drafting aids.

**Deliverables:**
- Classification Engine (matter type + practice area suggestions)
- Entity Extraction Engine (parties, locations, key dates from documents)
- Risk Assessment Engine (conflict, coverage, reputational)
- Drafting Engine (email templates, clause suggestions)
- All produce Engine output (status: proposed); lawyers confirm before promotion

**Dependencies:**
- All prior phases complete
- NER model selection (spaCy, GLiNER, or LLM with fallback)
- LLM provider (Claude, GPT, or OSS)

**Key Principle:** Engines propose; humans confirm. Never auto-mutate the record.

**Estimated Complexity:** **HIGH**
- Model integration, prompt engineering, drift monitoring.
- Fallback to rules/embeddings if AI is unavailable.

---

### PHASE 9: Compliance & Audit (Weeks 49–52)

**Objective:** Demonstrate compliance: audit trails, permission enforceability, data lineage.

**Deliverables:**
- Audit Log Projection (all writes + who did it + when)
- Compliance Report: Evidence trail for every Matter Record mutation
- Data Retention Policy enforcement
- Export for legal holds

**Dependencies:**
- All phases complete

**Estimated Complexity:** **LOW**
- Audit data already exists (source_activity_id, created_at, domain_events).
- This is reporting on existing structure.

---

## PART 2: Repository Structure

This is the complete folder structure every feature must follow. Features scattered outside this structure are not architecture-compliant.

```
src/

├── activities/
│   ├── intake/
│   │   ├── activity.ts              # Activity definition
│   │   ├── intake.contract.ts       # Output Contract
│   │   ├── intake.repository.ts     # Repository impl
│   │   ├── intake.contract.test.ts  # Unit tests
│   │   └── intake.repository.test.ts # Integration tests
│   │
│   ├── hearing/
│   │   ├── activity.ts
│   │   ├── schedule-hearing.contract.ts
│   │   ├── schedule-hearing.repository.ts
│   │   ├── schedule-hearing.contract.test.ts
│   │   └── schedule-hearing.repository.test.ts
│   │
│   ├── legal-issue/
│   │   ├── activity.ts
│   │   ├── raise-issue.contract.ts
│   │   ├── raise-issue.repository.ts
│   │   ├── raise-issue.contract.test.ts
│   │   └── raise-issue.repository.test.ts
│   │
│   └── [capability]/
│       ├── activity.ts
│       ├── [capability].contract.ts
│       ├── [capability].repository.ts
│       ├── [capability].contract.test.ts
│       └── [capability].repository.test.ts
│
├── engines/
│   ├── ConflictEngine/
│   │   ├── subscriber.ts            # Event handler
│   │   ├── conflict.repository.ts   # Engine output table accessor
│   │   ├── conflict.test.ts         # Unit tests
│   │   └── types.ts                 # Engine output types
│   │
│   ├── DeadlineEngine/
│   │   ├── subscriber.ts
│   │   ├── deadline.repository.ts
│   │   ├── deadline.test.ts
│   │   └── types.ts
│   │
│   ├── RiskAssessmentEngine/
│   ├── NegotiationInsightEngine/
│   ├── DocumentQualityEngine/
│   ├── WitnessPreparednessEngine/
│   ├── ClassificationEngine/
│   ├── EntityExtractionEngine/
│   └── [engine-name]/
│       ├── subscriber.ts
│       ├── [engine-name].repository.ts
│       ├── [engine-name].test.ts
│       └── types.ts
│
├── knowledge-hub/
│   ├── courts/
│   │   ├── courts.repository.ts     # Read-only interface + impl
│   │   ├── courts.test.ts
│   │   └── types.ts
│   │
│   ├── judges/
│   │   ├── judges.repository.ts
│   │   ├── judges.test.ts
│   │   └── types.ts
│   │
│   ├── court-divisions/
│   ├── registry-contacts/
│   ├── filing-requirements/
│   ├── practice-areas/
│   ├── legal-authorities/
│   ├── legal-instruments/
│   ├── document-types/
│   ├── industries/
│   ├── professional-types/
│   ├── coverage-areas/
│   └── [hub-name]/
│       ├── [hub-name].repository.ts
│       ├── [hub-name].test.ts
│       └── types.ts
│
├── repositories/
│   ├── matter-record/
│   │   ├── MatterRecordRepository.ts  # Interface
│   │   ├── PostgresMatterRecordRepository.ts # Impl
│   │   └── matter-record.test.ts      # Integration tests
│   │
│   ├── knowledge-hub/
│   │   ├── KnowledgeHubRepository.ts  # Composed interface
│   │   ├── index.ts                   # Aggregates all Hubs
│   │   └── knowledge-hub.test.ts
│   │
│   ├── event-bus/
│   │   ├── EventBus.ts               # Interface
│   │   ├── RedisEventBus.ts          # Impl
│   │   └── event-bus.test.ts
│   │
│   └── UnitOfWork.ts                 # Transaction boundary
│
├── projections/
│   ├── calendar/
│   │   ├── query.ts                  # Pure read query
│   │   ├── Calendar.tsx              # React component
│   │   └── calendar.test.ts
│   │
│   ├── timeline/
│   │   ├── query.ts
│   │   ├── Timeline.tsx
│   │   └── timeline.test.ts
│   │
│   ├── matter-file/
│   │   ├── query.ts
│   │   ├── MatterFile.tsx
│   │   └── matter-file.test.ts
│   │
│   ├── kanban/
│   │   ├── query.ts
│   │   ├── Kanban.tsx
│   │   └── kanban.test.ts
│   │
│   ├── dashboard/
│   │   ├── query.ts
│   │   ├── Dashboard.tsx
│   │   └── dashboard.test.ts
│   │
│   ├── legal-issues-tree/
│   │   ├── query.ts
│   │   ├── LegalIssuesTree.tsx
│   │   └── legal-issues-tree.test.ts
│   │
│   ├── client-portal/
│   │   ├── query.ts
│   │   ├── ClientPortal.tsx
│   │   └── client-portal.test.ts
│   │
│   ├── reports/
│   │   ├── case-closure-rate.query.ts
│   │   ├── CaseClosureReport.tsx
│   │   └── reports.test.ts
│   │
│   └── [projection-name]/
│       ├── query.ts
│       ├── View.tsx
│       └── [projection-name].test.ts
│
├── domain-events/
│   ├── types.ts                      # All domain event types
│   ├── DomainEvent.ts               # Base event interface
│   ├── hearing_scheduled.ts
│   ├── matter_created.ts
│   ├── conflict_check_requested.ts
│   ├── [event-name].ts
│   └── __tests__/
│       └── domain-events.test.ts
│
├── lib/
│   ├── db/
│   │   ├── client.ts               # Supabase client setup
│   │   ├── rls.ts                  # RLS helper functions
│   │   └── migrations.ts
│   │
│   ├── errors/
│   │   ├── ValidationError.ts
│   │   ├── NotFoundError.ts
│   │   ├── ConflictError.ts
│   │   ├── ConcurrencyError.ts
│   │   └── PersistenceError.ts
│   │
│   ├── di/
│   │   ├── CompositionRoot.ts      # DI setup
│   │   ├── test-container.ts       # Test DI
│   │   └── production-container.ts # Prod DI
│   │
│   ├── logging/
│   │   ├── logger.ts               # Structured logging
│   │   └── audit-log.ts
│   │
│   └── validators/
│       ├── zod-schemas.ts
│       └── custom-validators.ts
│
├── api/
│   ├── activities/
│   │   ├── intake.ts               # Activity endpoint
│   │   ├── hearing.ts
│   │   ├── [capability].ts
│   │   └── route.ts                # Main activity route
│   │
│   └── [other api routes]/
│
├── ui/
│   ├── activities/
│   │   ├── IntakeForm.tsx          # Activity UI
│   │   ├── ScheduleHearingForm.tsx
│   │   └── [capability]Form.tsx
│   │
│   ├── admin/
│   │   └── [admin panels]/
│   │
│   └── [app pages]/
│
└── tests/
    ├── fixtures/
    │   ├── matter.fixtures.ts
    │   ├── hearing.fixtures.ts
    │   └── [entity].fixtures.ts
    │
    ├── mocks/
    │   ├── MockMatterRecordRepository.ts
    │   ├── MockEventBus.ts
    │   └── Mock[Dependency].ts
    │
    └── integration/
        ├── intake.e2e.test.ts
        ├── hearing.e2e.test.ts
        └── [feature].e2e.test.ts
```

**Folder Responsibilities:**

| Folder | Responsibility |
|--------|---|
| `activities/[capability]` | Activity definition, Output Contract, concrete Repository impl, unit tests |
| `engines/[engine-name]` | Event subscriber, Engine-owned output persistence, Engine tests |
| `knowledge-hub/[hub-name]` | Read-only repository for reference data (Courts, Judges, etc.) |
| `repositories/matter-record` | Abstraction + implementation for writing Matter Record entities |
| `repositories/event-bus` | Abstraction + implementation for domain event pub/sub |
| `projections/[view-name]` | Pure-query read layer for UI; owns no business data |
| `domain-events/` | Event type definitions; single source of truth for event shapes |
| `lib/db` | Database clients, connection, RLS helpers |
| `lib/errors` | Domain-specific error types (never raw database errors) |
| `lib/di` | Dependency injection setup for all layers |
| `lib/logging` | Structured logging (JSON, queryable) |
| `lib/validators` | Shared validation schemas (Zod) |
| `api/` | HTTP endpoints that invoke Activities |
| `ui/` | React/UI components (forms, dashboards, views) |
| `tests/` | Test utilities, fixtures, mocks, integration tests |

---

## PART 3: Feature Development Blueprint

Every feature follows this exact sequence. Reorder only after an accepted ADR.

### Template: Feature "Raise Legal Issue"

#### Step 1: Domain Modeling

Ask: Does `legal_issues` exist? If not, design the entity:

```typescript
// domain-events/legal_issue_raised.ts
export interface LegalIssueRaisedEvent {
  type: "legal_issue_raised";
  firmId: string;
  matterId: string;
  payload: {
    issueId: string;
    category: string; // "procedural" | "substantive" | "evidence"
    summary: string;
    importance: "high" | "medium" | "low";
    raisedBy: string; // user ID
    raisedAt: string; // ISO date
  };
}
```

#### Step 2: Knowledge Hub References

If the feature needs reference data (practice areas, legal authorities, outcome types):

```typescript
// knowledge-hub/legal-categories/legal-categories.repository.ts
export interface LegalCategoryHubRepository {
  getIssueCategory(id: string): Promise<{ id: string; name: string } | null>;
}
```

Define the Hub table in a migration. Add to Knowledge Hub composition.

#### Step 3: Output Contract (Validated Entry Point)

```typescript
// activities/legal-issue/raise-issue.contract.ts
export class RaiseIssueOutputContract {
  constructor(
    private matterRecord: MatterRecordRepository,
    private knowledgeHub: KnowledgeHubRepository,
    private events: DomainEventPublisher,
    private firmId: string
  ) {}

  async execute(rawInput: unknown): Promise<LegalIssue> {
    const input = RaiseIssueInput.parse(rawInput);
    
    // Validate Knowledge Hub references
    const category = await this.knowledgeHub.getIssueCategory(input.categoryId);
    if (!category) throw new ValidationError("Unknown category");
    
    // Write to Matter Record (the ONLY place this happens)
    const issue = await this.matterRecord.createLegalIssue({
      matterId: input.matterId,
      categoryId: input.categoryId,
      summary: input.summary,
      sourceActivityId: input.sourceActivityId,
    });
    
    // Append to timeline
    await this.matterRecord.appendTimelineEntry({
      matterId: input.matterId,
      kind: "issue_raised",
      summary: `Legal issue raised: ${input.summary}`,
      refId: issue.id,
      sourceActivityId: input.sourceActivityId,
    });
    
    // Emit event (Engines subscribe independently)
    await this.events.publish({
      type: "legal_issue_raised",
      firmId: this.firmId,
      matterId: input.matterId,
      payload: {
        issueId: issue.id,
        category: input.categoryId,
        summary: input.summary,
      },
      occurredAt: new Date(),
    });
    
    return issue;
  }
}
```

#### Step 4: Repository Methods

```typescript
// repositories/matter-record/MatterRecordRepository.ts
export interface MatterRecordRepository {
  createLegalIssue(issue: Omit<LegalIssue, "id" | "createdAt">): Promise<LegalIssue>;
}

// repositories/matter-record/PostgresMatterRecordRepository.ts
export class PostgresMatterRecordRepository implements MatterRecordRepository {
  async createLegalIssue(issue: Omit<LegalIssue, "id" | "createdAt">): Promise<LegalIssue> {
    const { data, error } = await this.supabase
      .from("legal_issues")
      .insert([
        {
          id: randomUUID(),
          matter_id: issue.matterId,
          category_id: issue.categoryId,
          summary: issue.summary,
          source_activity_id: issue.sourceActivityId,
          created_at: new Date(),
        },
      ])
      .select()
      .single();
    
    if (error) throw new PersistenceError(error.message);
    return this.mapToIssue(data);
  }
}
```

#### Step 5: Domain Events

Event type already defined in Step 1. Verify it's in `domain-events/` folder and exported from `domain-events/types.ts`.

#### Step 6: Engine Subscriptions

If another Engine should react (e.g., RiskAssessmentEngine):

```typescript
// engines/RiskAssessmentEngine/subscriber.ts
export function subscribeToIssueRaised(eventBus: EventBus, repo: RiskAssessmentRepository) {
  eventBus.subscribe("legal_issue_raised", async (event: DomainEvent) => {
    try {
      const risks = computeRisks(event.payload);
      await repo.saveResult({
        matterId: event.matterId,
        sourceEvent: event.type,
        computedAt: new Date(),
        risks,
        status: "proposed",
      });
    } catch (err) {
      // Log and mark failed; do NOT block the original Activity
      logger.error("Risk computation failed", { event, err });
      await repo.recordFailure(event.id, err.message);
    }
  });
}
```

#### Step 7: Projection (UI Query)

```typescript
// projections/legal-issues-tree/query.ts
export async function getLegalIssuesTree(matterId: string, db: SupabaseClient) {
  const { data: issues, error: issuesError } = await db
    .from("legal_issues")
    .select("*, arguments:legal_arguments(*)")
    .eq("matter_id", matterId)
    .order("created_at");
  
  if (issuesError) throw issuesError;
  return issues;
}

// projections/legal-issues-tree/LegalIssuesTree.tsx
export function LegalIssuesTree({ matterId }) {
  const [issues] = useQuery(() => getLegalIssuesTree(matterId, supabase), [matterId]);
  
  return (
    <div>
      {issues?.map(issue => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
```

#### Step 8: API Endpoint

```typescript
// api/activities/legal-issue.ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const contract = new RaiseIssueOutputContract(
    matterRecordRepo,
    knowledgeHubRepo,
    eventBus,
    firmId
  );
  
  try {
    const issue = await contract.execute(body);
    return NextResponse.json(issue);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
```

#### Step 9: UI Form

```typescript
// ui/activities/RaiseIssueForm.tsx
export function RaiseIssueForm({ matterId, onSuccess }) {
  const [input, setInput] = useState({ summary: "", categoryId: "" });
  
  async function handleSubmit() {
    const res = await fetch("/api/activities/legal-issue", {
      method: "POST",
      body: JSON.stringify({
        matterId,
        summary: input.summary,
        categoryId: input.categoryId,
        sourceActivityId: randomUUID(),
      }),
    });
    
    if (res.ok) {
      onSuccess();
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={input.summary} onChange={(e) => setInput({ ...input, summary: e.target.value })} />
      <button>Raise Issue</button>
    </form>
  );
}
```

#### Step 10: Tests

```typescript
// activities/legal-issue/raise-issue.contract.test.ts
describe("RaiseIssueOutputContract", () => {
  it("rejects invalid category ID", async () => {
    const mockHub = {
      getIssueCategory: () => Promise.resolve(null),
    };
    
    const contract = new RaiseIssueOutputContract(
      mockMatterRecord,
      mockHub,
      mockEvents,
      "firm-1"
    );
    
    await expect(
      contract.execute({
        matterId: "matter-1",
        categoryId: "unknown",
        summary: "test",
        sourceActivityId: "activity-1",
      })
    ).rejects.toThrow("Unknown category");
  });
  
  it("emits legal_issue_raised event on success", async () => {
    const mockEvents = { publish: jest.fn() };
    const contract = new RaiseIssueOutputContract(
      mockMatterRecord,
      mockHub,
      mockEvents,
      "firm-1"
    );
    
    await contract.execute(validInput);
    
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "legal_issue_raised" })
    );
  });
});
```

---

## PART 4: Reference Vertical Slice

**Schedule Hearing** is the complete, production-ready example. Everything already exists in the files provided:

- SQL schema: `hearings_and_courts_schema.sql`
- Output Contract: `schedule-hearing.output-contract.ts`
- This is the exact template for every other feature.

**What this proves:**
1. One Activity, one Output Contract
2. One Database write (via Repository)
3. One Domain Event emission
4. Engine subscription happens independently
5. Projection queries (Calendar, Timeline) work without new tables
6. Zero direct SQL from Activity layer

---

## PART 5: Repository Interfaces

Every repository is an abstraction; the platform never calls a database client directly. Below are all repositories the platform will eventually need. Implement on-demand as features are built.

### Matter Record Repository

```typescript
export interface MatterRecordRepository {
  // Matters
  createMatter(matter: CreateMatterInput): Promise<Matter>;
  getMatter(id: string): Promise<Matter | null>;
  updateMatterStatus(id: string, status: MatterStatus): Promise<void>;
  
  // People (unified role)
  addPersonToMatter(person: AddPersonInput): Promise<MatterPerson>;
  getPersonRole(matterId: string, personId: string): Promise<string | null>;
  updatePersonRole(matterId: string, personId: string, role: string): Promise<void>;
  
  // Hearings
  createHearing(hearing: CreateHearingInput): Promise<Hearing>;
  getHearing(id: string): Promise<Hearing | null>;
  updateHearingStatus(id: string, status: HearingStatus): Promise<void>;
  getHearingsByMatter(matterId: string): Promise<Hearing[]>;
  
  // Legal Issues
  createLegalIssue(issue: CreateIssueInput): Promise<LegalIssue>;
  getLegalIssue(id: string): Promise<LegalIssue | null>;
  getLegalIssuesByMatter(matterId: string): Promise<LegalIssue[]>;
  
  // Arguments
  createArgument(arg: CreateArgumentInput): Promise<LegalArgument>;
  getArgumentsByIssue(issueId: string): Promise<LegalArgument[]>;
  
  // Authorities
  linkAuthority(link: AuthorityLink): Promise<void>;
  getAuthoritiesByArgument(argumentId: string): Promise<Authority[]>;
  
  // Evidence
  linkEvidenceToArgument(link: EvidenceLink): Promise<void>;
  getEvidenceByArgument(argumentId: string): Promise<Evidence[]>;
  
  // Documents
  createDocument(doc: CreateDocumentInput): Promise<Document>;
  getDocument(id: string): Promise<Document | null>;
  getDocumentsByMatter(matterId: string): Promise<Document[]>;
  updateDocumentStatus(id: string, status: DocumentStatus): Promise<void>;
  
  // Timeline
  appendTimelineEntry(entry: TimelineEntry): Promise<void>;
  getTimeline(matterId: string): Promise<TimelineEntry[]>;
  
  // Notes
  addNote(note: CreateNoteInput): Promise<Note>;
  getNotesByMatter(matterId: string): Promise<Note[]>;
  
  // Conflicts
  createConflictCheck(check: CreateConflictCheckInput): Promise<ConflictCheck>;
  getConflictChecksByMatter(matterId: string): Promise<ConflictCheck[]>;
  
  // Negotiations
  beginNegotiation(negotiation: CreateNegotiationInput): Promise<Negotiation>;
  makeOffer(offer: CreateOfferInput): Promise<Offer>;
  getOffersByNegotiation(negotiationId: string): Promise<Offer[]>;
  
  // Witnesses
  scheduleExamination(exam: CreateExaminationInput): Promise<Examination>;
  recordTestimony(testimony: CreateTestimonyInput): Promise<Testimony>;
  
  // Fees & Time
  logTimeEntry(entry: CreateTimeEntryInput): Promise<TimeEntry>;
  getTimeEntriesByMatter(matterId: string): Promise<TimeEntry[]>;
}
```

### Knowledge Hub Repository (Composed)

```typescript
export interface KnowledgeHubRepository {
  courts: CourtsRepository;
  courtDivisions: CourtDivisionsRepository;
  judges: JudgesRepository;
  registryContacts: RegistryContactsRepository;
  filingRequirements: FilingRequirementsRepository;
  practiceAreas: PracticeAreasRepository;
  matterTypes: MatterTypesRepository;
  documentTypes: DocumentTypesRepository;
  legalAuthorities: LegalAuthoritiesRepository;
  legalInstruments: LegalInstrumentsRepository;
  industries: IndustriesRepository;
  professionalTypes: ProfessionalTypesRepository;
  coverageAreas: CoverageAreasRepository;
}

export interface CourtsRepository {
  getCourt(id: string): Promise<Court | null>;
  listCourts(): Promise<Court[]>;
}

export interface JudgesRepository {
  getJudge(id: string): Promise<Judge | null>;
  getJudgesByDivision(divisionId: string): Promise<Judge[]>;
}
// ... similar for other hubs
```

### Event Bus Repository

```typescript
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}
```

### Engine Output Repositories

```typescript
export interface ConflictEngineRepository {
  saveResult(result: ConflictResult): Promise<void>;
  recordFailure(eventId: string, error: string): Promise<void>;
}

export interface DeadlineEngineRepository {
  saveResult(result: DeadlineResult): Promise<void>;
  getResults(matterId: string): Promise<DeadlineResult[]>;
}

export interface RiskAssessmentRepository {
  saveResult(result: RiskAssessment): Promise<void>;
}

export interface NegotiationInsightRepository {
  saveResult(result: NegotiationInsight): Promise<void>;
}

export interface DocumentQualityRepository {
  saveResult(result: QualityAssessment): Promise<void>;
}

export interface WitnessPreparednessRepository {
  saveResult(result: PreparednessAssessment): Promise<void>;
}

export interface ClassificationEngineRepository {
  saveResult(result: ClassificationResult): Promise<void>;
}

export interface EntityExtractionRepository {
  saveResult(result: ExtractionResult): Promise<void>;
}
```

### Projection Repositories (Read-Only)

```typescript
export interface CalendarProjectionRepository {
  getHearingsByDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
}

export interface TimelineProjectionRepository {
  getTimelineEntries(matterId: string): Promise<TimelineEntry[]>;
}

export interface DashboardProjectionRepository {
  getOverviewMetrics(): Promise<DashboardMetrics>;
  getPracticeAreaBreakdown(): Promise<AreaBreakdown[]>;
}

export interface ReportingRepository {
  getCaseClosureRates(period: DateRange): Promise<ClosureMetrics>;
  getBillingRealization(period: DateRange): Promise<BillingMetrics>;
}
```

---

## PART 6: Engine Catalogue

Every Engine is a subscriber to domain events. It computes derived output and stores it (status: `proposed`). Users promote results via Activities.

### Engines to Implement

| Engine | Purpose | Input Events | Knowledge Hub Deps | Output Table | Promotion Activity |
|--------|---------|--------------|-------------------|---------------|--------------------|
| **Conflict Engine** | Detect potential conflicts with existing matters/clients | `matter_created`, `matter_person_added` | Judges, Courts, Opposing parties DB | `conflict_engine_results` | `PromoteConflictDecision` |
| **Deadline Engine** | Compute filing/response deadlines from hearing dates, judge prefs | `hearing_scheduled`, `hearing_held` | Judges (filing_preferences), Filing Requirements | `deadline_engine_results` | `ConfirmDeadline` |
| **Risk Assessment Engine** | Score matter complexity, potential exposure, reputational risk | `legal_issue_raised`, `opposing_party_identified` | Practice Areas, Industries, Coverage Areas | `risk_assessments` | `ReviewRiskAssessment` |
| **Negotiation Insight Engine** | Track offer momentum, flag stalled negotiations | `offer_made`, `counter_offer_made` | (none) | `negotiation_insights` | (informational only) |
| **Document Quality Engine** | Check documents for completeness, missing signatures, exhibit refs | `document_filed`, `legal_issue_raised` | Document Types, Filing Requirements | `document_quality_checks` | (informational; no promotion) |
| **Witness Preparedness Engine** | Track affidavit status, exam schedule readiness | `witness_scheduled_for_exam`, `affidavit_filed` | (none) | `witness_preparedness` | (informational) |
| **Classification Engine** | Suggest matter type + practice area from description | `matter_created`, `submission_received` | Practice Areas, Matter Types | `classification_results` | `ConfirmClassification` |
| **Entity Extraction Engine** | Extract parties, courts, key dates from documents | `document_filed`, `submission_received` | (none; uses NER) | `extraction_results` | `ConfirmExtractedParties` |
| **Drafting Engine** | Suggest clauses, email templates, pleading sections | `legal_issue_raised`, `hearing_scheduled` | Legal Instruments, Templates | `drafting_suggestions` | (review + manual accept) |
| **Court Intelligence Engine** | Track judge rulings, outcomes, procedural quirks | `hearing_held`, `judgment_recorded` | Judges, Courts | `judge_intelligence` | (informational) |
| **Analytics Engine** | Aggregate metrics for dashboards (case closure, billing, deadlines) | All events | (none) | Materialised views | (read-only) |
| **Reminder Engine** | Trigger notifications for deadlines, upcoming hearings | `deadline_confirmed`, `hearing_scheduled` | (none) | `reminders` | (informational) |

---

## PART 7: Knowledge Hub Catalogue

All Hubs are read-only from Activities' perspective. Administered via separate UI. All soft-deleted (`deleted_at`).

| Hub | Purpose | Reused By | Ownership |
|-----|---------|-----------|-----------|
| **Courts** | Court name, type, jurisdiction, registry address | Hearings, Filing requirements | Admin—seed from judiciary data |
| **Court Divisions** | Divisions within a court (Commercial, Family, etc.) | Judges, Hearings, Filing requirements | Admin |
| **Judges** | Judge, assigned division, filing preferences (JSONB) | Hearings, Deadline Engine | Admin; advocates contribute preferences |
| **Registry Contacts** | Registrar, clerk, office hours per court/division | (informational; not directly referenced) | Admin |
| **Filing Requirements** | Document bundles, formats, timing per court/division | Document Assembly Engine, Drafting Engine | Admin—source from practice directions |
| **Practice Areas** | Employment, Commercial, Conveyancing, Debt Recovery, etc. | Classifications, Matter Types, Reports | Admin—seed from firm profile |
| **Matter Types** | Specific matter archetypes within a practice area | Classification Engine, Pipeline config | Admin—seed per firm |
| **Document Types** | Categories: Pleading, Affidavit, Judgment, Memo, Brief | Document metadata, Quality Engine | Admin |
| **Legal Authorities** | Cases, statutes, treaties, instruments | Arguments, Evidence | Admin—advocates add during matter work |
| **Legal Instruments** | Templates, contractual clauses, standard letters | Document Assembly, Drafting Engine | Admin + advocates create/refine |
| **Industries** | Client/opponent industry classification | Matter classification, Risk Engine | Admin |
| **Professional Types** | Advocate, Notary, Commissioner of Oaths, Bailiff, etc. | People roles | Admin |
| **Coverage Areas** | Geographic areas the firm operates (districts, regions) | Matter eligibility, Conflict checking | Admin |

---

## PART 8: Projection Catalogue

Projections are read-only queries over Workflow + Matter Record + Engine output. They own no business data. If a projection seems to need its own table, the fix is usually "the Matter Record or Engine layer is missing an entity."

### Major Projections

| Projection | Source Tables | Use | Materialized? |
|-----------|--------------|-----|-----------------|
| **Calendar** | `hearings`, `calendar_events` (hearing_id FK) | Lawyer day-planner | No (indexes on date) |
| **Timeline** | `matter_stage_history`, all domain_events | Matter history | No |
| **Matter File** | All Matter Record tables for one matter | Case detail view | No (joined query) |
| **Kanban** | `assignments`, pipeline stages, status | Work intake pipeline | No |
| **Dashboard** | All metrics (cases, deadlines, billing) | Firm overview | Yes (cron-refreshed materialised view) |
| **Legal Issues Tree** | `legal_issues`, `legal_arguments`, `legal_authorities`, `evidence_metadata` | Issue structure for matter | No |
| **Negotiation Timeline** | `negotiations`, `negotiation_offers` ordered by date | Offer momentum | No |
| **Witness Exam Schedule** | `hearings`, `witness_testimony`, `exam_schedules` | Exam prep status | No |
| **Client Portal** | Retained `legal_matters`, `legal_documents` (access-filtered) | Client visibility | No (filtered by RLS) |
| **Lawyer Workspace** | Assignments (owned by lawyer), messages, deadlines | Personal inbox | No |
| **Reports** (Case Closure, Billing Realization, Deadline Adherence) | All Matter Record + Time entries | Analytics | Yes (daily/weekly refresh) |
| **Audit Log** | `security_audit`, domain_events, activity logs | Compliance | No |

**Key Rule:** Every projection is either:
- A simple SELECT + join (no caching required)
- A materialised view refreshed on a schedule (cron job)

Never write business data to a projection table.

---

## PART 9: Engineering Standards

These standards are non-negotiable. Every commit must satisfy them.

### 9.1 Naming Conventions

```
Database:
  Tables: snake_case, plural (hearings, legal_issues)
  Columns: snake_case (hearing_date, source_activity_id)
  Foreign keys: <entity>_id (matter_id, judge_id)
  Enums: SCREAMING_SNAKE_CASE (SCHEDULED, HELD, ADJOURNED)
  Indexes: idx_<table>_<column> (idx_hearings_matter_id)

Domain Events:
  Type: <entity>_<past_tense> (hearing_scheduled, matter_created)
  Payload keys: camelCase (hearingDate, matterId)

TypeScript:
  Classes: PascalCase (ScheduleHearingOutputContract)
  Methods: camelCase (createHearing, appendTimelineEntry)
  Interfaces: PascalCase (MatterRecordRepository)
  Constants: SCREAMING_SNAKE_CASE (DEFAULT_RETRY_COUNT)
  Variables: camelCase (hearingDate, sourceActivityId)
  Booleans: is<Adjective> (isFinalised, isActive)
  React components: PascalCase (LegalIssuesTree, ScheduleHearingForm)
  Files: kebab-case for non-components, PascalCase.tsx for components
    activities/hearing/schedule-hearing.contract.ts
    ui/activities/ScheduleHearingForm.tsx
```

### 9.2 Transactions

**Rule:** Every Output Contract's `execute()` runs within a single database transaction. All writes succeed or all rollback.

```typescript
// Transaction boundary is managed at Repository/Unit-of-Work layer
export class PostgresMatterRecordRepository {
  async createHearing(hearing: CreateHearingInput, uow: UnitOfWork): Promise<Hearing> {
    // All writes via uow are batched
    const result = await uow.transaction(async (txn) => {
      const h = await txn.from("hearings").insert([hearing]);
      const t = await txn.from("matter_stage_history").insert([timeline]);
      return h;
    });
    return result;
  }
}

// Called from Output Contract
export class ScheduleHearingOutputContract {
  async execute(input: unknown): Promise<Hearing> {
    const uow = this.unitOfWorkFactory.create();
    try {
      const hearing = await this.matterRecord.createHearing(input, uow);
      await uow.commit();
      // Publish AFTER commit succeeds
      await this.events.publish({ type: "hearing_scheduled", ... });
      return hearing;
    } catch (err) {
      await uow.rollback();
      throw err;
    }
  }
}
```

### 9.3 Logging

Every significant operation is logged as structured JSON, queryable in production.

```typescript
// lib/logging/logger.ts
export const logger = {
  info: (message: string, context: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: "INFO", message, ...context }));
  },
  error: (message: string, error: Error, context: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: "ERROR", message, error: error.message, ...context }));
  },
};

// Usage
logger.info("Activity executed", {
  activityName: "ScheduleHearing",
  matterId,
  userId,
  result: "success",
});

logger.error("Activity failed", err, {
  activityName: "ScheduleHearing",
  matterId,
  errorType: err.constructor.name,
});
```

### 9.4 Events

Every event is a TypeScript type with a strict schema. Breaking changes require updating all subscribers in the same commit.

```typescript
// domain-events/hearing_scheduled.ts
export interface HearingScheduledEvent {
  type: "hearing_scheduled";
  firmId: string;
  matterId: string;
  payload: {
    hearingId: string;
    hearingDate: string; // ISO 8601
    courtId: string;
    judgeId?: string;
  };
  occurredAt: string;
}

// Exported for subscribers to use
export const HearingScheduledEventSchema = z.object({
  type: z.literal("hearing_scheduled"),
  firmId: z.string().uuid(),
  matterId: z.string().uuid(),
  payload: z.object({
    hearingId: z.string().uuid(),
    hearingDate: z.string().datetime(),
    courtId: z.string().uuid(),
    judgeId: z.string().uuid().optional(),
  }),
  occurredAt: z.string().datetime(),
});
```

### 9.5 Repositories

- No raw SQL or query builders in Activities.
- No generic methods (find, insert, query).
- Every method is named for the domain operation it performs.
- Concrete Repository implementations are the ONLY place SQL is written.

```typescript
// ✅ Correct
export interface MatterRecordRepository {
  createHearing(hearing: CreateHearingInput): Promise<Hearing>;
  appendTimelineEntry(entry: TimelineEntry): Promise<void>;
}

// ❌ Wrong
export interface MatterRecordRepository {
  insert(table: string, data: any): Promise<any>;
  find(table: string, where: any): Promise<any>;
}
```

### 9.6 Output Contracts

- Typed input schema (Zod or similar).
- Referential validation (Knowledge Hub lookups).
- Exactly one primary Domain Event emitted per execution.
- Transaction boundary enforced.
- Idempotency key handled.

```typescript
export class ScheduleHearingOutputContract {
  async execute(rawInput: unknown): Promise<Hearing> {
    // 1. Validate schema
    const input = ScheduleHearingInput.parse(rawInput);
    
    // 2. Validate referential integrity
    const judge = await this.knowledgeHub.getJudge(input.judgeId);
    if (!judge) throw new ValidationError("Judge not found");
    
    // 3. Write (via Repository, in transaction)
    const hearing = await this.matterRecord.createHearing(input);
    
    // 4. Emit event (after transaction commits)
    await this.events.publish({
      type: "hearing_scheduled",
      ...
    });
    
    return hearing;
  }
}
```

### 9.7 Testing

**Repository tests:** Integration tests against a real database (per repository).
**Contract tests:** Unit tests against fake repositories, no database required.
**Engine tests:** Subscriber tests with fake events and repositories.

```typescript
// activities/hearing/schedule-hearing.contract.test.ts (unit, no DB)
describe("ScheduleHearingOutputContract", () => {
  let contract: ScheduleHearingOutputContract;
  let mockMatterRecord: jest.Mocked<MatterRecordRepository>;
  let mockHub: jest.Mocked<KnowledgeHubRepository>;
  let mockEvents: jest.Mocked<DomainEventPublisher>;
  
  beforeEach(() => {
    mockMatterRecord = {
      createHearing: jest.fn().mockResolvedValue({ id: "h1", ... }),
      appendTimelineEntry: jest.fn().mockResolvedValue(undefined),
    };
    mockHub = {
      getJudge: jest.fn().mockResolvedValue({ id: "j1", ... }),
      getCourt: jest.fn().mockResolvedValue({ id: "c1", ... }),
    };
    mockEvents = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    
    contract = new ScheduleHearingOutputContract(mockMatterRecord, mockHub, mockEvents, "firm-1");
  });
  
  it("emits hearing_scheduled event", async () => {
    await contract.execute({
      matterId: "m1",
      courtId: "c1",
      judgeId: "j1",
      hearingDate: "2026-08-15",
      purpose: "hearing",
      sourceActivityId: "a1",
    });
    
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hearing_scheduled" })
    );
  });
});

// repositories/matter-record/PostgresMatterRecordRepository.test.ts (integration)
describe("PostgresMatterRecordRepository", () => {
  let repo: PostgresMatterRecordRepository;
  let db: SupabaseClient; // real connection
  
  beforeAll(async () => {
    db = createClient(...testConfig);
    repo = new PostgresMatterRecordRepository(db);
  });
  
  it("creates hearing and appends timeline in one transaction", async () => {
    const uow = repo.createUnitOfWork();
    
    await repo.createHearing(
      { matterId: "m1", courtId: "c1", ... },
      uow
    );
    
    await uow.commit();
    
    // Verify both wrote atomically
    const hearing = await db.from("hearings").select().eq("matter_id", "m1").single();
    const timeline = await db.from("matter_stage_history").select().eq("matter_id", "m1").single();
    
    expect(hearing).toBeDefined();
    expect(timeline).toBeDefined();
  });
});
```

### 9.8 Versioning & Migrations

- One migration per feature, named clearly: `001_create_hearings.sql`
- RLS enabled on all new tables immediately.
- Soft deletes (`deleted_at`) for any table that might be referenced historically.
- No data migrations in Output Contracts; only in dedicated migration scripts (which still go through Output Contracts).

```sql
-- migrations/001_create_hearings.sql
CREATE TABLE hearings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id),
  matter_id uuid NOT NULL REFERENCES legal_matters(id),
  court_id uuid NOT NULL REFERENCES courts(id),
  judge_id uuid REFERENCES judges(id),
  hearing_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'held', 'adjourned', 'vacated', 'cancelled')),
  source_activity_id uuid REFERENCES activities(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hearings_matter_id ON hearings(matter_id);
CREATE INDEX idx_hearings_date ON hearings(hearing_date);

ALTER TABLE hearings ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON hearings
  FOR ALL TO public
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());
```

### 9.9 Dependency Injection

One composition root per deployment target. Factories, containers, or plain functions—pick one and stick to it.

```typescript
// lib/di/production-container.ts
export class ProductionContainer {
  private matterRecordRepo: MatterRecordRepository;
  private knowledgeHubRepo: KnowledgeHubRepository;
  private eventBus: EventBus;
  
  constructor(supabase: SupabaseClient) {
    this.matterRecordRepo = new PostgresMatterRecordRepository(supabase);
    this.knowledgeHubRepo = new PostgresKnowledgeHubRepository(supabase);
    this.eventBus = new RedisEventBus(redis);
  }
  
  getScheduleHearingContract(): ScheduleHearingOutputContract {
    return new ScheduleHearingOutputContract(
      this.matterRecordRepo,
      this.knowledgeHubRepo,
      this.eventBus,
      this.firmId
    );
  }
  
  subscribeToEvents() {
    this.eventBus.subscribe("hearing_scheduled", (event) => {
      new DeadlineEngine(this.matterRecordRepo, this.knowledgeHubRepo).handleHearingScheduled(event);
    });
  }
}
```

### 9.10 Error Handling

No raw database errors surfaced to callers. All errors are domain-specific.

```typescript
// lib/errors/
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
  }
}

// Usage in Repository
async createHearing(hearing: CreateHearingInput): Promise<Hearing> {
  const { data, error } = await this.supabase.from("hearings").insert([hearing]).select().single();
  
  if (error?.code === "42P01") throw new NotFoundError("Matter", hearing.matterId);
  if (error?.code === "23505") throw new ConflictError("Hearing already exists");
  if (error) throw new Error(`Persistence failed: ${error.message}`);
  
  return this.mapToHearing(data);
}
```

---

## PART 10: First 20 Features (Ordered)

Build in this exact order. Each depends on prior phases.

| # | Feature | Depends On | Phase | Est. Effort | Reasoning |
|---|---------|-----------|-------|-------------|-----------|
| 1 | **Domain Events Infrastructure** | Nothing | 1 | 2 weeks | Linchpin. Everything else flows through it. Build bulletproof. |
| 2 | **Matter Record (Entities + Repositories)** | #1 | 1 | 2 weeks | Core data structure. All features reference it. |
| 3 | **Output Contract Pattern + Schedule Hearing** | #1, #2 | 1 | 1 week | Proves the architecture. Reference implementation exists. |
| 4 | **Knowledge Hub (Courts, Judges)** | #1, #2, #3 | 2 | 1 week | Grounds every future hearing/filing activity. |
| 5 | **Conflict Engine** | #1, #2 | 1 | 2 weeks | First Engine. Proves event subscription + proposal/promotion. |
| 6 | **Deadline Engine** | #3, #4 | 2 | 2 weeks | Second Engine. Cascading deadlines unlocks court workflows. |
| 7 | **Calendar Projection** | #3, #6 | 2 | 1 week | First user-facing projection. Pure query, no storage. |
| 8 | **Timeline Projection** | #2 | 2 | 1 week | Matter history view. Follows same projection pattern. |
| 9 | **Matter File Projection** | #2, #6 | 2 | 1 week | Complete case detail view. Joins all Matter Record entities. |
| 10 | **Hearings + Hearing Outcomes** | #3, #4 | 2 | 2 weeks | Hearing lifecycle from scheduled → held → outcome recorded. |
| 11 | **Legal Issues + Arguments** | #2, #3 | 3 | 2 weeks | First complex linked structure. Issue → Argument → Evidence. |
| 12 | **Authorities (Case Law, Statutes)** | #11 | 3 | 1 week | Citation management; reuses Authority KB. |
| 13 | **Risk Assessment Engine** | #11, #1 | 3 | 2 weeks | Computes risk from issues, parties, matter type. Informational. |
| 14 | **Evidence Metadata** | #11 | 3 | 1 week | Links documents to arguments. No new entity; metadata on docs. |
| 15 | **Negotiation (Begin, Offer, Counter)** | #2, #3 | 4 | 2 weeks | New workflow. Offer lifecycle → settlement Activity. |
| 16 | **Negotiation Insight Engine** | #15, #1 | 4 | 1 week | Tracks momentum. Informational; no promotion required. |
| 17 | **Witness Management (Role, Exam, Testimony)** | #2, #10 | 5 | 2 weeks | Reuses `matter_people` role; adds exam schedule + testimony. |
| 18 | **Witness Preparedness Engine** | #17, #1 | 5 | 1 week | Tracks affidavit + exam readiness. Informational. |
| 19 | **Document Templates + Assembly** | #2, #3, #11 | 6 | 2 weeks | Generate pleadings, affidavits from templates. Highest complexity. |
| 20 | **Analytics Dashboard** | All prior | 7 | 2 weeks | Firm metrics. Materialized views. Read-only. |

**Reasoning:**

1. **Infrastructure first** (#1–2): Event bus + Matter Record are foundational. No features work without them.

2. **Reference vertical slice early** (#3): Prove the architecture end-to-end with Schedule Hearing. Unstick design debates.

3. **Hubs before content** (#4): Knowledge Hub is read-only reference layer. Must exist before Activities reference it.

4. **Engines unlock intelligence** (#5–6): First two Engines prove subscription, proposal/promotion, async processing. Define the pattern for all future Engines.

5. **Projections are cheap** (#7–9): Once data exists, queries are low-cost. Build them early to prove the read layer.

6. **Linked structures** (#11–14): Legal Issues show how complex entities (Issue → Argument → Authority → Evidence) compose. Template for future nested features.

7. **New workflows** (#15–18): Negotiation and Witness are independent workflows that reuse existing Matter entities. Low architectural risk.

8. **Assembly & automation** (#19–20): Complex features that depend on all prior infrastructure. Leave for later phases.

---

## PART 11: Future Expansion (New Practice Areas)

The architecture is practice-area-agnostic. Immigration, Family, AML, Tax plug in without changing the platform.

### Adding a New Practice Area: Immigration Example

**Step 1: Knowledge Hub Extensions**

```sql
-- New Hub tables (migrations)
CREATE TABLE immigration_visa_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id),
  name text,  -- "Work Permit", "Visitor Visa", "Skilled Migration"
  ...
);

CREATE TABLE immigration_authorities (
  id uuid PRIMARY KEY,
  firm_id uuid,
  category text,  -- "RegulationCh", "ProcedureGuide", "CaseDecision"
  ...
);
```

**Step 2: New Matter Record Entities**

```typescript
// Not replacing existing tables; extending them.
// activities/immigration/apply-for-visa.contract.ts

// Visa application is a Matter Record entity, not a new concept.
interface VisaApplication {
  id: string;
  matterId: string;
  visaTypeId: string; // FK to immigration_visa_types (Hub)
  applicationStatus: "draft" | "submitted" | "approved" | "rejected";
  ...
}

// Legal Issues still apply.
// A visa application has underlying legal issues (sponsor availability, points scoring, etc.)
```

**Step 3: Immigration-Specific Engines**

```typescript
// engines/VisaEligibilityEngine/
// Computes eligibility from application data + current regs (Hub).
// Emits visa_eligibility_assessed event.
// Stores in visa_eligibility_results (status: proposed).
// User confirms via PromoteVisaEligibility Activity.
```

**Step 4: Immigration Workflows**

Same pattern as Hearings or Negotiations:

```
Activity: ApplyForVisa
  ├─ Validates visa type, applicant, points
  └─ Invokes ApplyForVisaOutputContract
    ├─ Writes visa_applications row
    ├─ Appends to matter_stage_history
    └─ Emits visa_application_submitted event
      └─ VisaEligibilityEngine subscribes
        └─ Stores result (status: proposed)
          └─ User confirms
```

**Key Point:** Zero changes to:
- Domain Events infrastructure
- Output Contract pattern
- Repository abstraction
- Engine framework
- Projection layer
- Conflict Engine (still works; now checks conflicta across visa sponsors too)

Immigration is just another set of Hubs, Entities, Activities, Engines, and Projections, following the same rules.

---

## PART 12: What Must Never Be Done

Blacklist of anti-patterns. Any violation is grounds for rejection.

### Prohibited Patterns

1. **❌ Activities writing directly to SQL or calling database clients**
   ```typescript
   // WRONG
   export class ScheduleHearingActivity {
     execute(input) {
       const result = await supabase.from("hearings").insert(...);
     }
   }
   
   // CORRECT: Activity calls Output Contract only
   export class ScheduleHearingActivity {
     execute(input) {
       return this.contract.execute(input);
     }
   }
   ```

2. **❌ Engines writing directly to Matter Record tables**
   ```typescript
   // WRONG
   eventBus.subscribe("hearing_scheduled", async (event) => {
     await supabase.from("deadlines").insert({...});  // Unauthorized write
   });
   
   // CORRECT: Engine stores in its own table, status: proposed
   eventBus.subscribe("hearing_scheduled", async (event) => {
     await deadlineEngine.saveProposal({...}); // deadline_engine_results, status: proposed
   });
   ```

3. **❌ Duplicate entities under different names**
   ```typescript
   // WRONG: adding negotiation_parties instead of reusing matter_people
   CREATE TABLE negotiation_parties (
     id uuid,
     name text,
     ...
   );
   
   // CORRECT: reuse matter_people with appropriate role
   -- matter_people already has role field
   -- role = 'negotiation_applicant' or 'negotiation_respondent'
   ```

4. **❌ Projections persisting business data**
   ```typescript
   // WRONG: Dashboard owns calculation
   export async function getDashboardMetrics() {
     const cached = await getFromCache(); // Cache is a second source of truth
     if (cached) return cached;
     const computed = computeMetrics();
     await cacheMetrics(computed); // Persisting to cache
     return computed;
   }
   
   // CORRECT: Projection queries existing data, optionally from materialized view
   export async function getDashboardMetrics() {
     return await supabase.from("dashboard_metrics_view").select(); // View refreshed by cron
   }
   ```

5. **❌ Knowledge Hub data copied into Matter Record**
   ```typescript
   // WRONG: Judge name stored on hearing
   CREATE TABLE hearings (
     judge_name text, -- Copy of judges.full_name; now stale immediately
   );
   
   // CORRECT: Reference the Hub
   CREATE TABLE hearings (
     judge_id uuid REFERENCES judges(id),
   );
   -- Projection queries judges table for name when needed
   ```

6. **❌ Business logic in UI**
   ```typescript
   // WRONG: Complex decision in component
   export function ScheduleHearingForm() {
     function computeDeadline() {
       const deadline = hearing_date + 21 days;
       if (judge === 'Justice Tuiyott') deadline = hearing_date + 14 days;
       return deadline;
     }
     return ...;
   }
   
   // CORRECT: Engine computes, UI displays
   export function ScheduleHearingForm() {
     const deadline = deadlineEngineResult.proposedDeadline; // From Engine
     return ...;
   }
   ```

7. **❌ Direct Engine-to-Engine communication**
   ```typescript
   // WRONG: Deadline Engine directly calls Risk Engine
   await riskEngine.assessRisk(hearing);
   
   // CORRECT: Both subscribe to hearing_scheduled independently
   eventBus.subscribe("hearing_scheduled", (event) => {
     await deadlineEngine.handleHearingScheduled(event);
     await riskEngine.assessRisk(event);
   });
   ```

8. **❌ Repository bypass**
   ```typescript
   // WRONG: Contract imports ORM directly
   import { hearing } from "@orm/models";
   
   const h = new hearing(); h.date = input.date; await h.save();
   
   // CORRECT: All writes via Repository
   const h = await repository.createHearing(input);
   ```

9. **❌ Partial writes (missing transaction boundary)**
   ```typescript
   // WRONG: Two independent writes
   await repo.createHearing(hearing);
   await repo.appendTimeline(timeline); // If this fails, hearing exists orphaned
   
   // CORRECT: Atomic transaction
   await repo.createHearingWithTimeline(hearing, timeline); // One UoW
   ```

10. **❌ Skipping validation**
    ```typescript
    // WRONG: Trusting the input
    const input = req.body; // No parse/validate
    const hearing = await repo.createHearing(input);
    
    // CORRECT: Always validate
    const input = ScheduleHearingInput.parse(req.body); // Throws on invalid
    const hearing = await repo.createHearing(input);
    ```

11. **❌ Generic repository methods**
    ```typescript
    // WRONG
    export interface Repository {
      find(table: string, where: any): Promise<any[]>;
      insert(table: string, data: any): Promise<any>;
    }
    
    // CORRECT: Domain-specific methods
    export interface MatterRecordRepository {
      createHearing(hearing: CreateHearingInput): Promise<Hearing>;
      getHearingsByMatter(matterId: string): Promise<Hearing[]>;
    }
    ```

12. **❌ Activity retries without idempotency keys**
    ```typescript
    // WRONG: Retry creates duplicate
    // User retries form submission
    await contract.execute(input); // First attempt
    await contract.execute(input); // Retry: duplicate hearing created
    
    // CORRECT: Idempotency key
    await contract.execute({...input, sourceActivityId: uuid}); // Always same result
    ```

13. **❌ Mixing validation layers**
    ```typescript
    // WRONG: Client validation only
    <input type="date" required /> {/* UI won't stop invalid JSON from API */}
    
    // CORRECT: Server validation mandatory
    // Client validation is UX; server validation is security
    const input = ScheduleHearingInput.parse(req.body);
    ```

14. **❌ Untraced mutations**
    ```typescript
    // WRONG: No source_activity_id
    INSERT INTO hearings (matter_id, date, ...) VALUES (...);
    
    // CORRECT: All writes traceable
    INSERT INTO hearings (matter_id, date, source_activity_id, ...) VALUES (...);
    ```

15. **❌ Syncing data between tables**
    ```typescript
    // WRONG: Updating a copy
    -- matter_people table has name "John"
    -- After name changes, manually update hearing_attendees_summary
    UPDATE hearing_attendees_summary SET name = "John" WHERE person_id = ...;
    
    // CORRECT: Single source of truth
    -- Projection queries person's current name at view time
    SELECT h.*, mp.name FROM hearings h JOIN matter_people mp USING(person_id);
    ```

---

## PART 13: Appendix: Composition Root Example

Below is a complete, production-ready composition root that wires all dependencies for the API server.

```typescript
// lib/di/production-container.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "ioredis";

import { PostgresMatterRecordRepository } from "repositories/matter-record/PostgresMatterRecordRepository";
import { PostgresKnowledgeHubRepository } from "knowledge-hub/PostgresKnowledgeHubRepository";
import { RedisEventBus } from "repositories/event-bus/RedisEventBus";

import { ScheduleHearingOutputContract } from "activities/hearing/schedule-hearing.contract";
import { RaiseIssueOutputContract } from "activities/legal-issue/raise-issue.contract";

import { ConflictEngineSubscriber } from "engines/ConflictEngine/subscriber";
import { DeadlineEngineSubscriber } from "engines/DeadlineEngine/subscriber";

export class ProductionContainer {
  private matterRecordRepo: PostgresMatterRecordRepository;
  private knowledgeHubRepo: PostgresKnowledgeHubRepository;
  private eventBus: RedisEventBus;
  private firmId: string;

  constructor(
    private supabase: SupabaseClient,
    private redis: Redis,
    firmId: string
  ) {
    this.firmId = firmId;
    this.matterRecordRepo = new PostgresMatterRecordRepository(supabase);
    this.knowledgeHubRepo = new PostgresKnowledgeHubRepository(supabase);
    this.eventBus = new RedisEventBus(redis);
  }

  // Activity Contracts
  getScheduleHearingContract(): ScheduleHearingOutputContract {
    return new ScheduleHearingOutputContract(
      this.matterRecordRepo,
      this.knowledgeHubRepo,
      this.eventBus,
      this.firmId
    );
  }

  getRaiseIssueContract(): RaiseIssueOutputContract {
    return new RaiseIssueOutputContract(
      this.matterRecordRepo,
      this.knowledgeHubRepo,
      this.eventBus,
      this.firmId
    );
  }

  // Engines
  subscribeToEvents(): void {
    const conflictSubscriber = new ConflictEngineSubscriber(
      this.matterRecordRepo,
      this.knowledgeHubRepo
    );
    const deadlineSubscriber = new DeadlineEngineSubscriber(
      this.matterRecordRepo,
      this.knowledgeHubRepo
    );

    this.eventBus.subscribe("matter_created", (event) => conflictSubscriber.handle(event));
    this.eventBus.subscribe("matter_person_added", (event) => conflictSubscriber.handle(event));
    this.eventBus.subscribe("hearing_scheduled", (event) => deadlineSubscriber.handle(event));
  }

  // Getters for API layer
  getEventBus() {
    return this.eventBus;
  }

  getMatterRecordRepository() {
    return this.matterRecordRepo;
  }

  getKnowledgeHubRepository() {
    return this.knowledgeHubRepo;
  }
}

// Global singleton per deployment
let container: ProductionContainer;

export function initializeContainer(
  supabase: SupabaseClient,
  redis: Redis,
  firmId: string
) {
  container = new ProductionContainer(supabase, redis, firmId);
  container.subscribeToEvents();
  return container;
}

export function getContainer(): ProductionContainer {
  if (!container) throw new Error("Container not initialized");
  return container;
}
```

---

## CONCLUSION

This Engineering Implementation Package is your complete roadmap for 2–3 years of development. It is:

- **Architecture-frozen**: The five layers and principles are non-negotiable.
- **Practice-agnostic**: Immigration, Family, AML, Tax all plug in using the same patterns.
- **Pattern-driven**: Every feature follows the same lifecycle; the architecture doesn't get harder over time, it gets easier.
- **Implementation-first**: This is not another design document; it is the specification your engineer works from.

**Do not redesign. Do not introduce new concepts. Implement as specified.**

**Next step:** Pick Feature #1 (Domain Events Infrastructure) and execute it end-to-end, including tests and deployment. Once that works, everything else flows naturally from the same patterns.

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-29  
**Frozen:** Yes (see "How This Handbook May Be Amended" in `platform-engineering-handbook.md`)
