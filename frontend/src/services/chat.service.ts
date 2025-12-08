import { parseApiError } from '../utils/errors';
import type { ToolDefinition, ToolCall } from '../types';
import { API_BASE_URL, CHAT_ENDPOINT } from '../config/constants';

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  tools?: ToolDefinition[];
}

export interface ChatStreamCallbacks {
  onText?: (text: string) => void;
  onThinking?: (thinking: string) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onError?: (error: Error) => void;
  onComplete?: (text: string, toolCalls: ToolCall[], thinking: string) => void;
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

  // If an external signal is provided, forward its abort to our controller
  if (abortSignal) {
    abortHandler = () => {
      if (!isCleanedUp) {
        abortController.abort();
      }
    };
    abortSignal.addEventListener('abort', abortHandler);
  }

  // Cleanup function to remove event listener
  const cleanup = () => {
    if (abortSignal && abortHandler && !isCleanedUp) {
      abortSignal.removeEventListener('abort', abortHandler);
      isCleanedUp = true;
    }
  };

  // Start the request asynchronously
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
      // Don't report abort errors as user-facing errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (!(error instanceof Error && error.message === 'No response body')) {
        onError?.(error instanceof Error ? error : new Error('Unknown error'));
      }
      throw error;
    }
  })().catch(() => {
    // Error already handled in the catch block above
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
  let accumulatedThinking = '';
  let accumulatedToolCalls: ToolCall[] = [];

  const result = await parseStreamResponse(body, abortSignal, {
    onTextDelta: (text) => {
      accumulatedText += text;
      callbacks.onText?.(accumulatedText);
    },
    onThinkingDelta: (thinking) => {
      accumulatedThinking = thinking;
      callbacks.onThinking?.(thinking);
    },
    onToolCallStart: () => {},
    onToolCallDelta: () => {},
  });

  accumulatedText = result.text;
  accumulatedThinking = result.thinking;
  accumulatedToolCalls = result.toolCalls;

  if (accumulatedToolCalls.length > 0) {
    callbacks.onToolCalls?.(accumulatedToolCalls);
  }

  callbacks.onComplete?.(accumulatedText, accumulatedToolCalls, accumulatedThinking);
}

