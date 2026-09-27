import { type Table, flexRender } from '@tanstack/react-table'

import { TableCell, TableRow } from '@/components/ui/table'
import { TableBody } from '@/components/ui/table'

import { DataTableEmptyState } from './data-table-empty-state'

export interface DataTableBodyProps<TData> {
  emptyState?: React.ReactNode
  isLoading?: boolean
  onRowClick?: (row: TData) => void
  table: Table<TData>
}
export function DataTableBody<TData>({
  emptyState,
  isLoading,
  onRowClick,
  table,
}: DataTableBodyProps<TData>) {
  'use no memo'
  if (isLoading) {
    return (
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {table.getAllColumns().map((_, j) => (
              <TableCell key={j}>
                <div className='h-4 bg-muted animate-pulse rounded' />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    )
  }
  const columns = table.getAllColumns()
  return (
    <TableBody>
      {table.getRowModel().rows?.length ? (
        table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() && 'selected'}
            onClick={() => onRowClick?.(row.original)}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={columns.length}>
            {emptyState ?? <DataTableEmptyState />}
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  )
}
