/**
 * Domain-level error types. Never surface raw database errors to the Activity/UI layer.
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(
    entity: string,
    id: string,
  ) {
    super(`${entity} not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class ConcurrencyError extends Error {
  constructor(message: string = 'Concurrent modification detected') {
    super(message)
    this.name = 'ConcurrencyError'
  }
}

export class PersistenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PersistenceError'
  }
}

/**
 * Translate raw database errors into domain-level errors.
 * This is where database-specific error codes become domain concepts.
 */
export function translatePersistenceError(dbError: any): Error {
  if (!dbError) return new PersistenceError('Unknown persistence error')

  const message = typeof dbError === 'string' ? dbError : dbError.message || ''

  // PostgreSQL error codes
  if (dbError.code === '42P01' || /relation.*does not exist/i.test(message)) {
    return new PersistenceError(`Table does not exist: ${message}`)
  }
  if (dbError.code === '23505' || /unique constraint/i.test(message)) {
    return new ConflictError(`Unique constraint violation: ${message}`)
  }
  if (dbError.code === '23503' || /foreign key constraint/i.test(message)) {
    return new ConflictError(`Foreign key constraint violation: ${message}`)
  }
  if (/concurrent.*update|optimistic.*lock/i.test(message)) {
    return new ConcurrencyError(message)
  }

  return new PersistenceError(message)
}
