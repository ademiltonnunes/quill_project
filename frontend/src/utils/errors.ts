export interface ApiError {
  message: string;
  status?: number;
  provider?: string;
}

export async function parseApiError(response: Response): Promise<ApiError> {
  let errorMessage = `HTTP error! status: ${response.status}`;
  let provider: string | undefined;

  try {
    const errorText = await response.text();
    if (errorText) {
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = errorData.error;
          provider = errorData.provider;
        }
      } catch {
        errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
      }
    }
  } catch {}

  return {
    message: errorMessage,
    status: response.status,
    provider,
  };
}

export function getUserFriendlyError(error: unknown): string {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Cannot connect to the server. Please check if the backend is running.';
  }

  if (error instanceof Error) {
    if (error.message.includes('HTTP error')) {
      return `Server error: ${error.message}`;
    }
    return error.message;
  }

  return 'Unable to connect to the AI service.';
}

