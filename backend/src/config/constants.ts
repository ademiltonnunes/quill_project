// Claude API configuration
export const CLAUDE_CONFIG = {
  API_URL: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-3-opus-20240229',
  MAX_TOKENS: 1024,
  API_VERSION: '2023-06-01',
  STREAM_ENABLED: true,
} as const;


// CORS headers - origin should be configured via CORS_ORIGIN env var
export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;