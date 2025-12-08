import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ThinkingMessage.css';

interface ThinkingMessageProps {
  thinking: string;
  isStreaming?: boolean;
  hasReplyStarted?: boolean;
  componentId?: string;
}

const globalExpandedState = new Map<string, boolean>();
const globalUserHasInteracted = new Map<string, boolean>();

export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({ 
  thinking, 
  isStreaming = false,
  hasReplyStarted = false,
  componentId: providedComponentId
}) => {
  const componentId = useMemo(() => providedComponentId || 'streaming-thinking', [providedComponentId]);
  const hasThinkingContent = thinking && thinking.trim().length > 0;

  const getInitialExpandedState = (): boolean => {
    if (globalExpandedState.has(componentId)) {
      return globalExpandedState.get(componentId) ?? false;
    }
    const initialValue = Boolean(!isStreaming && componentId !== 'streaming-thinking' && hasThinkingContent);
    globalExpandedState.set(componentId, initialValue);
    return initialValue;
  };

  const [isExpanded, setIsExpanded] = useState(getInitialExpandedState);
  const wasStreamingRef = useRef(isStreaming);
  const hasReplyStartedRef = useRef(hasReplyStarted);
  const userHasInteractedRef = useRef(globalUserHasInteracted.get(componentId) || false);

  useEffect(() => {
    if (componentId !== 'streaming-thinking') {
      return;
    }

    const prevStreaming = wasStreamingRef.current;
    const prevHasReplyStarted = hasReplyStartedRef.current;
    wasStreamingRef.current = isStreaming;
    hasReplyStartedRef.current = hasReplyStarted;

    if (userHasInteractedRef.current) {
      return;
    }

    if (!prevStreaming && isStreaming && hasThinkingContent) {
      setIsExpanded(true);
      globalExpandedState.set(componentId, true);
    }

    if (isStreaming && hasThinkingContent && !isExpanded && !hasReplyStarted) {
      setIsExpanded(true);
      globalExpandedState.set(componentId, true);
    }

    if (isStreaming && hasReplyStarted && !prevHasReplyStarted && hasThinkingContent) {
      setIsExpanded(false);
      globalExpandedState.set(componentId, false);
    }

    if (prevStreaming && !isStreaming) {
      setIsExpanded(false);
      globalExpandedState.set(componentId, false);
      userHasInteractedRef.current = false;
      globalUserHasInteracted.set(componentId, false);
    }
  }, [isStreaming, hasReplyStarted, hasThinkingContent, isExpanded, componentId]);

  if (!isStreaming && !hasThinkingContent) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => {
      const newState = !prev;
      globalExpandedState.set(componentId, newState);
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

