import type { ToolCall, TableRow, TableState, ColumnFilterValue } from '../types';
import type { Row } from '@tanstack/react-table';

const VALID_COLUMNS = ['id', 'name', 'amount', 'status', 'date', 'category'] as const;
type ValidColumn = typeof VALID_COLUMNS[number];

function normalizeColumn(column: string): ValidColumn | null {
  const normalized = column.toLowerCase().trim() as string;
  if (VALID_COLUMNS.includes(normalized as ValidColumn)) {
    return normalized as ValidColumn;
  }
  return null;
}

export interface ToolExecutionResult {
  success: boolean;
  message?: string;
  newState: TableState;
}

function validateColumn(column: unknown): { success: false } | { success: true; column: ValidColumn } {
  if (!column || typeof column !== 'string') {
    return { success: false };
  }
  const normalized = normalizeColumn(column);
  if (!normalized) {
    return { success: false };
  }
  return { success: true, column: normalized };
}

function parseToolArgs(argsStr: string): { success: true; args: Record<string, unknown> } | { success: false; message: string } {
  try {
    const args = JSON.parse(argsStr);
    return { success: true, args };
  } catch (parseError) {
    return {
      success: false,
      message: `Failed to parse tool arguments: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
    };
  }
}

function createErrorResult(message: string, currentState: TableState): ToolExecutionResult {
  return { success: false, message, newState: currentState };
}

export function executeToolCall(
  toolCall: ToolCall,
  currentState: TableState
): ToolExecutionResult {
  try {
    const parsed = parseToolArgs(toolCall.function.arguments);
    if (!parsed.success) {
      return createErrorResult(parsed.message, currentState);
    }
    const args = parsed.args;
    const newState: TableState = { ...currentState };

    switch (toolCall.function.name) {
      case 'filterTable': {
        const { column, operator, value } = args;
        const columnValidation = validateColumn(column);
        if (!columnValidation.success) {
          return createErrorResult(
            !column || typeof column !== 'string'
              ? 'Column parameter is required and must be a string'
              : `Invalid column "${column}". Valid columns are: ${VALID_COLUMNS.join(', ')}`,
            currentState
          );
        }

        if (!operator || typeof operator !== 'string') {
          return createErrorResult('Operator parameter is required and must be a string', currentState);
        }

        if (value === undefined || value === null) {
          return createErrorResult('Value parameter is required for filtering', currentState);
        }

        newState.columnFilters = [{ id: columnValidation.column, value: { operator, value } }];
        return {
          success: true,
          message: `Filtered by ${columnValidation.column} ${operator} ${value}`,
          newState,
        };
      }

      case 'sortTable': {
        const { column, direction } = args;
        const columnValidation = validateColumn(column);
        if (!columnValidation.success) {
          return createErrorResult(
            !column || typeof column !== 'string'
              ? 'Column parameter is required and must be a string'
              : `Invalid column "${column}". Valid columns are: ${VALID_COLUMNS.join(', ')}`,
            currentState
          );
        }

        if (!direction || (direction !== 'asc' && direction !== 'desc')) {
          return createErrorResult('Direction must be "asc" or "desc"', currentState);
        }

        newState.sorting = [{ id: columnValidation.column, desc: direction === 'desc' }];
        return {
          success: true,
          message: `Sorted by ${columnValidation.column} (${direction})`,
          newState,
        };
      }

      case 'addRow': {
        const { name, amount, status, date, category } = args;
        
        if (
          typeof name !== 'string' ||
          typeof date !== 'string' ||
          typeof category !== 'string' ||
          (status !== 'active' && status !== 'inactive' && status !== 'pending')
        ) {
          return {
            success: false,
            message: 'Invalid row data. All fields are required with correct types.',
            newState: currentState,
          };
        }
        
        const newRow: TableRow = {
          id: `row-${Date.now()}`,
          name,
          amount: Number(amount),
          status,
          date,
          category,
        };
        newState.data = [...currentState.data, newRow];
        return {
          success: true,
          message: `Added row: ${name}`,
          newState,
        };
      }

      case 'deleteRow': {
        const { rowId } = args;
        newState.data = currentState.data.filter((row) => row.id !== rowId);
        return {
          success: true,
          message: `Deleted row ${rowId}`,
          newState,
        };
      }

      case 'clearFilters': {
        newState.columnFilters = [];
        return {
          success: true,
          message: 'Cleared all filters',
          newState,
        };
      }

      case 'clearSorting': {
        newState.sorting = [];
        return {
          success: true,
          message: 'Cleared sorting',
          newState,
        };
      }

      default:
        return createErrorResult(`Unknown tool: ${toolCall.function.name}`, currentState);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResult(`Error executing tool: ${message}`, currentState);
  }
}

function isNumericValue(value: unknown): boolean {
  return typeof value === 'number' || (!isNaN(Number(value)) && String(value).trim() !== '');
}

function compareStrings(a: string, b: string, operator: '==' | '!='): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  return operator === '==' ? aLower === bLower : aLower !== bLower;
}

export function customFilterFn(
  row: Row<TableRow>,
  columnId: string,
  filterValue: ColumnFilterValue
): boolean {
  if (!filterValue?.operator || filterValue.value === undefined) {
    return true;
  }

  const { operator, value } = filterValue;
  const cellValue = row.getValue(columnId);
  const isCellNumeric = typeof cellValue === 'number';
  const isBothNumeric = isCellNumeric || (isNumericValue(cellValue) && isNumericValue(value));

  switch (operator) {
    case '>':
      return Number(cellValue) > Number(value);
    case '<':
      return Number(cellValue) < Number(value);
    case '>=':
      return Number(cellValue) >= Number(value);
    case '<=':
      return Number(cellValue) <= Number(value);
    case '==':
    case '!=':
      if (isBothNumeric) {
        const numCell = Number(cellValue);
        const numVal = Number(value);
        return operator === '==' ? numCell === numVal : numCell !== numVal;
      }
      return compareStrings(String(cellValue), String(value), operator);
    case 'contains':
      return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
    case 'startsWith':
      return String(cellValue).toLowerCase().startsWith(String(value).toLowerCase());
    case 'endsWith':
      return String(cellValue).toLowerCase().endsWith(String(value).toLowerCase());
    default:
      return true;
  }
}

