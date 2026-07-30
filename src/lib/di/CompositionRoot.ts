/**
 * Dependency Injection Composition Root
 * Wires all dependencies for the production application.
 * One composition root per deployment target (API server, background worker, test harness).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

// Event Bus
import { InProcessEventBus, getEventBus, initializeEventBus } from '@/lib/event-bus/InProcessEventBus'

// Repositories
import { PostgresMatterRecordRepository } from '@/lib/repositories/PostgresMatterRecordRepository'
import { PostgresCountrRepository } from '@/lib/repositories/knowledge-hub/CourtsRepository'
import { PostgresCourtDivisionsRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsRepository'
import { PostgresJudgesRepository } from '@/lib/repositories/knowledge-hub/JudgesRepository'
import { EventBusPublisher } from '@/lib/repositories/EventPublisher'
import { PostgresDeadlineEngineRepository } from '@/lib/repositories/engines/DeadlineEngineRepository'
import { PostgresConflictEngineRepository } from '@/lib/repositories/engines/PostgresConflictEngineRepository'
import { PostgresRiskAssessmentEngineRepository } from '@/lib/repositories/engines/RiskAssessmentEngineRepository'
import { PostgresDocumentIntelligenceEngineRepository } from '@/lib/repositories/engines/DocumentIntelligenceEngineRepository'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { PostgresDocumentsRepository } from '@/lib/repositories/DocumentsRepository'

// Contracts
import { ScheduleHearingOutputContract } from '@/activities/hearing/schedule-hearing.contract'
import { ReviewConflictOutputContract } from '@/activities/conflict/review-conflict.contract'
import { ConfirmDeadlineOutputContract } from '@/activities/deadline/confirm-deadline.contract'

// Engines
import { createConflictEngineSubscriber } from '@/engines/ConflictEngine/subscriber'
import { createDeadlineEngineSubscriber } from '@/engines/DeadlineEngine/subscriber'
import { createRiskAssessmentEngineSubscriber } from '@/engines/RiskAssessmentEngine/subscriber'
import { createDocumentIntelligenceEngineSubscriber } from '@/engines/DocumentIntelligenceEngine/subscriber'

// Logging
import { logger } from '@/lib/logging/logger'

/**
 * Global composition root singleton
 */
let globalContainer: CompositionRoot | null = null

export class CompositionRoot {
  private supabase: SupabaseClient
  private eventBus: InProcessEventBus
  private matterRecordRepository: PostgresMatterRecordRepository
  private courtsRepository: PostgresCountrRepository
  private divisionsRepository: PostgresCourtDivisionsRepository
  private judgesRepository: PostgresJudgesRepository
  private conflictEngineRepository: PostgresConflictEngineRepository
  private riskAssessmentRepository: PostgresRiskAssessmentEngineRepository
  private documentIntelligenceRepository: PostgresDocumentIntelligenceEngineRepository
  private legalIssuesRepository: PostgresLegalIssuesRepository
  private documentsRepository: PostgresDocumentsRepository
  private eventPublisher: EventBusPublisher

  constructor() {
    this.supabase = createAdminClient()
    this.eventBus = getEventBus()
    this.matterRecordRepository = new PostgresMatterRecordRepository(this.supabase)
    this.courtsRepository = new PostgresCountrRepository(this.supabase)
    this.divisionsRepository = new PostgresCourtDivisionsRepository(this.supabase)
    this.judgesRepository = new PostgresJudgesRepository(this.supabase)
    this.conflictEngineRepository = new PostgresConflictEngineRepository(this.supabase)
    this.riskAssessmentRepository = new PostgresRiskAssessmentEngineRepository(this.supabase)
    this.documentIntelligenceRepository = new PostgresDocumentIntelligenceEngineRepository(
      this.supabase,
    )
    this.legalIssuesRepository = new PostgresLegalIssuesRepository(this.supabase)
    this.documentsRepository = new PostgresDocumentsRepository(this.supabase)
    this.eventPublisher = new EventBusPublisher()
  }

