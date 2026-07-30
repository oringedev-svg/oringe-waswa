/**
 * Supabase/PostgreSQL implementation of MatterRecordRepository.
 * This is the ONLY place in the entire platform where SQL is written for Matter Record writes.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  MatterRecordRepository,
  Matter,
  MatterPerson,
  Hearing,
  TimelineEntry,
} from './MatterRecordRepository'
import {
  NotFoundError,
  ConflictError,
  PersistenceError,
  translatePersistenceError,
} from '@/lib/errors/DomainError'
import { logger } from '@/lib/logging/logger'

export class PostgresMatterRecordRepository implements MatterRecordRepository {
  constructor(private supabase: SupabaseClient) {}

  async createHearing(hearing: Omit<Hearing, 'id' | 'createdAt' | 'updatedAt'>): Promise<Hearing> {
    try {
      const { data, error } = await this.supabase
        .from('hearings')
        .insert([
          {
            matter_id: hearing.matterId,
            court_id: hearing.courtId,
            court_division_id: hearing.courtDivisionId,
            judge_id: hearing.judgeId,
            courtroom: hearing.courtroom,
            hearing_date: hearing.hearingDate,
            hearing_time: hearing.hearingTime,
            purpose: hearing.purpose,
            status: hearing.status,
            source_activity_id: hearing.sourceActivityId,
          },
        ])
        .select()
        .single()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new PersistenceError('Hearing insert returned no data')
      }

      logger.info('Hearing created', {
        hearingId: data.id,
        matterId: hearing.matterId,
        sourceActivityId: hearing.sourceActivityId,
      })

      return this.mapToHearing(data)
    } catch (err) {
      if (err instanceof PersistenceError || err instanceof NotFoundError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getHearing(id: string): Promise<Hearing | null> {
    try {
      const { data, error } = await this.supabase
        .from('hearings')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw translatePersistenceError(error)
      }

      return data ? this.mapToHearing(data) : null
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getHearingsByMatter(matterId: string): Promise<Hearing[]> {
    try {
      const { data, error } = await this.supabase
        .from('hearings')
        .select('*')
        .eq('matter_id', matterId)
        .order('hearing_date', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((h) => this.mapToHearing(h))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async updateHearingStatus(id: string, status: Hearing['status']): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('hearings')
        .update({ status, updated_at: new Date() })
        .eq('id', id)

      if (error) {
        throw translatePersistenceError(error)
      }

      logger.info('Hearing status updated', { hearingId: id, status })
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async appendTimelineEntry(
    entry: Omit<TimelineEntry, 'id' | 'createdAt'>,
  ): Promise<TimelineEntry> {
    try {
      const { data, error } = await this.supabase
        .from('matter_stage_history')
        .insert([
          {
            matter_id: entry.matterId,
            kind: entry.kind,
            summary: entry.summary,
            ref_id: entry.refId,
            source_activity_id: entry.sourceActivityId,
          },
        ])
        .select()
        .single()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new PersistenceError('Timeline entry insert returned no data')
      }

      logger.info('Timeline entry appended', {
        matterId: entry.matterId,
        kind: entry.kind,
        sourceActivityId: entry.sourceActivityId,
      })

      return this.mapToTimelineEntry(data)
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getTimeline(matterId: string): Promise<TimelineEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('matter_stage_history')
        .select('*')
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((entry) => this.mapToTimelineEntry(entry))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  private mapToHearing(data: any): Hearing {
    return {
      id: data.id,
      matterId: data.matter_id,
      courtId: data.court_id,
      courtDivisionId: data.court_division_id,
      judgeId: data.judge_id,
      courtroom: data.courtroom,
      hearingDate: new Date(data.hearing_date),
      hearingTime: data.hearing_time,
      purpose: data.purpose,
      status: data.status,
      sourceActivityId: data.source_activity_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  async getMatter(id: string): Promise<Matter | null> {
    try {
      const { data, error } = await this.supabase
        .from('legal_matters')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw translatePersistenceError(error)
      }

      return data ? this.mapToMatter(data) : null
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getMatterByNumber(matterNumber: string): Promise<Matter | null> {
    try {
      const { data, error } = await this.supabase
        .from('legal_matters')
        .select('*')
        .eq('matter_number', matterNumber)
        .maybeSingle()

      if (error) {
        throw translatePersistenceError(error)
      }

      return data ? this.mapToMatter(data) : null
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getMattersForPerson(personId: string): Promise<Matter[]> {
    try {
      const { data, error } = await this.supabase
        .from('legal_matters')
        .select('*')
        .eq('client_id', personId)
        .order('opening_date', { ascending: false })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((m) => this.mapToMatter(m))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async updateMatterStatus(id: string, status: Matter['status']): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('legal_matters')
        .update({ status, updated_at: new Date() })
        .eq('id', id)

      if (error) {
        throw translatePersistenceError(error)
      }

      logger.info('Matter status updated', { matterId: id, status })
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async addPersonToMatter(person: Omit<MatterPerson, 'id' | 'addedAt'>): Promise<MatterPerson> {
    try {
      const { data, error } = await this.supabase
        .from('matter_people')
        .insert([
          {
            matter_id: person.matterId,
            profile_id: person.profileId,
            role: person.role,
            notes: person.notes,
          },
        ])
        .select()
        .single()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new PersistenceError('MatterPerson insert returned no data')
      }

      logger.info('Person added to matter', {
        matterId: person.matterId,
        profileId: person.profileId,
        role: person.role,
      })

      return this.mapToMatterPerson(data)
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getPeopleForMatter(matterId: string): Promise<MatterPerson[]> {
    try {
      const { data, error } = await this.supabase
        .from('matter_people')
        .select('*')
        .eq('matter_id', matterId)
        .order('added_at', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((p) => this.mapToMatterPerson(p))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getPersonRoleInMatter(matterId: string, profileId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('matter_people')
        .select('role')
        .eq('matter_id', matterId)
        .eq('profile_id', profileId)
        .maybeSingle()

      if (error) {
        throw translatePersistenceError(error)
      }

      return data?.role || null
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  private mapToMatter(data: any): Matter {
    return {
      id: data.id,
      matterNumber: data.matter_number,
      title: data.title,
      type: data.type,
      status: data.status,
      clientId: data.client_id,
      clientName: data.client_name,
      opposingParty: data.opposing_party,
      court: data.court,
      caseNumber: data.case_number,
      assignedAttorneyId: data.assigned_attorney_id,
      openingDate: new Date(data.opening_date),
      closingDate: data.closing_date ? new Date(data.closing_date) : null,
      description: data.description,
      isConfidential: data.is_confidential,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  private mapToMatterPerson(data: any): MatterPerson {
    return {
      id: data.id,
      matterId: data.matter_id,
      profileId: data.profile_id,
      role: data.role,
      notes: data.notes,
      addedAt: new Date(data.added_at),
    }
  }

  private mapToTimelineEntry(data: any): TimelineEntry {
    return {
      id: data.id,
      matterId: data.matter_id,
      kind: data.kind,
      summary: data.summary,
      refId: data.ref_id,
      sourceActivityId: data.source_activity_id,
      createdAt: new Date(data.created_at),
    }
  }
}
