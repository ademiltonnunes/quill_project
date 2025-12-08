import React, { useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  isExecutingTool: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isStreaming,
  isExecutingTool,
  messagesEndRef,
}) => {
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messagesEndRef]);
  
  const showLoading = isStreaming || isExecutingTool;
  const lastMessage = messages[messages.length - 1];
  const isLastMessageAssistant = lastMessage?.role === 'assistant';
  const showLoadingOnLastMessage = showLoading && isLastMessageAssistant;

  return (
    <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages" aria-busy={showLoading}>
      {messages.map((msg, index) => {
        const isLast = index === messages.length - 1;
        const showLoadingForThisMessage = isLast && showLoadingOnLastMessage;
        return (
          <div key={msg.id}>
            <ChatMessage message={msg} showLoading={showLoadingForThisMessage} />
          </div>
        );
      })}
      <div ref={messagesEndRef} aria-hidden="true" />
    </div>
  );
};

