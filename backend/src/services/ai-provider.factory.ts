import { AIProvider, AIProviderType } from '../interfaces/ai-provider.interface';
import { ClaudeService } from './claude.service';
import { Env } from '../types/index';
import { ConfigurationError } from '../utils/errors';

/**
 * Factory class for creating AI provider instances
 * Centralizes the logic for selecting and initializing different AI providers
 */
export class AIProviderFactory {
  /**
   * Creates an AI provider instance based on the specified type
   * @param providerType - The type of AI provider to create
   * @param env - Environment variables containing API keys
   * @returns An instance of the requested AI provider
   * @throws Error if the provider type is not supported or API key is missing
   */
  static create(providerType: AIProviderType, env: Env): AIProvider {
    switch (providerType) {
      case 'claude':
        if (!env.ANTHROPIC_API_KEY) {
          throw new ConfigurationError('ANTHROPIC_API_KEY is required for Claude provider');
        }
        return new ClaudeService(env.ANTHROPIC_API_KEY);

      case 'openai':
        // TODO: Implement OpenAI service when needed
        throw new ConfigurationError('OpenAI provider is not yet implemented');

      case 'gemini':
        // TODO: Implement Gemini service when needed
        throw new ConfigurationError('Gemini provider is not yet implemented');

      default:
        throw new ConfigurationError(`Unsupported AI provider: ${providerType}`);
    }
  }

  /**
   * Gets the AI provider from environment variable
   * @param env - Environment variables
   * @returns The AI provider instance
   * @throws ConfigurationError if AI_PROVIDER is not set or invalid
   */
  static createDefault(env: Env): AIProvider {
    if (!env.AI_PROVIDER) {
      throw new ConfigurationError('AI_PROVIDER environment variable is required');
    }
    
    const providerType = env.AI_PROVIDER as AIProviderType;
    
    if (!['claude', 'openai', 'gemini'].includes(providerType)) {
      throw new ConfigurationError(`Invalid AI_PROVIDER value: ${providerType}. Must be one of: claude, openai, gemini`);
    }
    
    return this.create(providerType, env);
  }
}

