import { Message, ToolDefinition } from '../types/index';

/**
 * Abstract interface for AI providers
 * This allows switching between different AI services (Claude, OpenAI, etc.)
 */
export interface AIProvider {
  /**
   * Sends a chat request to the AI provider with tool calling support
   * @param messages - Array of messages in the conversation
   * @param tools - Array of tool definitions available to the AI
   * @returns Streaming or non-streaming response from the AI
   */
  sendChatRequest(
    messages: Message[],
    tools: ToolDefinition[]
  ): Promise<Response>;

  /**
   * Returns the provider type identifier
   * Useful for provider-specific logic (e.g., streaming detection)
   */
  getProviderType(): AIProviderType;
}

/**
 * Supported AI provider types
 */
export type AIProviderType = 'claude' | 'openai' | 'gemini';

