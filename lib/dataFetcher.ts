/**
 * Advanced Data Fetching Utilities for UNI-X
 * 
 * Features:
 * - Request caching with TTL
 * - Request deduplication
 * - Automatic retry on failure
 * - Request cancellation
 * - Type-safe responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface FetchOptions extends RequestInit {
  cacheTTL?: number; // Time to live in milliseconds
  skipCache?: boolean;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

class DataFetchManager {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private abortControllers = new Map<string, AbortController>();

  /**
   * Generate a cache key from URL and options
   */
  private getCacheKey(url: string, options?: FetchOptions): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && this.isCacheValid(entry)) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Store data in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Clear specific cache entry or all cache
   */
  clearCache(url?: string): void {
    if (url) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(url));
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Cancel pending request
   */
  cancelRequest(url: string): void {
    const controller = this.abortControllers.get(url);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(url);
      this.pendingRequests.delete(url);
    }
  }

  /**
   * Main fetch method with caching and deduplication
   */
  async fetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const {
      cacheTTL = 60000, // 1 minute default
      skipCache = false,
      retries = 2,
      retryDelay = 1000,
      timeout = 30000,
      ...fetchOptions
    } = options;

    const cacheKey = this.getCacheKey(url, fetchOptions);

    // Return cached data if valid
    if (!skipCache && fetchOptions.method !== 'POST' && fetchOptions.method !== 'PUT' && fetchOptions.method !== 'DELETE') {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Return pending request if exists (deduplication)
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Create new request with abort controller
    const controller = new AbortController();
    this.abortControllers.set(cacheKey, controller);

    // Add timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestPromise = this.performFetch<T>(
      url,
      { ...fetchOptions, signal: controller.signal },
      retries,
      retryDelay
    )
      .then((data) => {
        // Cache successful GET requests
        if (!skipCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
          this.setCache(cacheKey, data, cacheTTL);
        }
        return data;
      })
      .finally(() => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(cacheKey);
        this.abortControllers.delete(cacheKey);
      });

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * Perform the actual fetch with retry logic
   */
  private async performFetch<T>(
    url: string,
    options: RequestInit,
    retries: number,
    retryDelay: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            
            // Special handling for 401 Unauthorized - clear invalid token
            if (response.status === 401) {
              console.error('🔒 Unauthorized request to:', url);
              console.error('Auth header present:', !!options.headers?.['Authorization' as keyof typeof options.headers]);
              
              // Clear potentially invalid token from localStorage
              if (typeof window !== 'undefined') {
                const token = localStorage.getItem('token');
                if (token) {
                  console.warn('⚠️ Clearing potentially invalid token');
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  // Dispatch custom event to trigger logout
                  window.dispatchEvent(new CustomEvent('unauthorized'));
                }
              }
            }
            
            throw new Error(error.error || `HTTP ${response.status}`);
          }

          // Retry on server errors (5xx)
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error: any) {
        lastError = error;

        // Don't retry if aborted
        if (error.name === 'AbortError') {
          throw new Error('Request cancelled');
        }

        // Don't retry on last attempt
        if (attempt === retries) {
          break;
        }

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * Batch multiple requests
   */
  async fetchBatch<T>(requests: Array<{ url: string; options?: FetchOptions }>): Promise<T[]> {
    return Promise.all(requests.map(req => this.fetch<T>(req.url, req.options)));
  }

  /**
   * Prefetch data for future use
   */
  prefetch(url: string, options?: FetchOptions): void {
    this.fetch(url, options).catch(() => {
      // Silently fail prefetch requests
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        age: Date.now() - value.timestamp,
        ttl: value.expiresAt - Date.now(),
      })),
    };
  }
}

// Export singleton instance
export const dataFetcher = new DataFetchManager();

/**
 * Convenience wrapper for authenticated requests
 */
export async function fetchAPI<T>(
  endpoint: string,
  options: FetchOptions & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    // Validate token format before sending
    if (token.length < 20) {
      console.error('🔒 Invalid token format (too short)');
      throw new Error('Invalid authentication token');
    }
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn('⚠️ No token provided for request to:', endpoint);
  }

  return dataFetcher.fetch<T>(endpoint, {
    ...fetchOptions,
    headers,
  });
}

/**
 * Debounce function for search/filter operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for scroll/resize operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export default dataFetcher;
