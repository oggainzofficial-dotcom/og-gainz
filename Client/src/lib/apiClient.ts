import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

const TOKEN_STORAGE_KEY = 'oz-gainz-token';
const LEGACY_TOKEN_STORAGE_KEY = 'token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const sanitizeToken = (value: string | null) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  // Tolerate legacy storage values like '"<jwt>"'.
  const unquoted = trimmed.replace(/^"+|"+$/g, '');
  return unquoted || null;
};

const getStoredToken = () => {
  const primaryRaw = localStorage.getItem(TOKEN_STORAGE_KEY);
  const legacyRaw = localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
  const token = sanitizeToken(primaryRaw) || sanitizeToken(legacyRaw);
  if (!token) return null;

  // Self-heal storage and keep both keys in sync for compatibility.
  if (token !== primaryRaw) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
  if (token !== legacyRaw) {
    localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, token);
  }
  return token;
};

export const hasStoredAuthToken = () => !!getStoredToken();

const joinUrl = (base: string, path: string) => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

type CacheEntry = { expiresAt: number; value: unknown };
const responseCache = new Map<string, CacheEntry>();

const getCacheKey = (url: string, config: AxiosRequestConfig) => {
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${String(config.method || 'get').toUpperCase()} ${url} ${params}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isIdempotentGet = (config: AxiosRequestConfig) => {
  return String(config.method || 'get').toLowerCase() === 'get';
};

const isRetryable = (err: unknown) => {
  const axiosErr = err as AxiosError | undefined;
  const status = axiosErr?.response?.status;
  return !status || status >= 500 || status === 429;
};

export const authTokenStorage = {
  key: TOKEN_STORAGE_KEY,
  get: () => getStoredToken(),
  set: (token: string) => {
    const normalized = sanitizeToken(token) || token;
    localStorage.setItem(TOKEN_STORAGE_KEY, normalized);
    localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, normalized);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    if (config.headers) {
      // Robust header setting for various Axios versions
      if (typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${token}`);
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }

  // Debug log for troubleshooting 401s in production
  if (import.meta.env.MODE === 'development' || window.location.hostname === 'oggainz.com' || window.location.hostname === 'www.oggainz.com') {
    const authHeader = (config.headers as any)?.Authorization || (config.headers as any)?.authorization;
    console.log(`[apiClient] ${String(config.method).toUpperCase()} ${config.url}`, {
      hasAuth: !!authHeader,
      authHeaderValue: authHeader ? `${authHeader.substring(0, 20)}...` : 'NONE'
    });
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const requestStatus = Number((error.request as { status?: unknown } | undefined)?.status);
      const status = error.response?.status ?? (Number.isFinite(requestStatus) ? requestStatus : undefined);

      // Keep auth state consistent if backend rejects the token.
      if (status === 401) {
        authTokenStorage.clear();
        localStorage.removeItem('oz-gainz-user');
        localStorage.removeItem('user');
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

const normalizeAxiosError = (err: unknown) => {
  if (!axios.isAxiosError(err)) return err;

  const requestStatus = Number((err.request as { status?: unknown } | undefined)?.status);
  const status = err.response?.status ?? (Number.isFinite(requestStatus) ? requestStatus : undefined);
  const data = err.response?.data as unknown;

  const messageFromBody =
    data && typeof data === 'object' && 'message' in data
      ? String((data as { message?: unknown }).message)
      : undefined;

  const fallbackMessage = status === 401
    ? 'Authentication required. Please log in again.'
    : (err.message || 'Request failed');

  const message = messageFromBody || fallbackMessage;

  const normalized = new Error(message) as Error & { status?: number };
  if (typeof status === 'number' && status > 0) normalized.status = status;
  return normalized;
};

type ApiOptions = {
  cacheTtlMs?: number;
  retries?: number;
};

const requestJson = async <T>(path: string, init?: RequestInit, options?: ApiOptions): Promise<T> => {
  const method = (init?.method || 'GET').toUpperCase();
  const url = API_BASE_URL ? joinUrl(API_BASE_URL, path) : path;

  const headers = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  let data: unknown = undefined;
  if (init?.body != null) {
    if (typeof init.body === 'string') {
      try {
        data = JSON.parse(init.body);
      } catch {
        data = init.body;
      }
    } else {
      data = init.body;
    }
  }

  const config: AxiosRequestConfig = {
    url,
    method,
    headers,
    data,
    signal: init?.signal || undefined,
  };

  const cacheTtlMs = options?.cacheTtlMs ?? 15_000;
  const retries = options?.retries ?? 2;
  const canCache = method === 'GET' && cacheTtlMs > 0;

  if (canCache) {
    const key = getCacheKey(url, config);
    const hit = responseCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
  }

  let attempt = 0;
  while (true) {
    try {
      const response: AxiosResponse<T> = await apiClient.request<T>(config);
      if (canCache) {
        const key = getCacheKey(url, config);
        responseCache.set(key, { expiresAt: Date.now() + cacheTtlMs, value: response.data });
      }
      return response.data;
    } catch (err) {
      attempt += 1;
      if (axios.isCancel(err) || (err as { name?: string } | undefined)?.name === 'CanceledError') {
        throw err;
      }
      if (!isIdempotentGet(config) || attempt > retries || !isRetryable(err)) {
        throw normalizeAxiosError(err);
      }
      await sleep(250 * attempt);
    }
  }
};

export const apiJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  return requestJson<T>(path, init, { cacheTtlMs: 15_000, retries: 2 });
};

export const apiJsonNoCache = async <T>(path: string, init?: RequestInit): Promise<T> => {
  return requestJson<T>(path, init, { cacheTtlMs: 0, retries: 2 });
};

export const apiUpload = async <T>(
	path: string,
	formData: FormData,
	options?: { signal?: AbortSignal; onUploadProgress?: (progressPct: number) => void; method?: 'POST' | 'PUT' | 'PATCH' }
) => {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }
  const url = joinUrl(API_BASE_URL, path);

  try {
    const response = await apiClient.request<T>({
      url,
			method: options?.method || 'POST',
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: options?.signal,
      onUploadProgress: (evt) => {
        if (!options?.onUploadProgress) return;
        const total = evt.total || 0;
        if (!total) return;
        options.onUploadProgress(Math.round((evt.loaded / total) * 100));
      },
    });

    return response.data;
  } catch (err) {
    throw normalizeAxiosError(err);
  }
};
