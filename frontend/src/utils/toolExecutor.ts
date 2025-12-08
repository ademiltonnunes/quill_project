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

export function executeToolCall(
  toolCall: ToolCall,
  currentState: TableState
): ToolExecutionResult {
  try {
    const { name, arguments: argsStr } = toolCall.function;
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argsStr);
    } catch (parseError) {
      return {
        success: false,
        message: `Failed to parse tool arguments: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
        newState: currentState,
      };
    }

    let newState: TableState = { ...currentState };

    switch (name) {
      case 'filterTable': {
        const { column, operator, value } = args;

        if (!column || typeof column !== 'string') {
          return {
            success: false,
            message: 'Column parameter is required and must be a string',
            newState: currentState,
          };
        }
        
        const normalizedColumn = normalizeColumn(column);
        if (!normalizedColumn) {
          return {
            success: false,
            message: `Invalid column "${column}". Valid columns are: ${VALID_COLUMNS.join(', ')}`,
            newState: currentState,
          };
        }
        
        if (!operator || typeof operator !== 'string') {
          return {
            success: false,
            message: 'Operator parameter is required and must be a string',
            newState: currentState,
          };
        }
        
        if (value === undefined || value === null) {
          return {
            success: false,
            message: 'Value parameter is required for filtering',
            newState: currentState,
          };
        }

        newState.columnFilters = [
          { id: normalizedColumn, value: { operator, value } },
        ];
        return {
          success: true,
          message: `Filtered by ${normalizedColumn} ${operator} ${value}`,
          newState,
        };
      }

      case 'sortTable': {
        const { column, direction } = args;

        if (!column || typeof column !== 'string') {
          return {
            success: false,
            message: 'Column parameter is required and must be a string',
            newState: currentState,
          };
        }
        
        const normalizedColumn = normalizeColumn(column);
        if (!normalizedColumn) {
          return {
            success: false,
            message: `Invalid column "${column}". Valid columns are: ${VALID_COLUMNS.join(', ')}`,
            newState: currentState,
          };
        }
        
        if (!direction || (direction !== 'asc' && direction !== 'desc')) {
          return {
            success: false,
            message: 'Direction must be "asc" or "desc"',
            newState: currentState,
          };
        }
        
        newState.sorting = [{ id: normalizedColumn, desc: direction === 'desc' }];
        return {
          success: true,
          message: `Sorted by ${normalizedColumn} (${direction})`,
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
        return {
          success: false,
          message: `Unknown tool: ${name}`,
          newState: currentState,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
      newState: currentState,
    };
  }
}

export function customFilterFn(
  row: Row<TableRow>,
  columnId: string,
  filterValue: ColumnFilterValue
): boolean {
  if (!filterValue || !filterValue.operator || filterValue.value === undefined) {
    return true;
  }

  const { operator, value } = filterValue;
  const cellValue = row.getValue(columnId);
  let comparisonValue: string | number = typeof value === 'number' ? value : String(value);
  if (typeof cellValue === 'number') {
    comparisonValue = typeof value === 'number' ? value : Number(value);
  } else if (cellValue instanceof Date || typeof cellValue === 'string') {
    comparisonValue = String(value);
  }

  switch (operator) {
    case '>':
      return Number(cellValue) > Number(comparisonValue);
    case '<':
      return Number(cellValue) < Number(comparisonValue);
    case '>=':
      return Number(cellValue) >= Number(comparisonValue);
    case '<=':
      return Number(cellValue) <= Number(comparisonValue);
    case '==':
      return String(cellValue) === String(comparisonValue);
    case '!=':
      return String(cellValue) !== String(comparisonValue);
    case 'contains':
      return String(cellValue).toLowerCase().includes(String(comparisonValue).toLowerCase());
    case 'startsWith':
      return String(cellValue).toLowerCase().startsWith(String(comparisonValue).toLowerCase());
    case 'endsWith':
      return String(cellValue).toLowerCase().endsWith(String(comparisonValue).toLowerCase());
    default:
      return true;
  }
}

