import React from 'react';
import type { ChatMessage as ChatMessageType, ToolCall } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
  showLoading?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, showLoading = false }) => {
  if (message.role === 'tool') {
    return (
      <div className={`message message-${message.role}`} role="article" aria-label={`${message.role} message`}>
        <div className="message-role" aria-hidden="true">tool result</div>
        <div className="message-content tool-result">
          <span className="tool-result-icon">✓</span>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`message message-${message.role}`} role="article" aria-label={`${message.role} message`}>
      <div className="message-role" aria-hidden="true">{message.role}</div>
      {message.content && message.content.trim() && (
        <div className="message-content">{message.content}</div>
      )}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="tool-calls" role="list" aria-label="Tool calls">
          <div className="tool-calls-header">Executing tools:</div>
          {message.toolCalls.map((tc: ToolCall) => (
            <div key={tc.id} className="tool-call" role="listitem">
              <span className="tool-call-name">{tc.function.name}</span>
              <span className="tool-call-args">({tc.function.arguments})</span>
            </div>
          ))}
        </div>
      )}
      {showLoading && (
        <div className="message-loading" aria-label="Loading">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
};

