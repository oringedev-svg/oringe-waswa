/**
 * Matter Record Repository interface.
 * The ONLY authorized write path for legal facts.
 *
 * Activities never import this interface; Output Contracts do.
 * Concrete implementations contain SQL; interfaces contain domain operations.
 */

export interface Matter {
  id: string
  matterNumber: string
  title: string
  type: string
  status: 'open' | 'closed' | 'on_hold' | 'archived'
  clientId: string | null
  clientName: string
  opposingParty: string | null
  court: string | null
  caseNumber: string | null
  assignedAttorneyId: string | null
  openingDate: Date
  closingDate: Date | null
  description: string | null
  isConfidential: boolean
  sourceActivityId?: string
  createdAt: Date
  updatedAt: Date
}

export interface MatterPerson {
  id: string
  matterId: string
  profileId: string
  role: string
  notes: string | null
  addedAt: Date
}

export interface Hearing {
  id: string
  matterId: string
  courtId: string
  courtDivisionId: string | null
  judgeId: string | null
  courtroom: string | null
  hearingDate: Date
  hearingTime: string | null
  purpose: string
  status: 'scheduled' | 'held' | 'adjourned' | 'vacated' | 'cancelled'
  sourceActivityId: string
  createdAt: Date
  updatedAt: Date
}

export interface TimelineEntry {
  id: string
  matterId: string
  kind: string
  summary: string
  refId: string | null
  sourceActivityId: string
  createdAt: Date
}

export interface MatterRecordRepository {
  /**
   * Matters
   */
  getMatter(id: string): Promise<Matter | null>
  getMatterByNumber(matterNumber: string): Promise<Matter | null>
  getMattersForPerson(personId: string): Promise<Matter[]>
  updateMatterStatus(id: string, status: Matter['status']): Promise<void>

  /**
   * People
   */
  addPersonToMatter(person: Omit<MatterPerson, 'id' | 'addedAt'>): Promise<MatterPerson>
  getPeopleForMatter(matterId: string): Promise<MatterPerson[]>
  getPersonRoleInMatter(matterId: string, profileId: string): Promise<string | null>

  /**
   * Hearings
   */
  createHearing(hearing: Omit<Hearing, 'id' | 'createdAt' | 'updatedAt'>): Promise<Hearing>
  getHearing(id: string): Promise<Hearing | null>
  getHearingsByMatter(matterId: string): Promise<Hearing[]>
  updateHearingStatus(id: string, status: Hearing['status']): Promise<void>

  /**
   * Timeline (Audit trail of all events on a matter)
   */
  appendTimelineEntry(entry: Omit<TimelineEntry, 'id' | 'createdAt'>): Promise<TimelineEntry>
  getTimeline(matterId: string): Promise<TimelineEntry[]>
}
