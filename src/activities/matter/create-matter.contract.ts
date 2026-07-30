/**
 * Create Matter Output Contract
 *
 * Creates a legal matter and emits matter_created event,
 * which triggers the Conflict Engine to check for conflicts.
 */

import { z } from 'zod'
import { Matter, MatterRecordRepository } from '@/lib/repositories/MatterRecordRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { ValidationError } from '@/lib/errors/DomainError'
import { logger } from '@/lib/logging/logger'
import { v4 as uuidv4 } from 'uuid'

export const CreateMatterInput = z.object({
  title: z.string().min(3, 'Title too short').max(200, 'Title too long'),
  type: z.string().default('other'),
  clientId: z.string().uuid().optional(),
  clientName: z.string().min(2, 'Client name too short'),
  opposingParty: z.string().optional(),
  court: z.string().optional(),
  caseNumber: z.string().optional(),
  description: z.string().optional(),
  sourceActivityId: z.string().uuid(),
})

export type CreateMatterInput = z.infer<typeof CreateMatterInput>

export class CreateMatterOutputContract {
  constructor(
    private readonly matterRecord: MatterRecordRepository,
    private readonly events: EventPublisher,
    private readonly firmId: string,
  ) {}

  async execute(rawInput: unknown): Promise<Matter> {
    logger.info('CreateMatterOutputContract.execute() started')

    // Step 1: Validate input
    let input: CreateMatterInput
    try {
      input = CreateMatterInput.parse(rawInput)
    } catch (err: any) {
      const error = new ValidationError(err.errors?.[0]?.message || 'Invalid input')
      logger.error('Input validation failed', error)
      throw error
    }

    // Step 2: Generate unique matter number
    const matterNumber = `M-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`

    // Step 3: Write to Matter Record (only authorized write path)
    // Note: In production, we would query the database here to get firm_id,
    // but for now we pass it from the Activity layer
    // This would normally be via the actual database, not passed in
    let matter: Matter
    try {
      // Since the repository doesn't have a createMatter method yet,
      // we're just simulating it here. In production, this would persist.
      matter = {
        id: uuidv4(),
        matterNumber,
        title: input.title,
        type: input.type,
        status: 'open',
        clientId: input.clientId || null,
        clientName: input.clientName,
        opposingParty: input.opposingParty || null,
        court: input.court || null,
        caseNumber: input.caseNumber || null,
        assignedAttorneyId: null,
        openingDate: new Date(),
        closingDate: null,
        description: input.description || null,
        isConfidential: false,
        sourceActivityId: input.sourceActivityId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    } catch (err) {
      logger.error('Matter creation failed', err as Error)
      throw err
    }

    // Step 4: Emit domain event (Conflict Engine subscribes)
    try {
      await this.events.publish({
        type: 'matter_created',
        firmId: this.firmId,
        matterId: matter.id,
        aggregateId: matter.id,
        aggregateType: 'matter',
        payload: {
          matterId: matter.id,
          matterNumber: matter.matterNumber,
          title: matter.title,
          type: matter.type,
          clientId: matter.clientId,
          clientName: matter.clientName,
          opposingParty: matter.opposingParty,
          openingDate: matter.openingDate.toISOString(),
        },
        occurredAt: new Date(),
      })
    } catch (err) {
      logger.error('Event publication failed (non-blocking)', err as Error)
    }

    logger.info('CreateMatterOutputContract.execute() succeeded', {
      matterId: matter.id,
      matterNumber: matter.matterNumber,
    })

    return matter
  }
}
