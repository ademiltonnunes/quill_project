import React, { useState, useCallback, useEffect } from 'react';
import { DataTable } from '../components/DataTable';
import { ChatInterface } from '../components/ChatInterface';
import { TitleBar } from '../components/TitleBar';
import { ErrorMessage } from '../components/ErrorMessage';
import { generateSampleData } from '../data/sampleData';
import { executeToolCall } from '../utils/toolExecutor';
import type { ToolCall, TableRow, TableState } from '../types';
import type { SortingState, ColumnFiltersState } from '@tanstack/react-table';
import '../pages/DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toolError, setToolError] = useState<string | null>(null);
  const [isExecutingTool, setIsExecutingTool] = useState(false);

  useEffect(() => {
    const data = generateSampleData(75);
    setTableData(data);
    setIsLoading(false);
  }, []);

  const handleToolCalls = useCallback(
    (toolCalls: ToolCall[]) => {
      setIsExecutingTool(true);
      setToolError(null);

      try {
        setTableData((prevData) => {
          let currentState: TableState = {
            data: prevData,
            sorting,
            columnFilters,
            pagination: { pageIndex: 0, pageSize: 10 },
          };

          const errors: string[] = [];

          for (const toolCall of toolCalls) {
            const result = executeToolCall(toolCall, currentState);
            if (result.success) {
              currentState = result.newState;
            } else {
              errors.push(result.message || `Failed to execute ${toolCall.function.name}`);
            }
          }

          if (errors.length > 0) {
            setToolError(errors.join('. '));
          }

          setSorting(currentState.sorting);
          setColumnFilters(currentState.columnFilters);
          return currentState.data;
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to execute tool calls';
        setToolError(errorMessage);
      } finally {
        setIsExecutingTool(false);
      }
    },
    [sorting, columnFilters]
  );

  return (
    <div className="dashboard-page" aria-busy={isLoading || isExecutingTool}>
      <TitleBar />
      <div className="dashboard-content">
        <div className="data-table-section" aria-label="Data table">
          {isLoading ? (
            <div className="loading-state" role="status" aria-live="polite">
              <span>Loading data...</span>
            </div>
          ) : (
            <>
              {toolError && (
                <ErrorMessage
                  message={toolError}
                  onDismiss={() => setToolError(null)}
                />
              )}
              {isExecutingTool && (
                <div className="loading-state" role="status" aria-live="polite">
                  <span>Executing tool calls...</span>
                </div>
              )}
              <DataTable
                data={tableData}
                sorting={sorting}
                columnFilters={columnFilters}
                onSortingChange={setSorting}
                onColumnFiltersChange={setColumnFilters}
              />
            </>
          )}
        </div>
        <div className="chat-interface-section" aria-label="Chat interface">
          <ChatInterface onToolCalls={handleToolCalls} />
        </div>
      </div>
    </div>
  );
};

