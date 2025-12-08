import { Message, ToolDefinition } from '../types/index';
import { ValidationError } from './errors';

/**
 * Validates the structure of a message
 */
export function validateMessage(message: unknown): message is Message {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;
  
  if (typeof msg.role !== 'string' || !['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
    return false;
  }

  if (msg.content === undefined || msg.content === null) {
    return false;
  }

  if (msg.role === 'tool' && (typeof msg.tool_call_id !== 'string' || msg.tool_call_id.length === 0)) {
    return false;
  }

  if (typeof msg.content === 'string') {
    return true;
  }

  if (Array.isArray(msg.content)) {
    return msg.content.every((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const contentItem = item as Record<string, unknown>;
      return (
        typeof contentItem.type === 'string' &&
        ['text', 'image', 'input_text', 'input_file'].includes(contentItem.type)
      );
    });
  }

  return false;
}

/**
 * Validates the structure of a tool definition
 */
export function validateTool(tool: unknown): tool is ToolDefinition {
  if (!tool || typeof tool !== 'object') {
    return false;
  }

  const t = tool as Record<string, unknown>;
  
  // Validate tool name: must be non-empty string, reasonable length, and valid format
  if (typeof t.name !== 'string' || t.name.length === 0 || t.name.length > 64) {
    return false;
  }
  
  // Tool names should be alphanumeric with underscores/hyphens (common API requirement)
  if (!/^[a-zA-Z0-9_-]+$/.test(t.name)) {
    return false;
  }

  if (typeof t.description !== 'string' || t.description.length === 0) {
    return false;
  }

  if (!t.input_schema || typeof t.input_schema !== 'object') {
    return false;
  }

  const schema = t.input_schema as Record<string, unknown>;
  if (schema.type !== 'object') {
    return false;
  }

  return true;
}

/**
 * Validates the chat request body
 * Note: Provider is selected via environment variable, not request body
 */
export function validateChatRequest(body: unknown): {
  messages: Message[];
  tools?: ToolDefinition[];
} {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const request = body as Record<string, unknown>;

  if (!request.messages || !Array.isArray(request.messages)) {
    throw new ValidationError('Messages must be a non-empty array');
  }

  if (request.messages.length === 0) {
    throw new ValidationError('Messages array cannot be empty');
  }

  const messages = request.messages.map((msg, index) => {
    if (!validateMessage(msg)) {
      throw new ValidationError(`Invalid message format at index ${index}`);
    }
    return msg;
  });

  let tools: ToolDefinition[] | undefined;
  if (request.tools !== undefined) {
    if (!Array.isArray(request.tools)) {
      throw new ValidationError('Tools must be an array');
    }

    tools = request.tools.map((tool, index) => {
      if (!validateTool(tool)) {
        throw new ValidationError(`Invalid tool format at index ${index}`);
      }
      return tool;
    });
  }

  return { messages, tools };
}

