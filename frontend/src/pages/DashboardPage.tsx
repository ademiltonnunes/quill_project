import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  const sendToolResultsRef = useRef<((toolResults: Array<{ toolCallId: string; result: string; success: boolean }>) => Promise<void>) | null>(null);

  useEffect(() => {
    const data = generateSampleData(75);
    setTableData(data);
    setIsLoading(false);
  }, []);

  const handleToolCalls = useCallback(
    async (toolCalls: ToolCall[]) => {
      setToolError(null);
      setIsExecutingTool(true);
      
      // Track start time to ensure minimum display duration
      const startTime = Date.now();
      const minDisplayDuration = 300; // Minimum 300ms to ensure visibility

      try {
        const toolResults: Array<{ toolCallId: string; result: string; success: boolean }> = [];
        const errors: string[] = [];

        // Small delay to ensure React renders the loading state
        await new Promise(resolve => setTimeout(resolve, 50));

        setTableData((prevData) => {
          let currentState: TableState = {
            data: prevData,
            sorting,
            columnFilters,
            pagination: { pageIndex: 0, pageSize: 10 },
          };

          for (const toolCall of toolCalls) {
            const result = executeToolCall(toolCall, currentState);
            if (result.success) {
              currentState = result.newState;
              toolResults.push({
                toolCallId: toolCall.id,
                result: result.message || `Successfully executed ${toolCall.function.name}`,
                success: true,
              });
            } else {
              const errorMsg = result.message || `Failed to execute ${toolCall.function.name}`;
              errors.push(errorMsg);
              toolResults.push({
                toolCallId: toolCall.id,
                result: `Error: ${errorMsg}`,
                success: false,
              });
            }
          }

          setSorting(currentState.sorting);
          setColumnFilters(currentState.columnFilters);
          return currentState.data;
        });

        if (errors.length > 0) {
          setToolError(errors.join('. '));
        }

        if (sendToolResultsRef.current && toolResults.length > 0) {
          await sendToolResultsRef.current(toolResults);
        }

        // Ensure minimum display duration
        const elapsed = Date.now() - startTime;
        if (elapsed < minDisplayDuration) {
          await new Promise(resolve => setTimeout(resolve, minDisplayDuration - elapsed));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to execute tool calls';
        setToolError(errorMessage);

        if (sendToolResultsRef.current && toolCalls.length > 0) {
          const errorResults = toolCalls.map((tc) => ({
            toolCallId: tc.id,
            result: `Error: ${errorMessage}`,
            success: false,
          }));
          await sendToolResultsRef.current(errorResults);
        }
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
              <DataTable
                data={tableData}
                sorting={sorting}
                columnFilters={columnFilters}
                onSortingChange={setSorting}
                onColumnFiltersChange={setColumnFilters}
                isExecutingTool={isExecutingTool}
              />
            </>
          )}
        </div>
        <div className="chat-interface-section" aria-label="Chat interface">
          <ChatInterface 
            onToolCalls={handleToolCalls}
            onToolResultsReady={(sendToolResults) => {
              sendToolResultsRef.current = sendToolResults;
            }}
          />
        </div>
      </div>
    </div>
  );
};

