import { TokenManager } from '@/core/TokenManager';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

let _isRetrying = false;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...TokenManager.getAuthHeader(),
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  // Handle 401: clear token and attempt re-login (with recursion guard)
  if (response.status === 401 && !_isRetrying) {
    _isRetrying = true;
    try {
      TokenManager.clearToken();
      // Import dynamically to avoid circular dependency
      const { useAuth } = await import('@/hooks/useAuth');
      const { login } = useAuth.getState();
      await login();

      // Retry the request once with new token
      const retryHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...TokenManager.getAuthHeader(),
      };

      const retryResponse = await fetch(url, {
        ...config,
        headers: retryHeaders,
      });

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => null);
        throw new ApiError(
          retryResponse.status,
          errorData?.message ?? `Request failed: ${retryResponse.statusText}`,
          errorData,
        );
      }

      return retryResponse.json() as Promise<T>;
    } finally {
      _isRetrying = false;
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorData?.message ?? `Request failed: ${response.statusText}`,
      errorData,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body);
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PUT', path, body);
  },

  delete<T>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};

export { ApiError };
