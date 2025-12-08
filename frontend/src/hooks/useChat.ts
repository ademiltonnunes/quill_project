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
  streamingToolCalls: ToolCall[];
  isExecutingTool: boolean;
  sendMessage: () => Promise<void>;
  sendToolResults: (toolResults: Array<{ toolCallId: string; result: string; success: boolean }>) => Promise<void>;
  cancelRequest: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseChatOptions {
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onError?: (error: string) => void;
  onToolExecutionStart?: () => void;
  onToolExecutionEnd?: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { onToolCalls, onError, onToolExecutionStart, onToolExecutionEnd } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortControllerRef = useRef<AbortableChatRequest | null>(null);
  const streamingAssistantMessageIdRef = useRef<string | null>(null);
  const streamingTextRef = useRef<string>('');
  const streamingToolCallsRef = useRef<ToolCall[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const resetStreamingState = useCallback(() => {
    setIsStreaming(false);
    setStreamingText('');
    setStreamingToolCalls([]);
    streamingTextRef.current = '';
    streamingToolCallsRef.current = [];
    streamingAssistantMessageIdRef.current = null;
    abortControllerRef.current = null;
  }, []);

  const formatMessagesForBackend = useCallback((msgs: ChatMessage[]) => {
    return msgs
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
        ...(msg.toolCalls && msg.toolCalls.length > 0 && { 
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        }),
      }))
      .filter((msg) => {
        if (msg.role === 'tool') {
          return true;
        }
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
          return true;
        }
        return msg.content.trim().length > 0;
      });
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    const currentMessages = messagesRef.current;
    const newMessages = [...currentMessages, userMessage];
    setMessages(newMessages);
    setInput('');

    const assistantMessageId = `msg-assistant-${Date.now()}`;
    streamingAssistantMessageIdRef.current = assistantMessageId;
    
    const initialAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      toolCalls: undefined,
    };
    
    setMessages((prev) => [...prev, initialAssistantMessage]);
    
    setIsStreaming(true);
    setStreamingText('');
    setStreamingToolCalls([]);
    streamingTextRef.current = '';
    streamingToolCallsRef.current = [];

    try {
      abortControllerRef.current = await sendChatRequest(
        {
          messages: formatMessagesForBackend(newMessages),
          tools: tableToolDefinitions,
        },
        {
          onText: (text) => {
            setStreamingText(text);
            streamingTextRef.current = text;
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingAssistantMessageIdRef.current
                  ? { ...msg, content: text }
                  : msg
              )
            );
          },
          
          onToolCalls: (toolCalls) => {
            setStreamingToolCalls(toolCalls);
            streamingToolCallsRef.current = toolCalls;
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingAssistantMessageIdRef.current
                  ? { ...msg, toolCalls: toolCalls }
                  : msg
              )
            );
          },
          
          onComplete: (text, toolCalls) => {
            const finalText = text || streamingTextRef.current || '';
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingAssistantMessageIdRef.current
                  ? {
                      ...msg,
                      content: finalText,
                      toolCalls: toolCalls.length > 0 ? toolCalls : msg.toolCalls,
                    }
                  : msg
              )
            );
            
            if (toolCalls.length > 0) {
              setIsExecutingTool(true);
              onToolExecutionStart?.();
              onToolCalls?.(toolCalls);
            } else {
              resetStreamingState();
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
  }, [input, isStreaming, onToolCalls, onError, formatMessagesForBackend, resetStreamingState]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      resetStreamingState();
    }
  }, [resetStreamingState]);

  const sendToolResults = useCallback(
    async (toolResults: Array<{ toolCallId: string; result: string; success: boolean }>) => {
      if (toolResults.length === 0) {
        setIsExecutingTool(false);
        onToolExecutionEnd?.();
        resetStreamingState();
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const toolResultMessages: ChatMessage[] = toolResults.map((tr, index) => ({
        id: `tool-result-${Date.now()}-${index}`,
        role: 'tool' as const,
        content: tr.result,
        toolCallId: tr.toolCallId,
      }));

      const assistantMessageId = `msg-assistant-${Date.now()}`;
      streamingAssistantMessageIdRef.current = assistantMessageId;
      
      const followUpAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        toolCalls: undefined,
      };

      const currentMessages = messagesRef.current;
      const newMessages = [...currentMessages, ...toolResultMessages, followUpAssistantMessage];
      
      setMessages(newMessages);
      
      setIsStreaming(true);
      setStreamingText('');
      setStreamingToolCalls([]);
      streamingTextRef.current = '';
      streamingToolCallsRef.current = [];

      try {
        const messagesForBackend = [...currentMessages, ...toolResultMessages];
        
        abortControllerRef.current = await sendChatRequest(
          {
            messages: formatMessagesForBackend(messagesForBackend),
            tools: tableToolDefinitions,
          },
          {
            onText: (text) => {
              setStreamingText(text);
              streamingTextRef.current = text;
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamingAssistantMessageIdRef.current
                    ? { ...msg, content: text }
                    : msg
                )
              );
            },
            
            onToolCalls: (toolCalls) => {
              setStreamingToolCalls(toolCalls);
              streamingToolCallsRef.current = toolCalls;
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamingAssistantMessageIdRef.current
                    ? { ...msg, toolCalls: toolCalls }
                    : msg
                )
              );
            },
            
            onComplete: (text, toolCalls) => {
              const finalText = text || streamingTextRef.current || '';
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamingAssistantMessageIdRef.current
                    ? {
                        ...msg,
                        content: finalText,
                        toolCalls: toolCalls.length > 0 ? toolCalls : msg.toolCalls,
                      }
                    : msg
                )
              );
              
              if (toolCalls.length > 0) {
                setIsExecutingTool(true);
                onToolExecutionStart?.();
                onToolCalls?.(toolCalls);
              } else {
                setIsExecutingTool(false);
                onToolExecutionEnd?.();
                resetStreamingState();
              }
            },
            
            onError: (error) => {
              setIsExecutingTool(false);
              onToolExecutionEnd?.();
              resetStreamingState();
              onError?.(getUserFriendlyError(error));
            },
          }
        );
      } catch (error) {
        setIsExecutingTool(false);
        onToolExecutionEnd?.();
        resetStreamingState();
        if (error instanceof Error && error.name !== 'AbortError') {
          onError?.(getUserFriendlyError(error));
        }
      }
    },
    [onToolCalls, onError, formatMessagesForBackend, resetStreamingState]
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
    streamingToolCalls,
    isExecutingTool,
    sendMessage,
    sendToolResults,
    cancelRequest,
    handleKeyPress,
    messagesEndRef,
  };
}
