import { Message, ToolDefinition, MessageContent } from '../types/index';
import { AIProvider, AIProviderType } from '../interfaces/ai-provider.interface';
import { CLAUDE_CONFIG } from '../config/constants';
import { ProviderError, ConfigurationError } from '../utils/errors';

function formatContentToString(content: string | MessageContent[] | unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (item.type === 'text' && item.text ? item.text : JSON.stringify(item)))
      .join('\n');
  }
  return JSON.stringify(content);
}

function formatMessagesForClaude(messages: Message[]) {
  return messages.map((msg) => {
    if (msg.role === 'tool' && msg.tool_call_id) {
      return {
        role: 'user' as const,
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: msg.tool_call_id,
            content: formatContentToString(msg.content),
          },
        ],
      };
    }

    if (msg.role === 'system') {
      return {
        role: 'user' as const,
        content: formatContentToString(msg.content),
      };
    }

    return {
      role: msg.role as 'user' | 'assistant',
      content: formatContentToString(msg.content),
    };
  });
}

export class ClaudeService implements AIProvider {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new ConfigurationError('Claude API key is required');
    }
  }

  getProviderType(): AIProviderType {
    return 'claude';
  }
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