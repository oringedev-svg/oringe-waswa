/**
 * In-process event bus implementation.
 * Suitable for development and single-instance deployments.
 * For distributed deployments, upgrade to RedisEventBus.
 */

import { DomainEvent, EventBus, EventHandler } from './EventBus'
import { logger } from '@/lib/logging/logger'

export class InProcessEventBus implements EventBus {
  private subscribers = new Map<string, EventHandler[]>()
  private running = false
  private eventQueue: DomainEvent[] = []
  private processingPromise: Promise<void> | null = null

  async publish(event: DomainEvent): Promise<void> {
    event.eventId = event.eventId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    logger.info('Event published', {
      eventType: event.type,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
    })

    this.eventQueue.push(event)

    // Start processing if not already running
    if (!this.processingPromise) {
      this.processingPromise = this.processQueue()
        .catch((err) => {
          logger.error('Error processing event queue', err, {
            eventType: event.type,
          })
        })
        .finally(() => {
          this.processingPromise = null
        })
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, [])
    }
    this.subscribers.get(eventType)!.push(handler)
    logger.info('Event subscriber registered', { eventType })
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    logger.info('InProcessEventBus started')
  }

  async stop(): Promise<void> {
    this.running = false
    // Wait for any in-flight processing
    if (this.processingPromise) {
      await this.processingPromise
    }
    logger.info('InProcessEventBus stopped')
  }

  isRunning(): boolean {
    return this.running
  }

  private async processQueue(): Promise<void> {
    while (this.eventQueue.length > 0 && this.running) {
      const event = this.eventQueue.shift()!
      const handlers = this.subscribers.get(event.type) || []

      for (const handler of handlers) {
        try {
          await handler(event)
        } catch (err) {
          // Do not block on handler failure; log and continue
          logger.error('Event handler failed', err as Error, {
            eventType: event.type,
            eventId: event.eventId,
            handlerName: handler.name || 'anonymous',
          })
        }
      }
    }
  }
}

/**
 * Global in-process event bus singleton.
 * Initialized at application startup.
 */
let globalEventBus: InProcessEventBus | null = null

export function getEventBus(): InProcessEventBus {
  if (!globalEventBus) {
    globalEventBus = new InProcessEventBus()
  }
  return globalEventBus
}

export async function initializeEventBus(): Promise<InProcessEventBus> {
  const bus = getEventBus()
  await bus.start()
  return bus
}
