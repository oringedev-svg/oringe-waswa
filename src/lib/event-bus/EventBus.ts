/**
 * Domain Event Bus interface.
 * Implementations handle pub/sub, at-least-once delivery, and asynchronous processing.
 */

export interface DomainEvent {
  type: string
  firmId: string
  matterId?: string
  aggregateId?: string
  aggregateType?: string
  payload: Record<string, unknown>
  occurredAt: Date
  eventId?: string
}

export type EventHandler = (event: DomainEvent) => Promise<void>

export interface EventBus {
  /**
   * Publish an event. Published only after the transaction that created it commits.
   * Never publish for a write that might roll back.
   */
  publish(event: DomainEvent): Promise<void>

  /**
   * Subscribe to events of a specific type.
   * Handlers must be idempotent (safe to run at-least-once).
   * Multiple handlers can subscribe to the same event type.
   */
  subscribe(eventType: string, handler: EventHandler): void

  /**
   * Start consuming published events. Called once at application startup.
   * In-process implementations may be no-op.
   */
  start(): Promise<void>

  /**
   * Stop consuming events. Called on graceful shutdown.
   */
  stop(): Promise<void>

  /**
   * Check if the event bus is running.
   */
  isRunning(): boolean
}

/**
 * Markers for event handler status in database.
 */
export enum EventHandlerStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}
