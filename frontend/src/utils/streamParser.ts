import type { ToolCall } from '../types';

export interface StreamParseResult {
  text: string;
  toolCalls: ToolCall[];
  thinking: string;
}

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onThinkingDelta?: (thinking: string) => void;
  onToolCallStart?: (toolCall: { id: string; name: string }) => void;
  onToolCallDelta?: (toolCallId: string, jsonDelta: string) => void;
}

function parseSSEEvent(line: string): StreamEvent | { type: 'done' } | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6);
  if (data === '[DONE]') {
    return { type: 'done' };
  }

  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    return null;
  }
}

interface StreamEvent {
  type: string;
  content_block?: {
    type: string;
    id?: string;
    name?: string;
  };
  delta?: {
    type: string;
    partial_json?: string;
    text?: string;
  };
  index?: number;
  content?: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: unknown;
    }>;
  };
}

export async function parseStreamResponse(
  stream: ReadableStream<Uint8Array>,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks = {}
): Promise<StreamParseResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';
  let accumulatedThinking = '';
  let isInThinking = false;
  let tagBuffer = ''; // Buffer to handle tags split across chunks
  const toolCallsMap = new Map<string, ToolCallAccumulator>();
  const toolCallsByIndex: ToolCallAccumulator[] = [];

  function extractThinking(text: string, currentState: boolean, tagBufferRef: { value: string }): { text: string; thinking: string; isInThinking: boolean; remainingBuffer: string } {
    let result = '';
    let thinking = '';
    let inThinking = currentState;
    let i = 0;
    
    const openTag = '<thinking>';
    const closeTag = '</thinking>';
    const openTagLower = openTag.toLowerCase();
    const closeTagLower = closeTag.toLowerCase();
    
    // Prepend any remaining buffer from previous chunk
    const fullText = tagBufferRef.value + text;
    tagBufferRef.value = '';
    
    while (i < fullText.length) {
      // Check for opening tag (case-insensitive)
      if (i + openTag.length <= fullText.length) {
        const potentialOpen = fullText.substring(i, i + openTag.length).toLowerCase();
        if (potentialOpen === openTagLower) {
          inThinking = true;
          i += openTag.length;
          continue;
        }
      }
      
      // Check for closing tag (case-insensitive)
      if (i + closeTag.length <= fullText.length) {
        const potentialClose = fullText.substring(i, i + closeTag.length).toLowerCase();
        if (potentialClose === closeTagLower) {
          inThinking = false;
          i += closeTag.length;
          continue;
        }
      }
      
      // If we're near the end and might have a partial tag, buffer it
      const remainingChars = fullText.length - i;
      const maxTagLength = Math.max(openTag.length, closeTag.length);
      if (remainingChars < maxTagLength) {
        // Check if we have a potential partial tag at the end
        const partial = fullText.substring(i);
        const partialLower = partial.toLowerCase();
        if (partialLower.startsWith('<') && (partialLower.includes('thinking') || partialLower.length < maxTagLength)) {
          // Might be a partial tag, buffer it for next chunk
          tagBufferRef.value = partial;
          break;
        }
      }
      
      // Add character to appropriate buffer
      if (inThinking) {
        thinking += fullText[i];
      } else {
        result += fullText[i];
      }
      i++;
    }
    
    return { text: result, thinking, isInThinking: inThinking, remainingBuffer: tagBufferRef.value };
  }

  try {
    while (true) {
      // Check if aborted
      if (abortSignal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const parsed = parseSSEEvent(line);
        if (!parsed) continue;

        if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
          const toolUse = parsed.content_block;
          if (!toolUse.id || !toolUse.name) {
            continue;
          }
          const toolCall: ToolCallAccumulator = {
            id: toolUse.id,
            name: toolUse.name,
            arguments: '',
          };

          toolCallsMap.set(toolUse.id, toolCall);

          if (typeof parsed.index === 'number') {
            toolCallsByIndex[parsed.index] = toolCall;
          } else {
            toolCallsByIndex.push(toolCall);
          }

          callbacks.onToolCallStart?.({ id: toolUse.id, name: toolUse.name });
        }

        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
          let targetToolCall: ToolCallAccumulator | undefined;

          if (typeof parsed.index === 'number' && toolCallsByIndex[parsed.index]) {
            targetToolCall = toolCallsByIndex[parsed.index];
          } else {
            const toolCallEntries = Array.from(toolCallsMap.values());
            targetToolCall = toolCallEntries[toolCallEntries.length - 1];
          }

          if (targetToolCall && parsed.delta.partial_json) {
            targetToolCall.arguments += parsed.delta.partial_json;
            callbacks.onToolCallDelta?.(targetToolCall.id, parsed.delta.partial_json);
          }
        }

        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          if (parsed.delta.text) {
            const tagBufferRef = { value: tagBuffer };
            const extracted = extractThinking(parsed.delta.text, isInThinking, tagBufferRef);
            tagBuffer = extracted.remainingBuffer;
            isInThinking = extracted.isInThinking;
            
            if (extracted.thinking) {
              accumulatedThinking += extracted.thinking;
              callbacks.onThinkingDelta?.(accumulatedThinking);
            }
            
            if (extracted.text) {
              accumulatedText += extracted.text;
              callbacks.onTextDelta?.(extracted.text);
            }
          }
        }

        if (parsed.type === 'message' && parsed.content) {
          for (let idx = 0; idx < parsed.content.length; idx++) {
            const block = parsed.content[idx];
            if (!block) {
              continue;
            }
            
            if (block.type === 'text' && block.text) {
              const tagBufferRef = { value: tagBuffer };
              const extracted = extractThinking(block.text, isInThinking, tagBufferRef);
              tagBuffer = extracted.remainingBuffer;
              isInThinking = extracted.isInThinking;
              
              if (extracted.thinking) {
                accumulatedThinking += extracted.thinking;
                callbacks.onThinkingDelta?.(accumulatedThinking);
              }
              
              if (extracted.text) {
                accumulatedText += extracted.text;
                callbacks.onTextDelta?.(extracted.text);
              }
            }
            
            if (block.type === 'tool_use' && block.id && block.name) {
              const toolCall: ToolCallAccumulator = {
                id: block.id,
                name: block.name,
                arguments: JSON.stringify(block.input || {}),
              };
              toolCallsMap.set(block.id, toolCall);
              toolCallsByIndex[idx] = toolCall;
            }
          }
        }

        if (parsed.type === 'message_start' && parsed.message?.content) {
          for (let idx = 0; idx < parsed.message.content.length; idx++) {
            const block = parsed.message.content[idx];
            if (block && block.type === 'tool_use' && block.id && block.name) {
              const toolCall: ToolCallAccumulator = {
                id: block.id,
                name: block.name,
                arguments: JSON.stringify(block.input || {}),
              };
              toolCallsMap.set(block.id, toolCall);
              toolCallsByIndex[idx] = toolCall;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => {
    let finalArgs = tc.arguments || '{}';

    if (finalArgs && finalArgs.trim()) {
      try {
        JSON.parse(finalArgs);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('Tool call arguments may be incomplete:', tc.name, finalArgs);
        }
      }
    }

    return {
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: finalArgs,
      },
    };
  });

  return {
    text: accumulatedText,
    toolCalls,
    thinking: accumulatedThinking,
  };
}
