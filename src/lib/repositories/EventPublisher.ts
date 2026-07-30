/**
 * Domain Event Publisher interface.
 * Output Contracts depend on this interface, injected at construction.
 * Concrete implementations handle the event bus integration.
 */

import { DomainEvent } from '@/lib/event-bus/EventBus'

export interface EventPublisher {
  /**
   * Publish a domain event.
   * CRITICAL: Must only be called AFTER the transaction that created the fact commits.
   * Never publish for a write that might roll back.
   */
  publish(event: DomainEvent): Promise<void>
}

/**
 * Default implementation using the global EventBus.
 */
import { getEventBus } from '@/lib/event-bus/InProcessEventBus'

export class EventBusPublisher implements EventPublisher {
  async publish(event: DomainEvent): Promise<void> {
    const bus = getEventBus()
    if (!bus.isRunning()) {
      throw new Error('EventBus is not running. Call initializeEventBus() at application startup.')
    }
    await bus.publish(event)
  }
}

/**
 * No-op publisher for testing.
 */
export class NoOpPublisher implements EventPublisher {
  async publish(event: DomainEvent): Promise<void> {
    // Do nothing; used in tests
  }
}
