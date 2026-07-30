/**
 * Composed Knowledge Hub Repository.
 * All Hub repositories are read-only from the Activity/Contract perspective.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { PostgresCountrRepository } from './CourtsRepository'
import { PostgresCourtDivisionsRepository } from './CourtDivisionsRepository'
import { PostgresJudgesRepository } from './JudgesRepository'

export interface KnowledgeHubRepository {
  courts: ReturnType<typeof PostgresCountrRepository.prototype.getCourt> extends Promise<infer T>
    ? {
        getCourt: (id: string) => Promise<T>
        listCourts: () => Promise<T[]>
        getCourtsByJurisdiction: (jurisdiction: string) => Promise<T[]>
      }
    : never
  courtDivisions: ReturnType<typeof PostgresCourtDivisionsRepository.prototype.getCourtDivision> extends Promise<infer T>
    ? {
        getCourtDivision: (id: string) => Promise<T>
        getCourtDivisionsByCourtId: (courtId: string) => Promise<T[]>
        validateDivisionBelongsToCourtl: (divisionId: string, courtId: string) => Promise<boolean>
      }
    : never
  judges: ReturnType<typeof PostgresJudgesRepository.prototype.getJudge> extends Promise<infer T>
    ? {
        getJudge: (id: string) => Promise<T>
        getJudgesByDivisionId: (divisionId: string) => Promise<T[]>
        validateJudgeBelongsToDivision: (judgeId: string, divisionId: string) => Promise<boolean>
      }
    : never
}

/**
 * Factory function to create a composed Knowledge Hub Repository.
 */
export function createKnowledgeHubRepository(supabase: SupabaseClient): KnowledgeHubRepository {
  const courtsRepo = new PostgresCountrRepository(supabase)
  const divisionsRepo = new PostgresCourtDivisionsRepository(supabase)
  const judgesRepo = new PostgresJudgesRepository(supabase)

  return {
    courts: courtsRepo as any,
    courtDivisions: divisionsRepo as any,
    judges: judgesRepo as any,
  }
}