  // Accessor for Deadline Engine
  private getJudgesRepository(): PostgresJudgesRepository {
    return this.judgesRepository
  }

  /**
   * Initialize the application.
   * Call this once at startup.
   */
  async initialize(): Promise<void> {
    logger.info('CompositionRoot initializing')
    await initializeEventBus()

    // Subscribe Engines to domain events

    // Conflict Engine: Detects conflicts when matters are created or people added
    const conflictEngineSubscriber = createConflictEngineSubscriber(
      this.supabase,
      this.matterRecordRepository,
    )
    conflictEngineSubscriber.subscribe(this.eventBus)

    // Deadline Engine: Computes filing deadlines when hearings are scheduled
    const deadlineEngineSubscriber = createDeadlineEngineSubscriber(
      this.getJudgesRepository(),
      new PostgresDeadlineEngineRepository(this.supabase),
    )
    deadlineEngineSubscriber.subscribe(this.eventBus)

    // Risk Assessment Engine: Computes risk scores from legal issues
    const riskEngineSubscriber = createRiskAssessmentEngineSubscriber(
      this.legalIssuesRepository,
      this.riskAssessmentRepository,
    )
    riskEngineSubscriber.subscribe(this.eventBus)

    // Document Intelligence Engine: Extracts data from uploaded documents
    const docIntelligenceSubscriber = createDocumentIntelligenceEngineSubscriber(
      this.documentsRepository,
      this.documentIntelligenceRepository,
    )
    docIntelligenceSubscriber.subscribe(this.eventBus)

    logger.info(
      'CompositionRoot initialized with Conflict, Deadline, Risk Assessment, and Document Intelligence Engines',
    )
  }

  /**
   * Graceful shutdown.
   * Call this on SIGTERM/SIGINT.
   */
  async shutdown(): Promise<void> {
    logger.info('CompositionRoot shutting down')
    await this.eventBus.stop()
    logger.info('CompositionRoot shut down')
  }

  // --- Factory methods for Activities/Contracts ---

  getScheduleHearingContract(firmId: string): ScheduleHearingOutputContract {
    return new ScheduleHearingOutputContract(
      this.matterRecordRepository,
      this.courtsRepository,
      this.divisionsRepository,
      this.judgesRepository,
      this.eventPublisher,
      firmId,
    )
  }

  getReviewConflictContract(firmId: string): ReviewConflictOutputContract {
    return new ReviewConflictOutputContract(
      this.conflictEngineRepository,
      this.eventPublisher,
      firmId,
    )
  }

  getConfirmDeadlineContract(firmId: string): ConfirmDeadlineOutputContract {
    return new ConfirmDeadlineOutputContract(
      new PostgresDeadlineEngineRepository(this.supabase),
      this.eventPublisher,
      firmId,
    )
  }

  // --- Accessors for downstream code ---

  getEventBus(): InProcessEventBus {
    return this.eventBus
  }

  getMatterRecordRepository(): PostgresMatterRecordRepository {
    return this.matterRecordRepository
  }

  getCourtsDivisionRepository(): PostgresCourtDivisionsRepository {
    return this.divisionsRepository
  }

  get eventPublisher() {
    return this.eventPublisher
  }
}

/**
 * Get or create the global composition root.
 */
export function getCompositionRoot(): CompositionRoot {
  if (!globalContainer) {
    globalContainer = new CompositionRoot()
  }
  return globalContainer
}

/**
 * Initialize the global composition root at application startup.
 */
export async function initializeCompositionRoot(): Promise<CompositionRoot> {
  const container = getCompositionRoot()
  await container.initialize()
  return container
}

/**
 * Shutdown the global composition root.
 */
export async function shutdownCompositionRoot(): Promise<void> {
  if (globalContainer) {
    await globalContainer.shutdown()
    globalContainer = null
  }
}
