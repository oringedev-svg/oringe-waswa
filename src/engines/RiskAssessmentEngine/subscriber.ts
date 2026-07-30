/**
 * Risk Assessment Engine Subscriber
 *
 * Subscribes to: legal_issue_created
 * Computes: Risk score from all legal issues in a matter
 * Output: Stores in risk_assessment_results (status: proposed)
 *
 * Rule: Engine NEVER writes to Matter Record directly.
 * Risk assessments only become facts via a "ConfirmRisk" Activity.
 */

import { DomainEvent, EventBus } from '@/lib/event-bus/EventBus'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { PostgresRiskAssessmentEngineRepository } from '@/lib/repositories/engines/RiskAssessmentEngineRepository'
import { logger } from '@/lib/logging/logger'

/**
 * Risk calculation rules.
 * In production, these would be much more sophisticated.
 */
const SEVERITY_TO_SCORE = {
  low: 10,
  medium: 30,
  high: 60,
  critical: 100,
}

const RISK_LEVEL_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
}

export class RiskAssessmentEngineSubscriber {
  constructor(
    private issuesRepository: PostgresLegalIssuesRepository,
    private riskAssessmentRepository: PostgresRiskAssessmentEngineRepository,
  ) {}

  subscribe(eventBus: EventBus): void {
    eventBus.subscribe('legal_issue_created', (event) => this.handleLegalIssueCreated(event))
    logger.info('RiskAssessmentEngine subscribed to events')
  }

  private async handleLegalIssueCreated(event: DomainEvent): Promise<void> {
    try {
      const payload = event.payload as any
      const matterId = payload.matterId
      const issueId = payload.issueId
      const issueSeverity = payload.severity

      logger.info('RiskAssessmentEngine handling legal_issue_created', {
        matterId,
        issueId,
        severity: issueSeverity,
      })

      // Get all issues for this matter
      const allIssues = await this.issuesRepository.getIssuesByMatter(matterId)

      if (!allIssues || allIssues.length === 0) {
        logger.warn('RiskAssessmentEngine: no issues found for matter', { matterId })
        return
      }

      // Calculate overall risk score
      let totalScore = 0
      const factors: string[] = []

      for (const issue of allIssues) {
        const score =
          SEVERITY_TO_SCORE[issue.severity as keyof typeof SEVERITY_TO_SCORE] || 10
        totalScore += score
        factors.push(`${issue.issueType}:${issue.severity}`)
      }

      // Average the score (weighted by number of issues)
      const avgRiskScore = Math.min(100, Math.round(totalScore / allIssues.length))

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
      if (avgRiskScore >= RISK_LEVEL_THRESHOLDS.critical) {
        riskLevel = 'critical'
      } else if (avgRiskScore >= RISK_LEVEL_THRESHOLDS.high) {
        riskLevel = 'high'
      } else if (avgRiskScore >= RISK_LEVEL_THRESHOLDS.medium) {
        riskLevel = 'medium'
      }

      // Store proposed risk assessment
      await this.riskAssessmentRepository.saveRiskAssessment({
        matterId,
        status: 'proposed',
        riskScore: avgRiskScore,
        riskLevel,
        factors,
        description: `Risk assessment based on ${allIssues.length} legal issue(s): ${factors.join(', ')}`,
        sourceEvent: 'legal_issue_created',
        computedAt: new Date(),
      })

      logger.info('RiskAssessmentEngine assessment created', {
        matterId,
        riskScore: avgRiskScore,
        riskLevel,
        issueCount: allIssues.length,
      })
    } catch (err) {
      logger.error('RiskAssessmentEngine legal_issue_created failed', err as Error, {
        eventId: event.eventId,
        matterId: event.matterId,
      })

      // Non-blocking: don't throw
    }
  }
}

/**
 * Factory function to create and subscribe a Risk Assessment Engine.
 */
export function createRiskAssessmentEngineSubscriber(
  issuesRepository: PostgresLegalIssuesRepository,
  riskAssessmentRepository: PostgresRiskAssessmentEngineRepository,
): RiskAssessmentEngineSubscriber {
  return new RiskAssessmentEngineSubscriber(issuesRepository, riskAssessmentRepository)
}
