import { Env } from '../types/index';
import { AIProviderFactory } from '../services/ai-provider.factory';
import { createProxyStream } from '../utils/stream';
import { createCorsResponse } from '../utils/cors';
import { CLAUDE_CONFIG } from '../config/constants';
import { validateChatRequest } from '../utils/validation';
import { ValidationError, ConfigurationError, ProviderError } from '../utils/errors';
import { Message, ToolDefinition } from '../types/index';

const SYSTEM_PROMPT = `You are a helpful assistant with access to tools for manipulating a data table. 

TABLE STRUCTURE:
The table has the following columns:
- id (string): Unique identifier for each row
- name (string): Name of the item
- amount (number): Monetary amount value
- status (string): Status can be 'active', 'inactive', or 'pending'
- date (string): Date in YYYY-MM-DD format
- category (string): Category classification

AVAILABLE OPERATIONS:
- filterTable: Filter rows based on column criteria (operators: >, <, >=, <=, ==, !=, contains, startsWith, endsWith)
- sortTable: Sort by column (ascending or descending)
- addRow: Add a new row with all required fields
- deleteRow: Delete a row by its ID
- clearFilters: Remove all active filters
- clearSorting: Remove all active sorting

IMPORTANT GUIDELINES:
- When filtering numeric columns (like 'amount'), use appropriate numeric operators (>, <, >=, <=)
- When filtering text columns:
  * Use 'contains' for partial text matches (e.g., if user says "filter sport", use contains to match "Sports", "sport", etc.)
  * Use '==' only for exact matches when the user specifies an exact value
  * Use 'startsWith' for prefix matches, 'endsWith' for suffix matches
- All string/text comparisons are case-insensitive - users don't need to worry about capitalization (e.g., "Sport", "sport", and "SPORT" will all match)
- When users provide a partial value or single word, prefer 'contains' operator over '==' for better matching
- Always provide clear, concise responses after executing tools
- If a tool execution fails, explain the error to the user and suggest corrections
- Use natural language to confirm what actions were taken

Use the available tools when appropriate to assist the user with table operations.`;

/**
 * Determines if a response is streaming based on provider and content-type
 * Checks actual response headers first, then falls back to config
 */
function isStreamingResponse(providerType: string, contentType: string): boolean {
  // Check actual response content-type first (most reliable)
  if (contentType.includes('text/event-stream')) {
    return true;
  }

  // Fall back to provider config if content-type doesn't indicate streaming
  if (providerType === 'claude') {
    return CLAUDE_CONFIG.STREAM_ENABLED;
  }
  
  return false;
}

/**
 * Handles error responses with proper error type checking
 */
function handleErrorResponse(error: unknown, env: Env): Response {
  console.error('Chat handler error:', error);
  
  if (error instanceof ValidationError) {
    return createCorsResponse(
      JSON.stringify({ error: error.message }),
      { status: error.statusCode },
      env
    );
  }

  if (error instanceof ConfigurationError) {
    return createCorsResponse(
      JSON.stringify({ error: error.message }),
      { status: 400 },
      env
    );
  }

  if (error instanceof ProviderError) {
    return createCorsResponse(
      JSON.stringify({ 
        error: error.message,
        provider: error.provider 
      }),
      { status: error.statusCode },
      env
    );
  }
  
  return createCorsResponse(
    JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again later.' 
    }),
    { status: 500 },
    env
  );
}

/**
 * Processes and sends chat request to AI provider
 * Core logic shared between regular chat and toolcall chat
 */
async function processChatRequest(
  messages: Message[],
  tools: ToolDefinition[],
  env: Env
): Promise<Response> {
  const aiProvider = AIProviderFactory.createDefault(env);
  const providerTypeName = aiProvider.getProviderType();

  let aiResponse: Response;
  try {
    aiResponse = await aiProvider.sendChatRequest(messages, tools);
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError(
      error instanceof Error ? error.message : 'Failed to send request to AI provider',
      providerTypeName,
      500
    );
  }

  const contentType = aiResponse.headers.get('content-type') || '';
  const isStreaming = isStreamingResponse(providerTypeName, contentType);

  if (isStreaming) {
    const stream = createProxyStream(aiResponse);
    return createCorsResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }, env);
  } else {
    let data: unknown;
    try {
      data = await aiResponse.json();
    } catch (error) {
      throw new ProviderError(
        'Failed to parse response from AI provider',
        providerTypeName,
        502
      );
    }

    return createCorsResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    }, env);
  }
}

/**
 * Handles chat requests with tool calling
 * Supports multiple AI providers via the AIProviderFactory
 */
export async function handleChatRequest(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return createCorsResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400 },
        env
      );
    }

    const validatedRequest = validateChatRequest(body);
    
    return await processChatRequest(
      validatedRequest.messages,
      validatedRequest.tools || [],
      env
    );
  } catch (error) {
    return handleErrorResponse(error, env);
  }
}

/**
 * Handles toolcall chat requests with a hardcoded system prompt
 * Similar to chat handler but automatically prepends a system message
 */
export async function handleToolcallChatRequest(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return createCorsResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400 },
        env
      );
    }

    const validatedRequest = validateChatRequest(body);
    
    // Prepend system message to the messages array
    const systemMessage: Message = {
      role: 'system',
      content: SYSTEM_PROMPT,
    };
    
    const messagesWithSystem = [systemMessage, ...validatedRequest.messages];
    
    return await processChatRequest(
      messagesWithSystem,
      validatedRequest.tools || [],
      env
    );
  } catch (error) {
    return handleErrorResponse(error, env);
  }
}