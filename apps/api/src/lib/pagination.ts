import { z } from 'zod';

/**
 * Zod schema for offset-based pagination query parameters.
 */
export const offsetPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Zod schema for cursor-based pagination query parameters.
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OffsetPagination = z.infer<typeof offsetPaginationSchema>;
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

/**
 * Converts offset pagination params to Prisma skip/take.
 */
export function toOffsetPrisma(params: OffsetPagination): {
  skip: number;
  take: number;
} {
  return {
    skip: (params.page - 1) * params.limit,
    take: params.limit,
  };
}

/**
 * Converts cursor pagination params to Prisma cursor/take.
 */
export function toCursorPrisma(params: CursorPagination): {
  cursor?: { id: string };
  take: number;
  skip?: number;
} {
  if (params.cursor) {
    return {
      cursor: { id: params.cursor },
      take: params.limit,
      skip: 1, // skip the cursor item itself
    };
  }
  return {
    take: params.limit,
  };
}

/**
 * Build an offset-paginated response with metadata.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: OffsetPagination
) {
  const totalPages = Math.ceil(total / params.limit);

  return {
    success: true as const,
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

/**
 * Build a cursor-paginated response with metadata.
 */
export function cursorPaginatedResponse<T extends { id: string }>(
  data: T[],
  params: CursorPagination
) {
  const hasMore = data.length === params.limit;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

  return {
    success: true as const,
    data,
    meta: {
      limit: params.limit,
      cursor: nextCursor,
      hasMore,
    },
  };
}
