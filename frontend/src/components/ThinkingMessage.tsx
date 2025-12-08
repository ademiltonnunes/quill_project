import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ThinkingMessage.css';

interface ThinkingMessageProps {
  thinking: string;
  isStreaming?: boolean;
  hasReplyStarted?: boolean;
}

// Use a global ref to persist expanded state across component instances
const globalExpandedState = new Map<string, boolean>();
const globalUserHasInteracted = new Map<string, boolean>();

export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({ 
  thinking, 
  isStreaming = false,
  hasReplyStarted = false 
}) => {
  const componentId = useMemo(() => 'streaming-thinking', []);
  const [isExpanded, setIsExpanded] = useState(() => globalExpandedState.get(componentId) || false);
  const wasStreamingRef = useRef(isStreaming);
  const hasReplyStartedRef = useRef(hasReplyStarted);
  const userHasInteractedRef = useRef(globalUserHasInteracted.get(componentId) || false);
  const hasThinkingContent = thinking && thinking.trim().length > 0;

  // Handle auto-expand/collapse based on streaming state
  useEffect(() => {
    const prevStreaming = wasStreamingRef.current;
    const prevHasReplyStarted = hasReplyStartedRef.current;
    wasStreamingRef.current = isStreaming;
    hasReplyStartedRef.current = hasReplyStarted;
    
    // Skip auto-behavior if user has manually interacted
    if (userHasInteractedRef.current) {
      return;
    }
    
    // Auto-expand when streaming starts and thinking content appears
    if (!prevStreaming && isStreaming && hasThinkingContent) {
      setIsExpanded(true);
      globalExpandedState.set(componentId, true);
    }
    
    // Auto-expand when thinking content appears during streaming (if not already expanded)
    if (isStreaming && hasThinkingContent && !isExpanded && !hasReplyStarted) {
      setIsExpanded(true);
      globalExpandedState.set(componentId, true);
    }
    
    // Auto-collapse when thinking stops and reply starts (hasReplyStarted becomes true)
    if (isStreaming && hasReplyStarted && !prevHasReplyStarted && hasThinkingContent) {
      setIsExpanded(false);
      globalExpandedState.set(componentId, false);
    }
    
    // Auto-collapse when streaming ends (true -> false transition)
    if (prevStreaming && !isStreaming) {
      setIsExpanded(false);
      globalExpandedState.set(componentId, false);
      // Reset interaction flag for next streaming session
      userHasInteractedRef.current = false;
      globalUserHasInteracted.set(componentId, false);
    }
  }, [isStreaming, hasReplyStarted, hasThinkingContent, isExpanded, componentId]);

  // Show thinking message when streaming, even if content is empty
  // Or when there's thinking content
  if (!isStreaming && (!thinking || thinking.trim() === '')) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => {
      const newState = !prev;
      globalExpandedState.set(componentId, newState);
      
      // Mark that user has manually interacted
      // This prevents auto-expand/collapse from overriding user preference
      userHasInteractedRef.current = true;
      globalUserHasInteracted.set(componentId, true);
      
      return newState;
    });
  };

  return (
    <div className="thinking-message">
      <div className="thinking-header" onClick={handleToggle}>
        <div className="thinking-label">
          <span>Thinking</span>
        </div>
        <button 
          className="thinking-toggle" 
          aria-label={isExpanded ? 'Collapse thinking' : 'Expand thinking'}
          aria-expanded={isExpanded}
          onClick={handleToggle}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      {isExpanded && (
        <div className="thinking-content" aria-live="polite">
          <pre>{thinking || (isStreaming ? '...' : '')}</pre>
        </div>
      )}
    </div>
  );
};

