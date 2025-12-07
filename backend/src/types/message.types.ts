/**
 * Message-related type definitions
 * AI SDK standard message format compatible with most LLMs
 */

export interface MessageContent {
  type: 'text' | 'image' | 'input_text' | 'input_file';
  text?: string;
  data?: any;
  mimeType?: string;
}

export interface Message {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContent[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  createdAt?: Date;
}

export interface ToolCall {
  id: string; // e.g. "call_abc123"
  type: 'function';
  function: {
    name: string;      // tool name, e.g. "filterTable"
    arguments: string; // JSON string from the model
  };
}

