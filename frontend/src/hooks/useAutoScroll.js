import { useEffect, useRef } from 'react';

/**
 * Hook to auto-scroll to bottom when dependencies change
 * Returns a ref to attach to the scroll target element
 */
export default function useAutoScroll(deps = []) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, deps);

  return scrollRef;
}
