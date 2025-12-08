import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ErrorMessage } from './ErrorMessage';
import type { ToolCall } from '../types';
import './ChatInterface.css';

interface ChatInterfaceProps {
  onToolCalls: (toolCalls: ToolCall[]) => void;
  onToolResultsReady?: (
    sendToolResults: (toolResults: Array<{ toolCallId: string; result: string; success: boolean }>) => Promise<void>
  ) => void;
  onExecutingToolChange?: (isExecuting: boolean) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onToolCalls, onToolResultsReady, onExecutingToolChange }) => {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    messages,
    input,
    setInput,
    isStreaming,
    isExecutingTool,
    sendMessage,
    sendToolResults,
    cancelRequest,
    handleKeyPress,
    messagesEndRef,
  } = useChat({
    onToolCalls,
    onError: (errorMessage) => {
      setError(errorMessage);
    },
  });

  useEffect(() => {
    if (onToolResultsReady && sendToolResults) {
      onToolResultsReady(sendToolResults);
    }
  }, [onToolResultsReady, sendToolResults]);

  useEffect(() => {
    onExecutingToolChange?.(isExecutingTool);
  }, [isExecutingTool, onExecutingToolChange]);

  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, messages.length]);

  return (
    <div className="chat-interface" aria-label="Chat interface">
      <div className="chat-header">
        <h2>Chat</h2>
      </div>
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}
      <ChatMessages
        messages={messages}
        isStreaming={isStreaming}
        isExecutingTool={isExecutingTool}
        messagesEndRef={messagesEndRef}
      />
      <ChatInput
        ref={inputRef}
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        onCancel={cancelRequest}
        onKeyPress={handleKeyPress}
        disabled={isStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
};

