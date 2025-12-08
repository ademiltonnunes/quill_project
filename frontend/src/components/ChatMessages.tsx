import React, { useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ThinkingMessage } from './ThinkingMessage';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isStreaming,
  streamingText,
  streamingThinking,
  messagesEndRef,
}) => {
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingThinking, messagesEndRef]);

  return (
    <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages" aria-busy={isStreaming}>
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        <div className="message message-assistant" aria-label="Assistant message streaming" aria-busy="true">
          <div className="message-role" aria-hidden="true">assistant</div>
          <ThinkingMessage 
            key="streaming-thinking" 
            thinking={streamingThinking} 
            isStreaming={true}
            hasReplyStarted={!!streamingText}
          />
          {streamingText && (
            <div className="message-content streaming" aria-label="Streaming response">{streamingText}</div>
          )}
        </div>
      )}
      <div ref={messagesEndRef} aria-hidden="true" />
    </div>
  );
};

