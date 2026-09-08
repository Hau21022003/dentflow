import { BadRequestException } from '@nestjs/common';
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { SortOrder } from '../dto/page-list-query.dto';

export interface OffsetPage {
  page: number;
  limit: number;
}

export interface PageMeta extends OffsetPage {
  total: number;
  totalPages: number;
}

export interface SafeSortOptions {
  sortBy?: string;
  sortOrder?: SortOrder;
  fields: Readonly<Record<string, string>>;
  defaultField: string;
  defaultOrder: SortOrder;
  tieBreaker: string;
}

/** Applies page/limit only; callers remain responsible for filters and joins. */
export function applyOffsetPagination<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  { page, limit }: OffsetPage,
): SelectQueryBuilder<T> {
  return query.skip((page - 1) * limit).take(limit);
}

/**
 * Sort expressions are supplied by the domain as static SQL aliases. Never
 * interpolate a client-provided sort key into a query expression.
 */
export function applySafeSort<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  options: SafeSortOptions,
): SelectQueryBuilder<T> {
  const field = options.sortBy
    ? options.fields[options.sortBy]
    : options.defaultField;
  if (!field) {
    throw new BadRequestException('sortBy is not supported.');
  }

  const order = options.sortOrder ?? options.defaultOrder;
  return query
    .orderBy(field, order, 'NULLS LAST')
    .addOrderBy(options.tieBreaker, 'ASC');
}

/**
 * Search columns must be static expressions selected by the domain. They may
 * reference joined aliases, but this helper never creates joins on its own.
 */
export function applyIlikeSearch<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  search: string | undefined,
  columns: readonly string[],
  parameterName = 'search',
): SelectQueryBuilder<T> {
  const value = search?.trim();
  if (!value || columns.length === 0) {
    return query;
  }

  const parameter = `:${parameterName}`;
  return query.andWhere(
    new Brackets((searchQuery) => {
      columns.forEach((column, index) => {
        const clause = `${column} ILIKE ${parameter}`;
        if (index === 0) {
          searchQuery.where(clause);
        } else {
          searchQuery.orWhere(clause);
        }
      });
    }),
    { [parameterName]: `%${value}%` },
  );
}

export function toPageMeta(
  { page, limit }: OffsetPage,
  total: number,
): PageMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
