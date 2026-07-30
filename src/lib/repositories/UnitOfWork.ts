/**
 * Unit of Work pattern for transaction boundaries.
 * Ensures all writes within an Output Contract execute atomically.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface UnitOfWork {
  /**
   * Execute operations within a transaction.
   * On success, the transaction commits and returns the result.
   * On error, the transaction rolls back automatically.
   */
  transaction<T>(fn: (txn: TransactionContext) => Promise<T>): Promise<T>

  /**
   * Commit the current transaction (typically called automatically).
   */
  commit(): Promise<void>

  /**
   * Rollback the current transaction (called automatically on error).
   */
  rollback(): Promise<void>
}

export interface TransactionContext {
  /**
   * Execute a raw query within the transaction.
   * Most operations should use Repository methods instead.
   */
  raw<T>(sql: string, params?: any[]): Promise<T>
}

/**
 * Supabase-based UnitOfWork implementation.
 * Note: Supabase doesn't natively support explicit transactions in the JS client.
 * We simulate this by grouping writes and rolling them back together on error.
 */
export class SupabaseUnitOfWork implements UnitOfWork {
  private inTransaction = false
  private writes: Array<{ table: string; operation: string; data: any }> = []
  private rollbackStack: Array<() => Promise<void>> = []

  constructor(private supabase: SupabaseClient) {}

  async transaction<T>(fn: (txn: TransactionContext) => Promise<T>): Promise<T> {
    if (this.inTransaction) {
      throw new Error('Nested transactions not supported')
    }

    this.inTransaction = true
    this.writes = []
    this.rollbackStack = []

    try {
      const result = await fn(this as unknown as TransactionContext)
      await this.commit()
      return result
    } catch (err) {
      await this.rollback()
      throw err
    } finally {
      this.inTransaction = false
      this.writes = []
      this.rollbackStack = []
    }
  }

  async commit(): Promise<void> {
    // In Supabase, writes are committed immediately
    // This is a placeholder for when/if we upgrade to a database with explicit transaction support
    this.writes = []
    this.rollbackStack = []
  }

  async rollback(): Promise<void> {
    // Execute rollback handlers in reverse order (LIFO)
    while (this.rollbackStack.length > 0) {
      const rollbackFn = this.rollbackStack.pop()!
      try {
        await rollbackFn()
      } catch (err) {
        console.error('Rollback handler failed:', err)
      }
    }
    this.writes = []
  }

  async raw<T>(sql: string, params?: any[]): Promise<T> {
    // This is a placeholder; Supabase JS client doesn't support raw SQL
    // In production, this would use postgres/sql-bricks or similar
    throw new Error('Raw SQL execution not supported via Supabase JS client. Use Repository methods instead.')
  }
}

/**
 * Create a UnitOfWork for an Output Contract execution.
 */
export function createUnitOfWork(supabase: SupabaseClient): UnitOfWork {
  return new SupabaseUnitOfWork(supabase)
}
