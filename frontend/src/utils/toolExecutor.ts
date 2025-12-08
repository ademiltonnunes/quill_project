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

        // Check if there's an existing filter for this column
        const existingFilter = currentState.columnFilters.find(
          (f) => f.id === columnValidation.column
        );
        
        const existingFilterValue = existingFilter?.value as ColumnFilterValue | undefined;
        
        // Check if we can combine with existing filter to form a range
        const isDateColumn = columnValidation.column === 'date';
        const isDateValue = isDateColumn && isDateValueCheck(value);
        
        let newFilterValue: ColumnFilterValue;
        
        if (existingFilterValue && isDateColumn && isDateValue) {
          // Try to combine into a range filter
          const existingOp = existingFilterValue.operator;
          const existingVal = existingFilterValue.value;
          
          // Check if we're forming a range (one >= and one <=)
          if (
            (existingOp === '>=' && operator === '<=') ||
            (existingOp === '<=' && operator === '>=')
          ) {
            // Form a range filter - ensure min <= max
            let minValue: unknown;
            let maxValue: unknown;
            
            if (existingOp === '>=' && operator === '<=') {
              minValue = existingVal;
              maxValue = value;
            } else {
              // existingOp === '<=' && operator === '>='
              minValue = value;
              maxValue = existingVal;
            }
            
            // Validate that min <= max
            const minDate = new Date(String(minValue));
            const maxDate = new Date(String(maxValue));
            if (!isNaN(minDate.getTime()) && !isNaN(maxDate.getTime()) && minDate <= maxDate) {
              newFilterValue = {
                operator: 'range',
                value: minValue, // Keep for backward compatibility
                minValue,
                maxValue,
              };
            } else {
              // Invalid range, replace with new filter
              newFilterValue = { operator, value };
            }
          } else if (existingOp === 'range') {
            // Update existing range filter
            if (operator === '>=') {
              const newMin = new Date(String(value));
              const currentMax = existingFilterValue.maxValue 
                ? new Date(String(existingFilterValue.maxValue))
                : null;
              if (!isNaN(newMin.getTime()) && (!currentMax || newMin <= currentMax)) {
                newFilterValue = {
                  ...existingFilterValue,
                  minValue: value,
                  value: value, // Update main value
                };
              } else {
                newFilterValue = { operator, value };
              }
            } else if (operator === '<=') {
              const newMax = new Date(String(value));
              const currentMin = existingFilterValue.minValue 
                ? new Date(String(existingFilterValue.minValue))
                : null;
              if (!isNaN(newMax.getTime()) && (!currentMin || currentMin <= newMax)) {
                newFilterValue = {
                  ...existingFilterValue,
                  maxValue: value,
                  value: value, // Update main value
                };
              } else {
                newFilterValue = { operator, value };
              }
            } else {
              // Replace with new filter
              newFilterValue = { operator, value };
            }
          } else {
            // Replace existing filter
            newFilterValue = { operator, value };
          }
        } else {
          // No existing filter or not a date range, just set the new filter
          newFilterValue = { operator, value };
        }

        // Add or update filter for this column
        const otherFilters = currentState.columnFilters.filter(
          (f) => f.id !== columnValidation.column
        );
        newState.columnFilters = [
          ...otherFilters,
          { id: columnValidation.column, value: newFilterValue },
        ];
        
        const message = newFilterValue.operator === 'range'
          ? `Filtered by ${columnValidation.column} from ${newFilterValue.minValue} to ${newFilterValue.maxValue}`
          : `Filtered by ${columnValidation.column} ${operator} ${value}`;
        
        return {
          success: true,
          message,
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
        
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
          return {
            success: false,
            message: 'Date must be in YYYY-MM-DD format (e.g., 2024-01-15)',
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
        const { rowId, name, column, value } = args;
        
        // Support deleting by ID, name, or any column value
        let rowsToDelete: TableRow[] = [];
        
        if (rowId && typeof rowId === 'string') {
          // Delete by ID
          const row = currentState.data.find((r) => r.id === rowId);
          if (row) {
            rowsToDelete = [row];
          } else {
            return createErrorResult(`Row with ID "${rowId}" not found`, currentState);
          }
        } else if (name && typeof name === 'string') {
          // Delete by name (case-insensitive)
          rowsToDelete = currentState.data.filter((r) => 
            r.name.toLowerCase() === name.toLowerCase()
          );
          if (rowsToDelete.length === 0) {
            return createErrorResult(`No row found with name "${name}"`, currentState);
          }
        } else if (column && value !== undefined) {
          // Delete by any column value
          const columnValidation = validateColumn(column);
          if (!columnValidation.success) {
            return createErrorResult(
              `Invalid column "${column}". Valid columns are: ${VALID_COLUMNS.join(', ')}`,
              currentState
            );
          }
          
          rowsToDelete = currentState.data.filter((row) => {
            const cellValue = row[columnValidation.column];
            if (columnValidation.column === 'date') {
              // For dates, compare as strings
              return String(cellValue) === String(value);
            }
            // Case-insensitive string comparison for text fields
            return String(cellValue).toLowerCase() === String(value).toLowerCase();
          });
          
          if (rowsToDelete.length === 0) {
            return createErrorResult(
              `No rows found with ${columnValidation.column} = "${value}"`,
              currentState
            );
          }
        } else {
          return createErrorResult(
            'Must provide either rowId, name, or both column and value to delete a row',
            currentState
          );
        }
        
        // Remove all matching rows
        const idsToDelete = new Set(rowsToDelete.map((r) => r.id));
        newState.data = currentState.data.filter((row) => !idsToDelete.has(row.id));
        
        const deletedCount = rowsToDelete.length;
        const identifier = rowId 
          ? `ID "${rowId}"`
          : name 
          ? `name "${name}"`
          : `${column} = "${value}"`;
        
        return {
          success: true,
          message: `Deleted ${deletedCount} row(s) with ${identifier}`,
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

function isDateValueCheck(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(value);
}

function isDateValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(value);
}

function compareDates(date1: string, date2: string, operator: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return false;
  }
  
  switch (operator) {
    case '>':
      return d1 > d2;
    case '<':
      return d1 < d2;
    case '>=':
      return d1 >= d2;
    case '<=':
      return d1 <= d2;
    case '==':
      return d1.getTime() === d2.getTime();
    case '!=':
      return d1.getTime() !== d2.getTime();
    default:
      return false;
  }
}

export function customFilterFn(
  row: Row<TableRow>,
  columnId: string,
  filterValue: ColumnFilterValue
): boolean {
  if (!filterValue?.operator || filterValue.value === undefined) {
    return true;
  }

  const { operator, value, minValue, maxValue } = filterValue;
  const cellValue = row.getValue(columnId);
  
  // Check if this is a date column comparison
  const isDateColumn = columnId === 'date';
  const isDateComparison = isDateColumn && isDateValue(value);
  
  // Handle range filters (for date ranges like >= min AND <= max)
  if (operator === 'range' && minValue !== undefined && maxValue !== undefined && isDateColumn) {
    const cellDate = new Date(String(cellValue));
    const minDate = new Date(String(minValue));
    const maxDate = new Date(String(maxValue));
    
    if (isNaN(cellDate.getTime()) || isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) {
      return false;
    }
    
    return cellDate >= minDate && cellDate <= maxDate;
  }
  
  if (isDateComparison) {
    return compareDates(String(cellValue), String(value), operator);
  }
  
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

