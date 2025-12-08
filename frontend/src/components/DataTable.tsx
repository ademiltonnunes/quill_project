import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import type { TableRow } from '../types';
import { customFilterFn } from '../utils/toolExecutor';
import { DEFAULT_PAGE_SIZE } from '../config/constants';
import './DataTable.css';

interface DataTableProps {
  data: TableRow[];
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  onSortingChange: (sorting: SortingState) => void;
  onColumnFiltersChange: (filters: ColumnFiltersState) => void;
  isExecutingTool?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  sorting,
  columnFilters,
  onSortingChange,
  onColumnFiltersChange,
  isExecutingTool = false,
}) => {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
        filterFn: customFilterFn,
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        enableSorting: true,
        filterFn: customFilterFn,
        cell: (info) => `$${info.getValue<number>().toLocaleString()}`,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: true,
        filterFn: customFilterFn,
      },
      {
        accessorKey: 'date',
        header: 'Date',
        enableSorting: true,
        filterFn: customFilterFn,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        enableSorting: true,
        filterFn: customFilterFn,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(newSorting);
    },
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
      onColumnFiltersChange(newFilters);
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    filterFns: {
      custom: customFilterFn,
    },
  });

  return (
    <div className="data-table-container">
      <div className="table-container" style={{ position: 'relative' }}>
        {isExecutingTool && (
          <div className="tool-execution-overlay" role="status" aria-live="polite">
            <div className="tool-execution-spinner"></div>
            <span className="tool-execution-text">Executing tool calls...</span>
          </div>
        )}
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="table-header-row">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="table-header-cell"
                    onClick={header.column.getToggleSortingHandler()}
                    role="columnheader"
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                        ? 'descending'
                        : 'none'
                    }
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        header.column.getToggleSortingHandler()?.(e as unknown as React.MouseEvent);
                      }
                    }}
                  >
                    <div className="header-content">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="sort-indicator">
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
                        }[header.column.getIsSorted() as string] ?? ''}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="table-row">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="table-cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="pagination-button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Prev
        </button>
        <span className="pagination-info">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          className="pagination-button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  );
};

