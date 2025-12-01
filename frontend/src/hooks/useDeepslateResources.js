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
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch assets.js: ${res.status}`);
          }
          return res.text();
        })
        .then((code) => {
          // Execute assets.js which defines `const assets = JSON.parse(...)`
          // Wrap it to return the value and assign to window.assets
          const wrappedCode = code + '\nwindow.assets = assets; return assets;';
          const fn = new Function(wrappedCode);
          const assets = fn();

          if (!assets) {
            throw new Error('assets.js did not define assets');
          }
          if (!assets.blockstates) {
            throw new Error('assets.js missing blockstates property');
          }

          const loaded = loadDeepslateResources(image, assets);
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
