import { useState, useCallback, useRef, useEffect } from 'react';
import { sendChatRequest, type AbortableChatRequest } from '../services/chat.service';
import { getUserFriendlyError } from '../utils/errors';
import { tableToolDefinitions } from '../utils/toolDefinitions';
import type { ChatMessage, ToolCall } from '../types';

export interface UseChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  sendMessage: () => Promise<void>;
  sendToolResults: (toolResults: Array<{ toolCallId: string; result: string; success: boolean }>) => Promise<void>;
  cancelRequest: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseChatOptions {
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onError?: (error: string) => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { onToolCalls, onError } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortControllerRef = useRef<AbortableChatRequest | null>(null);
  const streamingThinkingRef = useRef<string>('');

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    streamingThinkingRef.current = streamingThinking;
  }, [streamingThinking]);

  const resetStreamingState = useCallback(() => {
    setIsStreaming(false);
    setStreamingText('');
    setStreamingThinking('');
    streamingThinkingRef.current = '';
    abortControllerRef.current = null;
  }, []);

  const formatMessagesForBackend = useCallback((msgs: ChatMessage[]) => {
    return msgs
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
      }))
      .filter((msg) => msg.content.trim().length > 0);
  }, []);

  const createAssistantMessage = useCallback((text: string, toolCalls: ToolCall[], thinking: string): ChatMessage => {
    const finalThinking = streamingThinkingRef.current || thinking || '';
    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: text || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      thinking: finalThinking.trim() ? finalThinking : undefined,
    };
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    const newMessages = [...messagesRef.current, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');
    setStreamingThinking('');
    streamingThinkingRef.current = '';

    try {
      abortControllerRef.current = await sendChatRequest(
        {
          messages: formatMessagesForBackend(newMessages),
          tools: tableToolDefinitions,
        },
        {
          onText: (text) => setStreamingText(text),
          onThinking: (thinking) => {
            setStreamingThinking(thinking);
            streamingThinkingRef.current = thinking;
          },
          onComplete: (text, toolCalls, thinking) => {
            const assistantMessage = createAssistantMessage(text, toolCalls, thinking);
            setMessages((prev) => [...prev, assistantMessage]);
            resetStreamingState();
            if (toolCalls.length > 0) {
              onToolCalls?.(toolCalls);
            }
          },
          onError: (error) => {
            resetStreamingState();
            onError?.(getUserFriendlyError(error));
          },
        }
      );
    } catch (error) {
      resetStreamingState();
      if (error instanceof Error && error.name !== 'AbortError') {
        onError?.(getUserFriendlyError(error));
      }
    }
  }, [input, isStreaming, onToolCalls, onError, formatMessagesForBackend, createAssistantMessage, resetStreamingState]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      resetStreamingState();
    }
  }, [resetStreamingState]);

  const sendToolResults = useCallback(
    async (toolResults: Array<{ toolCallId: string; result: string; success: boolean }>) => {
      if (isStreaming || toolResults.length === 0) return;

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Add tool result messages to the conversation
      const toolResultMessages: ChatMessage[] = toolResults.map((tr, index) => ({
        id: `tool-result-${Date.now()}-${index}`,
        role: 'tool' as const,
        content: tr.result,
        toolCallId: tr.toolCallId,
      }));

      const newMessages = [...messagesRef.current, ...toolResultMessages];
      setMessages(newMessages);
      setIsStreaming(true);
      setStreamingText('');
      setStreamingThinking('');
      streamingThinkingRef.current = '';

      try {
        abortControllerRef.current = await sendChatRequest(
          {
            messages: formatMessagesForBackend(newMessages),
            tools: tableToolDefinitions,
          },
          {
            onText: (text) => setStreamingText(text),
            onThinking: (thinking) => {
              setStreamingThinking(thinking);
              streamingThinkingRef.current = thinking;
            },
            onComplete: (text, toolCalls, thinking) => {
              const assistantMessage = createAssistantMessage(text, toolCalls, thinking);
              setMessages((prev) => [...prev, assistantMessage]);
              resetStreamingState();
              if (toolCalls.length > 0) {
                onToolCalls?.(toolCalls);
              }
            },
            onError: (error) => {
              resetStreamingState();
              onError?.(getUserFriendlyError(error));
            },
          }
        );
      } catch (error) {
        resetStreamingState();
        if (error instanceof Error && error.name !== 'AbortError') {
          onError?.(getUserFriendlyError(error));
        }
      }
    },
    [isStreaming, onToolCalls, onError, formatMessagesForBackend, createAssistantMessage, resetStreamingState]
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return {
    messages,
    input,
    setInput,
    isStreaming,
    streamingText,
    streamingThinking,
    sendMessage,
    sendToolResults,
    cancelRequest,
    handleKeyPress,
    messagesEndRef,
  };
}

