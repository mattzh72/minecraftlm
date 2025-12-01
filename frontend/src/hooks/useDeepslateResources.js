import { useState, useEffect, useRef } from 'react';
import { loadDeepslateResources, getDeepslateResources } from '../utils/deepslate';

/**
 * Hook to load Deepslate rendering resources
 * Loads atlas.png and assets.js on mount
 */
export default function useDeepslateResources() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resources, setResources] = useState(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Prevent double loading in strict mode
    if (loadedRef.current) {
      const existing = getDeepslateResources();
      if (existing) {
        setResources(existing);
        setIsLoading(false);
      }
      return;
    }
    loadedRef.current = true;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = '/assets/atlas.png';

    image.onload = () => {
      fetch('/assets/assets.js')
        .then((res) => res.text())
        .then((code) => {
          // Execute assets.js to define window.assets
          eval(code);
          const loaded = loadDeepslateResources(image, window.assets);
          setResources(loaded);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error loading assets:', err);
          setError(err.message);
          setIsLoading(false);
        });
    };

    image.onerror = (err) => {
      console.error('Error loading atlas image:', err);
      setError('Failed to load texture atlas');
      setIsLoading(false);
    };
  }, []);

  return { resources, isLoading, error };
}
