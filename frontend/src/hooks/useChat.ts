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

  // Keep messagesRef in sync without causing re-renders
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

    try {
      const backendMessages = newMessages
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
        .filter((msg) => msg.content.trim().length > 0);

      abortControllerRef.current = await sendChatRequest(
        {
          messages: backendMessages,
          tools: tableToolDefinitions,
        },
        {
          onText: (text) => {
            setStreamingText(text);
          },
          onThinking: (thinking) => {
            setStreamingThinking(thinking);
          },
          onComplete: (text, toolCalls, thinking) => {
            const assistantMessage: ChatMessage = {
              id: `msg-${Date.now() + 1}`,
              role: 'assistant',
              content: text || '',
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              thinking: thinking || undefined,
            };

            setMessages((prev) => {
              const newMessages = [...prev, assistantMessage];
              return newMessages;
            });
            setStreamingText('');
            setStreamingThinking('');
            setIsStreaming(false);
            abortControllerRef.current = null;

            if (toolCalls.length > 0) {
              onToolCalls?.(toolCalls);
            }
          },
          onError: (error) => {
            setIsStreaming(false);
            setStreamingText('');
            setStreamingThinking('');
            abortControllerRef.current = null;

            const errorMsg = getUserFriendlyError(error);
            onError?.(errorMsg);
          },
        }
      );
    } catch (error) {
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThinking('');
      abortControllerRef.current = null;

      // Don't show error for aborted requests
      if (error instanceof Error && error.name !== 'AbortError') {
        const errorMsg = getUserFriendlyError(error);
        onError?.(errorMsg);
      }
    }
  }, [input, isStreaming, onToolCalls, onError]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThinking('');
    }
  }, []);

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
    cancelRequest,
    handleKeyPress,
    messagesEndRef,
  };
}

