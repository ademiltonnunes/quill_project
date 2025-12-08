import type { ToolDefinition } from '../types';

export const tableToolDefinitions: ToolDefinition[] = [
  {
    name: 'filterTable',
    description: 'Filter the table rows based on column criteria. Supports operators: >, <, >=, <=, ==, !=, contains, startsWith, endsWith',
    input_schema: {
      type: 'object',
      properties: {
        column: {
          type: 'string',
          description: 'The column name to filter (id, name, amount, status, date, category)',
        },
        operator: {
          type: 'string',
          description: 'The comparison operator: >, <, >=, <=, ==, !=, contains, startsWith, endsWith',
        },
        value: {
          type: 'string',
          description: 'The value to compare against (will be converted to appropriate type)',
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
          description: 'The column name to sort by (id, name, amount, status, date, category)',
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
    description: 'Delete a row from the table by its ID',
    input_schema: {
      type: 'object',
      properties: {
        rowId: {
          type: 'string',
          description: 'The ID of the row to delete',
        },
      },
      required: ['rowId'],
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

