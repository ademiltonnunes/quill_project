import { parseApiError } from '../utils/errors';
import type { ToolDefinition, ToolCall } from '../types';
import { API_BASE_URL, CHAT_ENDPOINT } from '../config/constants';

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_call_id?: string; // For tool result messages
  }>;
  tools?: ToolDefinition[];
}

export interface ChatStreamCallbacks {
  onText?: (text: string) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onError?: (error: Error) => void;
  onComplete?: (text: string, toolCalls: ToolCall[]) => void;
}

export interface AbortableChatRequest {
  abort: () => void;
}

export async function sendChatRequest(
  request: ChatRequest,
  callbacks: ChatStreamCallbacks = {},
  abortSignal?: AbortSignal
): Promise<AbortableChatRequest> {
  const { onError } = callbacks;
  const abortController = new AbortController();
  let abortHandler: (() => void) | null = null;
  let isCleanedUp = false;

  if (abortSignal) {
    abortHandler = () => {
      if (!isCleanedUp) {
        abortController.abort();
      }
    };
    abortSignal.addEventListener('abort', abortHandler);
  }

  const cleanup = () => {
    if (abortSignal && abortHandler && !isCleanedUp) {
      abortSignal.removeEventListener('abort', abortHandler);
      isCleanedUp = true;
    }
  };

  (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${CHAT_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const apiError = await parseApiError(response);
        const error = new Error(apiError.message) as Error & { status?: number; provider?: string };
        error.status = apiError.status;
        error.provider = apiError.provider;
        onError?.(error);
        throw error;
      }

      if (!response.body) {
        const error = new Error('No response body');
        onError?.(error);
        throw error;
      }

      await processStreamResponse(response.body, callbacks, abortController.signal);
      cleanup();
    } catch (error) {
      cleanup();
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (!(error instanceof Error && error.message === 'No response body')) {
        onError?.(error instanceof Error ? error : new Error('Unknown error'));
      }
      throw error;
    }
  })().catch(() => {
  });

  return {
    abort: () => {
      cleanup();
      abortController.abort();
    },
  };
}

async function processStreamResponse(
  body: ReadableStream<Uint8Array>,
  callbacks: ChatStreamCallbacks,
  abortSignal?: AbortSignal
): Promise<void> {
  const { parseStreamResponse } = await import('../utils/streamParser');
  let accumulatedText = '';
  let accumulatedToolCalls: ToolCall[] = [];
  const toolCallsMap = new Map<string, ToolCall>();

  const result = await parseStreamResponse(body, abortSignal, {
    onTextDelta: (text) => {
      accumulatedText += text;
      callbacks.onText?.(accumulatedText);
    },
    onToolCallStart: (toolCall) => {
      const partialToolCall: ToolCall = {
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.name,
          arguments: '{}',
        },
      };
      toolCallsMap.set(toolCall.id, partialToolCall);
      
      const currentToolCalls = Array.from(toolCallsMap.values());
      callbacks.onToolCalls?.(currentToolCalls);
    },
    onToolCallDelta: (toolCallId, jsonDelta) => {
      const toolCall = toolCallsMap.get(toolCallId);
      if (toolCall) {
        const currentArgs = toolCall.function.arguments === '{}' ? '' : toolCall.function.arguments;
        toolCall.function.arguments = currentArgs + jsonDelta;
        toolCallsMap.set(toolCallId, toolCall);
        
        const currentToolCalls = Array.from(toolCallsMap.values());
        callbacks.onToolCalls?.(currentToolCalls);
      }
    },
  });

  accumulatedText = result.text;
  accumulatedToolCalls = result.toolCalls;

  if (accumulatedToolCalls.length > 0) {
    callbacks.onToolCalls?.(accumulatedToolCalls);
  }

  callbacks.onComplete?.(accumulatedText, accumulatedToolCalls);
}

