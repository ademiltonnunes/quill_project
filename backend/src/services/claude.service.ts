import { Message, ToolDefinition } from '../types/index';
import { AIProvider, AIProviderType } from '../interfaces/ai-provider.interface';
import { CLAUDE_CONFIG } from '../config/constants';
import { ProviderError, ConfigurationError } from '../utils/errors';

/**
 * Converts messages to Claude API format
 * Handles both string and MessageContent array formats
 */
function formatMessagesForClaude(messages: Message[]) {
  return messages.map((msg) => {
    let content: string;
    
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .map((item) => {
          if (item.type === 'text' && item.text) {
            return item.text;
          }
          return JSON.stringify(item);
        })
        .join('\n');
    } else {
      content = JSON.stringify(msg.content);
    }
    

    const role = msg.role === 'system' || msg.role === 'tool' ? 'user' : msg.role;
    
    return {
      role,
      content,
    };
  });
}

/**
 * Service class for interacting with Claude API
 * Implements the AIProvider interface for multi-provider support
 */
export class ClaudeService implements AIProvider {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new ConfigurationError('Claude API key is required');
    }
  }

  /**
   * Returns the provider type
   */
  getProviderType(): AIProviderType {
    return 'claude';
  }

  /**
   * Sends a chat request to Claude with tool calling support
   * @returns Streaming response from Claude
   */
  async sendChatRequest(
    messages: Message[],
    tools: ToolDefinition[]
  ): Promise<Response> {
    const claudeMessages = formatMessagesForClaude(messages);

    const response = await fetch(CLAUDE_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': CLAUDE_CONFIG.API_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_CONFIG.MODEL,
        max_tokens: CLAUDE_CONFIG.MAX_TOKENS,
        messages: claudeMessages,
        ...(tools.length > 0 && { tools }),
        stream: CLAUDE_CONFIG.STREAM_ENABLED,
      }),
    });

    if (!response.ok) {
      // Limit error response size to prevent memory issues
      const errorText = await response.text().catch(() => 'Failed to read error response');
      const limitedErrorText = errorText.length > 500 ? errorText.substring(0, 500) + '...' : errorText;
      let errorMessage = `Claude API error: ${limitedErrorText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = `Claude API error: ${errorJson.error.message}`;
        }
      } catch {
        // Use original error text if parsing fails
      }
      
      throw new ProviderError(errorMessage, 'claude', response.status);
    }

    if (!response.body) {
      throw new ProviderError('No response body from Claude', 'claude', 502);
    }

    return response;
  }
}