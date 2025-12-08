import React from 'react';
import { ThinkingMessage } from './ThinkingMessage';
import type { ChatMessage as ChatMessageType, ToolCall } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <div className={`message message-${message.role}`} role="article" aria-label={`${message.role} message`}>
      <div className="message-role" aria-hidden="true">{message.role}</div>
      {message.thinking && <ThinkingMessage thinking={message.thinking} />}
      <div className="message-content">{message.content}</div>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="tool-calls" role="list" aria-label="Tool calls">
          {message.toolCalls.map((tc: ToolCall) => (
            <div key={tc.id} className="tool-call" role="listitem">
              {tc.function.name}({tc.function.arguments})
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

