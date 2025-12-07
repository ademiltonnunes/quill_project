import { CORS_HEADERS } from '../config/constants';
import { Env } from '../types/index';

/**
 * Gets CORS headers with configurable origin
 * Falls back to '*' if CORS_ORIGIN is not set (for development)
 */
export function getCorsHeaders(env?: Env): HeadersInit {
  const origin = env?.CORS_ORIGIN || '*';
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': origin,
  };
}

export function createCorsResponse(
  body: BodyInit | null,
  init?: ResponseInit,
  env?: Env
): Response {
  return new Response(body, {
    ...init,
    headers: {
      ...init?.headers,
      ...getCorsHeaders(env),
    },
  });
}