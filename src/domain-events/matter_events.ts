/**
 * Domain events for Matter Record operations.
 * Past-tense facts that Engines and projections subscribe to.
 */

export interface MatterCreatedPayload {
  matterId: string
  matterNumber: string
  title: string
  type: string
  clientId: string | null
  clientName: string
  opposingParty: string | null
  openingDate: string
}

export interface MatterPersonAddedPayload {
  matterId: string
  personId: string
  role: string
}

export interface MatterStatusChangedPayload {
  matterId: string
  previousStatus: string
  newStatus: string
  changedAt: string
}

export interface HearingScheduledPayload {
  hearingId: string
  matterId: string
  hearingDate: string
  hearingTime?: string
  courtId: string
  courtDivisionId?: string
  judgeId?: string
  purpose: string
}
