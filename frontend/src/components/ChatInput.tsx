import React, { forwardRef } from 'react';
import { INPUT_MAX_LENGTH } from '../config/constants';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export const ChatInput = forwardRef<HTMLInputElement, ChatInputProps>(({
  value,
  onChange,
  onSend,
  onCancel,
  onKeyPress,
  disabled = false,
  isStreaming = false,
  placeholder = "Ask anything",
}, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= INPUT_MAX_LENGTH) {
      onChange(newValue);
    }
  };

  const remainingChars = INPUT_MAX_LENGTH - value.length;
  const isNearLimit = remainingChars < 100;
  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <input
          ref={ref}
          className="chat-input"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Chat input"
          aria-busy={disabled}
          maxLength={INPUT_MAX_LENGTH}
        />
        
        {isStreaming ? (
          <button
            className="chat-input-icon stop-button-icon"
            onClick={onCancel}
            type="button"
            aria-label="Stop request"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect 
                x="4" 
                y="4" 
                width="12" 
                height="12" 
                rx="2"
                fill="#000"
              />
            </svg>
          </button>
        ) : (
          <button
            className="chat-input-icon send-button-icon"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            type="button"
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M2.5 17.5L17.5 10L2.5 2.5M2.5 17.5L2.5 12.5L12.5 10L2.5 7.5L2.5 2.5" 
                stroke={value.trim() && !disabled ? "#000" : "#ccc"} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        )}
      </div>
      {isNearLimit && (
        <div className="char-count" aria-live="polite">
          {remainingChars} characters remaining
        </div>
      )}
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

