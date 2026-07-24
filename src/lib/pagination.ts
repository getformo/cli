import { z } from 'incur'

export interface PaginationOptions {
  page?: number
  size?: number
}

/**
 * Shared zod fragments for paginated list commands.
 * Spread into a command's options: `z.object({ ...paginationOptionsSchema })`.
 */
export const paginationOptionsSchema = {
  page: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('Page number (1-indexed, default 1)'),
  size: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('Page size (default 100, max 200)'),
}

export function buildPaginationParams(options: PaginationOptions = {}) {
  const params: Record<string, number> = {}
  if (options.page !== undefined) params.page = options.page
  if (options.size !== undefined) params.size = options.size
  return params
}
