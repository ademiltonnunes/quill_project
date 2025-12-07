/**
 * Custom error classes for better error handling and type safety
 */

export class ValidationError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

