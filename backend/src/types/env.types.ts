/**
 * Environment variable type definitions for Cloudflare Workers
 */

export interface Env {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  AI_PROVIDER?: 'claude' | 'openai' | 'gemini';
  CORS_ORIGIN?: string;
}