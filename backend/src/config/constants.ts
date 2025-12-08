export const CLAUDE_CONFIG = {
  API_URL: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-3-opus-20240229',
  MAX_TOKENS: 4096,
  API_VERSION: '2023-06-01',
  STREAM_ENABLED: true,
} as const;

export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;