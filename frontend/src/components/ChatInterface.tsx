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
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onToolCalls, onToolResultsReady }) => {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
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
  } = useChat({
    onToolCalls,
    onError: (errorMessage) => {
      setError(errorMessage);
    },
  });

  // Expose sendToolResults to parent component
  useEffect(() => {
    if (onToolResultsReady && sendToolResults) {
      onToolResultsReady(sendToolResults);
    }
  }, [onToolResultsReady, sendToolResults]);

  // Focus management: focus input after sending message
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      // Small delay to ensure DOM is updated
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
        streamingText={streamingText}
        streamingThinking={streamingThinking}
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

