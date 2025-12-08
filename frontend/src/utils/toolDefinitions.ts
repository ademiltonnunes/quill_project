import type { ToolDefinition } from '../types';

export const tableToolDefinitions: ToolDefinition[] = [
  {
    name: 'filterTable',
    description: 'Filter the table rows based on column criteria. Supports operators: >, <, >=, <=, ==, !=, contains, startsWith, endsWith. All string comparisons are case-insensitive (e.g., "Sport", "sport", and "SPORT" will match the same). For date column, use operators >, <, >=, <=, ==, != with dates in YYYY-MM-DD format (e.g., "2024-01-15"). IMPORTANT: Use "contains" operator for partial text matches (e.g., user says "sport" to find "Sports" category). Use "==" only for exact matches when user specifies an exact value.',
    input_schema: {
      type: 'object',
      properties: {
        column: {
          type: 'string',
          description: 'The column name to filter (name, amount, status, date, category)',
        },
        operator: {
          type: 'string',
          description: 'The comparison operator: >, <, >=, <=, ==, !=, contains, startsWith, endsWith. For date column, use >, <, >=, <=, ==, !=',
        },
        value: {
          type: 'string',
          description: 'The value to compare against. For dates, use YYYY-MM-DD format (e.g., "2024-01-15")',
        },
      },
      required: ['column', 'operator', 'value'],
    },
  },
  {
    name: 'sortTable',
    description: 'Sort the table by a column in ascending or descending order',
    input_schema: {
      type: 'object',
      properties: {
        column: {
          type: 'string',
          description: 'The column name to sort by (name, amount, status, date, category)',
        },
        direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction: asc for ascending, desc for descending',
        },
      },
      required: ['column', 'direction'],
    },
  },
  {
    name: 'addRow',
    description: 'Add a new row to the table',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the item',
        },
        amount: {
          type: 'number',
          description: 'Amount value',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending'],
          description: 'Status of the item',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
        category: {
          type: 'string',
          description: 'Category of the item',
        },
      },
      required: ['name', 'amount', 'status', 'date', 'category'],
    },
  },
  {
    name: 'deleteRow',
    description: 'Delete one or more rows from the table. You can delete by: 1) rowId (the internal ID), 2) name (the name field value), or 3) any column and value combination. Examples: delete by name "Widget A", delete rows where status="inactive", delete row with category="Electronics". If multiple rows match, all matching rows will be deleted.',
    input_schema: {
      type: 'object',
      properties: {
        rowId: {
          type: 'string',
          description: 'Optional: The ID of the row to delete. If provided, this takes precedence.',
        },
        name: {
          type: 'string',
          description: 'Optional: Delete row(s) with this name (case-insensitive match).',
        },
        column: {
          type: 'string',
          description: 'Optional: Column name to match against (name, amount, status, date, category). Must be used with value.',
        },
        value: {
          type: 'string',
          description: 'Optional: Value to match in the specified column. Must be used with column.',
        },
      },
      required: [],
    },
  },
  {
    name: 'clearFilters',
    description: 'Clear all filters from the table',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'clearSorting',
    description: 'Clear all sorting from the table',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

