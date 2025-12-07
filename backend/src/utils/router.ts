import { Env } from '../types/index';
import { createCorsResponse } from './cors';

type RouteHandler = (request: Request, env: Env) => Promise<Response>;
type RouteKey = string;

/**
 * Router for REST endpoints with method-based routing support
 */
export class Router {
  private routes: Map<RouteKey, RouteHandler> = new Map();

  /**
   * Creates a route key from method and path
   */
  private createRouteKey(method: string, path: string): RouteKey {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * Registers a route handler for a specific method and path
   * @param method - HTTP method (GET, POST, etc.) or '*' for all methods
   * @param path - URL path
   * @param handler - Route handler function
   */
  route(method: string, path: string, handler: RouteHandler): void;
  /**
   * Registers a route handler (legacy support - defaults to all methods)
   * @param path - URL path
   * @param handler - Route handler function
   */
  route(path: string, handler: RouteHandler): void;
  route(methodOrPath: string, pathOrHandler: string | RouteHandler, handler?: RouteHandler): void {
    let method: string;
    let path: string;
    let routeHandler: RouteHandler;

    if (handler) {
      method = methodOrPath;
      path = pathOrHandler as string;
      routeHandler = handler;
    } else {
      method = '*';
      path = methodOrPath;
      routeHandler = pathOrHandler as RouteHandler;
    }

    const routeKey = this.createRouteKey(method, path);
    this.routes.set(routeKey, routeHandler);
  }

  /**
   * Handles a request by matching the URL path and method
   */
  async handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const exactKey = this.createRouteKey(method, path);
    let handler = this.routes.get(exactKey);

    if (!handler) {
      const wildcardKey = this.createRouteKey('*', path);
      handler = this.routes.get(wildcardKey);
    }

    if (handler) {
      return handler(request, env);
    }

    return createCorsResponse(
      JSON.stringify({
        error: 'Not found',
        message: `The requested endpoint ${method} ${path} was not found`,
        path: path,
        method: method,
      }),
      { status: 404 },
      env
    );
  }
}

