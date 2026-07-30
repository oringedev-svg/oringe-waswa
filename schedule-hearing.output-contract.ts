// ============================================================
// REFERENCE IMPLEMENTATION: Schedule Hearing Output Contract
// ============================================================
// This file is the canonical example every future Activity's
// Output Contract should follow. It demonstrates the full lifecycle:
//
//   Activity executes
//     -> Output Contract validates input
//     -> Output Contract is the ONLY thing authorised to write
//        Matter Record entities (via a Repository, not raw SQL)
//     -> Domain Event emitted
//     -> Engines react asynchronously, decoupled, via subscription
//     -> UI projects the resulting state (not shown here — projection
//        layer owns no data, so it's just a query against the repo)
//
// Key rule embodied here: the Activity layer never knows a table
// called `hearings` exists. It only knows "my contract produces a Hearing."

import { z } from "zod";

// ------------------------------------------------------------
// 1. INPUT SCHEMA — what this Activity collects, and validation
// ------------------------------------------------------------

export const ScheduleHearingInput = z.object({
  matterId: z.string().uuid(),

  // Knowledge Hub references — IDs only. The contract resolves these
  // against the Knowledge Hub repository; it never trusts denormalised
  // names/labels passed in from the UI.
  courtId: z.string().uuid(),
  courtDivisionId: z.string().uuid().optional(),
  judgeId: z.string().uuid().optional(),
  courtroom: z.string().max(100).optional(),

  hearingDate: z.coerce.date(),
  hearingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  purpose: z.enum([
    "mention",
    "hearing",
    "ruling",
    "pre_trial_conference",
    "taxation",
    "other",
  ]),
  purposeOther: z.string().max(200).optional(),

  // provenance: which activity instance produced this write
  sourceActivityId: z.string().uuid(),
})
  .refine(
    (v) => v.purpose !== "other" || !!v.purposeOther,
    { message: "purposeOther is required when purpose = 'other'", path: ["purposeOther"] }
  )
  .refine(
    (v) => !v.judgeId || !!v.courtDivisionId,
    { message: "courtDivisionId is required when judgeId is supplied", path: ["courtDivisionId"] }
  );

export type ScheduleHearingInput = z.infer<typeof ScheduleHearingInput>;

// ------------------------------------------------------------
// 2. THE MATTER RECORD ENTITY THIS CONTRACT PRODUCES
// ------------------------------------------------------------
// The Activity only knows "I produce a Hearing." It has no idea
// this maps to a `hearings` table, let alone its columns.

export interface Hearing {
  id: string;
  matterId: string;
  courtId: string;
  courtDivisionId: string | null;
  judgeId: string | null;
  courtroom: string | null;
  hearingDate: Date;
  hearingTime: string | null;
  purpose: string;
  status: "scheduled" | "held" | "adjourned" | "vacated" | "cancelled";
  sourceActivityId: string;
  createdAt: Date;
}

// ------------------------------------------------------------
// 3. REPOSITORY INTERFACE — the ONLY authorised write path
// ------------------------------------------------------------
// The contract depends on this interface, not a concrete DB client.
// Swap the implementation (Postgres today, something else in five
// years) without touching the Activity or the contract's logic.

export interface MatterRecordRepository {
  createHearing(hearing: Omit<Hearing, "id" | "createdAt">): Promise<Hearing>;
  appendTimelineEntry(entry: {
    matterId: string;
    kind: string;
    summary: string;
    refId: string;
    sourceActivityId: string;
  }): Promise<void>;
}

// Knowledge Hub is read-only from the contract's perspective.
export interface KnowledgeHubRepository {
  getCourt(id: string): Promise<{ id: string; name: string } | null>;
  getCourtDivision(id: string): Promise<{ id: string; courtId: string; name: string } | null>;
  getJudge(id: string): Promise<{ id: string; courtDivisionId: string; fullName: string } | null>;
}

