import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const calculatePageSize = useCallback((): number => {
    if (typeof window === 'undefined' || !containerRef.current || !tableRef.current) {
      return DEFAULT_PAGE_SIZE;
    }

    const container = containerRef.current;
    const table = tableRef.current;
    const firstRow = table.querySelector('tbody tr');
    if (!firstRow) return DEFAULT_PAGE_SIZE;

    const containerHeight = container.clientHeight;
    const paginationElement = container.querySelector('.pagination') as HTMLElement;
    const paginationHeight = paginationElement ? paginationElement.offsetHeight : 60;
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return DEFAULT_PAGE_SIZE;
    const headerHeight = (headerRow as HTMLElement).offsetHeight;
    
    const buffer = 2;
    const availableHeight = containerHeight - headerHeight - paginationHeight - buffer;
    const rowHeight = (firstRow as HTMLElement).offsetHeight;
    if (rowHeight === 0) return DEFAULT_PAGE_SIZE;
    
    const rowsThatFit = Math.floor(availableHeight / rowHeight);
    const safeRowsThatFit = Math.max(1, rowsThatFit - 1);
    const minPageSize = 3;
    const maxPageSize = 100;
    
    return Math.max(minPageSize, Math.min(maxPageSize, safeRowsThatFit));
  }, []);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    const updatePageSize = () => {
      if (!tableRef.current || !tableContainerRef.current) return;
      const rows = tableRef.current.querySelectorAll('tbody tr');
      if (rows.length === 0) return;
      
      const newPageSize = calculatePageSize();
      setPagination((prev) => {
        if (prev.pageSize !== newPageSize) {
          return {
            ...prev,
            pageSize: newPageSize,
          };
        }
        return prev;
      });
      
      requestAnimationFrame(() => {
        if (tableRef.current && tableContainerRef.current) {
          const tableHeight = tableRef.current.offsetHeight;
          tableContainerRef.current.style.height = `${tableHeight}px`;
        }
      });
    };

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.style.height = '';
      }
      setTimeout(updatePageSize, 50);
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', updatePageSize);

    const timeoutId = setTimeout(updatePageSize, 150);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePageSize);
    };
  }, [calculatePageSize, data.length, pagination.pageIndex]);

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
    <div className="data-table-container" ref={containerRef}>
      <div className="table-container" ref={tableContainerRef} style={{ position: 'relative' }}>
        {isExecutingTool && (
          <div className="tool-execution-overlay" role="status" aria-live="polite">
            <div className="tool-execution-spinner"></div>
            <span className="tool-execution-text">Executing tool calls...</span>
          </div>
        )}
        <table className="data-table" ref={tableRef}>
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

