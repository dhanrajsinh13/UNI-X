'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { throttle } from '../lib/dataFetcher';

interface UseInfiniteScrollOptions {
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  enabled?: boolean;
}

interface UseInfiniteScrollReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isNearBottom: boolean;
}

export function useInfiniteScroll(
  onLoadMore: () => void,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const { threshold = 500, enabled = true } = options;
  const [isNearBottom, setIsNearBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const handleScroll = useCallback(
    throttle(() => {
      if (!enabled || loadingRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const nearBottom = distanceFromBottom < threshold;

      setIsNearBottom(nearBottom);

      if (nearBottom) {
        loadingRef.current = true;
        onLoadMore();
        // Reset loading flag after a delay
        setTimeout(() => {
          loadingRef.current = false;
        }, 1000);
      }
    }, 200),
    [enabled, threshold, onLoadMore]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return { containerRef, isNearBottom };
}
