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
  return messages
    .filter((msg) => {
      if (msg.role === 'assistant' && (!msg.content || (typeof msg.content === 'string' && msg.content.trim() === '')) && !msg.tool_calls) {
        return false;
      }
      return true;
    })
    .map((msg) => {
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

      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const contentArray: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> = [];
        
        if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
          contentArray.push({
            type: 'text',
            text: msg.content,
          });
        }
        
        for (const toolCall of msg.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            contentArray.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: args,
            });
          } catch (e) {
            contentArray.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: {},
            });
          }
        }
        
        return {
          role: 'assistant' as const,
          content: contentArray,
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
      }
      
      throw new ProviderError(errorMessage, 'claude', response.status);
    }

    if (!response.body) {
      throw new ProviderError('No response body from Claude', 'claude', 502);
    }

    return response;
  }
}