// Domain events go out through this port. The contract does NOT
// import or call any Engine directly — Engines subscribe independently.
export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface DomainEvent {
  type: string;
  firmId: string;
  matterId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

// ------------------------------------------------------------
// 4. THE OUTPUT CONTRACT ITSELF
// ------------------------------------------------------------

export class ScheduleHearingOutputContract {
  constructor(
    private readonly matterRecord: MatterRecordRepository,
    private readonly knowledgeHub: KnowledgeHubRepository,
    private readonly events: DomainEventPublisher,
    private readonly firmId: string,
  ) {}

  async execute(rawInput: unknown): Promise<Hearing> {
    // Step 1: validate collected information
    const input = ScheduleHearingInput.parse(rawInput);

    // Step 2: resolve + validate Knowledge Hub references.
    // This is where "judge dropdown filters by division" is enforced
    // server-side, not just in the UI.
    const court = await this.knowledgeHub.getCourt(input.courtId);
    if (!court) throw new Error(`Unknown court: ${input.courtId}`);

    if (input.courtDivisionId) {
      const division = await this.knowledgeHub.getCourtDivision(input.courtDivisionId);
      if (!division || division.courtId !== input.courtId) {
        throw new Error("Court division does not belong to the specified court");
      }
    }

    if (input.judgeId) {
      const judge = await this.knowledgeHub.getJudge(input.judgeId);
      if (!judge || judge.courtDivisionId !== input.courtDivisionId) {
        throw new Error("Judge does not belong to the specified division");
      }
    }

    // Step 3: this contract is the ONLY thing authorised to write
    // the Hearing into the Matter Record.
    const hearing = await this.matterRecord.createHearing({
      matterId: input.matterId,
      courtId: input.courtId,
      courtDivisionId: input.courtDivisionId ?? null,
      judgeId: input.judgeId ?? null,
      courtroom: input.courtroom ?? null,
      hearingDate: input.hearingDate,
      hearingTime: input.hearingTime ?? null,
      purpose: input.purpose === "other" ? input.purposeOther! : input.purpose,
      status: "scheduled",
      sourceActivityId: input.sourceActivityId,
    });

    // Step 4: Matter Timeline gets an entry — this is a Matter Record
    // write too, done here rather than left to a UI or a second call,
    // so "one form, five systems updated" holds even if a caller forgets.
    await this.matterRecord.appendTimelineEntry({
      matterId: input.matterId,
      kind: "hearing_scheduled",
      summary: `Hearing scheduled for ${input.hearingDate.toDateString()}`,
      refId: hearing.id,
      sourceActivityId: input.sourceActivityId,
    });

    // Step 5: emit domain event. The contract does not know or care
    // who's listening — Deadline Engine, AI Engine, Notification Engine
    // all subscribe independently and asynchronously.
    await this.events.publish({
      type: "hearing_scheduled",
      firmId: this.firmId,
      matterId: input.matterId,
      payload: {
        hearingId: hearing.id,
        hearingDate: hearing.hearingDate.toISOString(),
        courtId: hearing.courtId,
        judgeId: hearing.judgeId,
      },
      occurredAt: new Date(),
    });

    return hearing;
  }
}

// ------------------------------------------------------------
// 5. WHAT AN ENGINE SUBSCRIBER LOOKS LIKE (illustrative only —
//    lives in a separate module, imports nothing from this file
//    except the event's shape/type, never the contract itself)
// ------------------------------------------------------------
//
// eventBus.subscribe("hearing_scheduled", async (event: DomainEvent) => {
//   const deadlines = computeDeadlines(event.payload.hearingDate);
//   await deadlineEngineRepo.saveResult({
//     matterId: event.matterId,
//     sourceEvent: event.type,
//     computedAt: new Date(),
//     deadlines,
//     status: "proposed", // never auto-written to Matter Record;
//                         // a user or activity must promote it
//   });
// });
//
// This is the boundary from the earlier discussion: Engine output
// lands in an engine-owned, versioned table. It only becomes a
// Matter Record fact if a user explicitly accepts/promotes it —
// e.g. via a "Confirm Deadline" activity that has its own,
// much smaller, Output Contract.
