import { Env } from './types/index';
import { handleChatRequest, handleToolcallChatRequest } from './handlers/chat.handler';
import { createCorsResponse } from './utils/cors';
import { Router } from './utils/router';

const router = new Router();
router.route('POST', '/api/v1/chat', handleChatRequest);
router.route('POST', '/api/v1/toolcall-chat', handleToolcallChatRequest);

/**
 * Main Cloudflare Worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return createCorsResponse(null, undefined, env);
    }

    return router.handle(request, env);
  },
};