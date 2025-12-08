import { Env } from '../types/index';
import { AIProviderFactory } from '../services/ai-provider.factory';
import { createProxyStream } from '../utils/stream';
import { createCorsResponse } from '../utils/cors';
import { CLAUDE_CONFIG } from '../config/constants';
import { validateChatRequest } from '../utils/validation';
import { ValidationError, ConfigurationError, ProviderError } from '../utils/errors';
import { Message, ToolDefinition } from '../types/index';

const SYSTEM_PROMPT = `
You are a helpful assistant managing a data table with columns: name, amount, status, date, category.

CRITICAL: Always provide a text response after using tools with a summary of the actions taken.

TOOLS:
- filterTable: Filter rows (operators: ==, !=, >, <, >=, <=, contains, startsWith, endsWith)
  * For date column: Use >, <, >=, <=, ==, != with dates in YYYY-MM-DD format (e.g., "2024-01-15")
  * Examples: "show items after 2024-01-01" → filterTable(date > '2024-01-01')
- sortTable: Sort by column (asc/desc)
- addRow: Add new rows (date must be YYYY-MM-DD format)
- deleteRow: Delete rows by name, column/value, or rowId
  * Examples: "delete Widget A" → deleteRow(name='Widget A')
  * "delete all inactive items" → deleteRow(column='status', value='inactive')
- clearFilters/clearSorting: Reset filters/sorting

FILTER RULES:
1. Filters are ADDITIVE - new filters combine with existing ones automatically
2. Only apply NEW filters requested - don't re-apply existing ones
3. Only call clearFilters when user explicitly says "clear", "reset", "remove filters"
4. "keep only X" means filterTable(X), NOT clearFilters first

EXAMPLES:
- "keep only active" → filterTable(status == 'active')
- Then "also sports" → filterTable(category contains 'sport') ONLY
- "reset and show pending" → clearFilters, then filterTable(status == 'pending')
- "show items from 2024" → filterTable(date >= '2024-01-01')
- "delete Widget A" → deleteRow(name='Widget A')

After executing tools, always respond with text like: "Filtered table to show only active items."
`;

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