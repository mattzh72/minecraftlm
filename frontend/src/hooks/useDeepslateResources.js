import { useState, useEffect, useRef } from 'react';
import { loadDeepslateResources, getDeepslateResources } from '../utils/deepslate';

const BLOCK_FLAG_PATHS = {
  opaque: '/assets/block-flags/opaque.txt',
  transparent: '/assets/block-flags/transparent.txt',
  nonSelfCulling: '/assets/block-flags/non_self_culling.txt',
  emissive: '/assets/block-flags/emissive.json',
};

const normalizeBlockId = (id) => (id.startsWith('minecraft:') ? id : `minecraft:${id}`);

const parseBlockList = (text) => {
  const ids = new Set();
  const matches = text.match(/minecraft:[a-z0-9_]+/g) ?? [];
  matches.forEach((match) => ids.add(match));

  text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => ids.add(normalizeBlockId(token)));

  return ids;
};

const fetchBlockList = async (path, label) => {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${label}: ${res.status}`);
  }
  const text = await res.text();
  return parseBlockList(text);
};

const fetchEmissiveBlocks = async () => {
  const res = await fetch(BLOCK_FLAG_PATHS.emissive);
  if (!res.ok) {
    console.warn('Failed to fetch emissive.json, using defaults');
    return {};
  }
  return await res.json();
};

const fetchAssets = async () => {
  const res = await fetch('/assets/assets.js');
  if (!res.ok) {
    throw new Error(`Failed to fetch assets.js: ${res.status}`);
  }
  const code = await res.text();
  const wrappedCode = `${code}\nreturn assets;`;
  const fn = new Function(wrappedCode);
  const assets = fn();

  if (!assets) {
    throw new Error('assets.js did not define assets');
  }
  if (!assets.blockstates) {
    throw new Error('assets.js missing blockstates property');
  }

  return assets;
};

const loadAtlasImage = () =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load texture atlas'));
    image.src = '/assets/atlas.png';
  });

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

    const loadResources = async () => {
      try {
        const image = await loadAtlasImage();
        const [assets, opaqueBlocks, transparentBlocks, nonSelfCullingBlocks, emissiveBlocks] =
          await Promise.all([
            fetchAssets(),
            fetchBlockList(BLOCK_FLAG_PATHS.opaque, 'opaque.txt'),
            fetchBlockList(BLOCK_FLAG_PATHS.transparent, 'transparent.txt'),
            fetchBlockList(
              BLOCK_FLAG_PATHS.nonSelfCulling,
              'non_self_culling.txt'
            ),
            fetchEmissiveBlocks(),
          ]);

        const loaded = loadDeepslateResources(image, assets, {
          opaque: opaqueBlocks,
          transparent: transparentBlocks,
          nonSelfCulling: nonSelfCullingBlocks,
          emissive: emissiveBlocks,
        });
        setResources(loaded);
      } catch (err) {
        console.error('Error loading assets:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadResources();
  }, []);

  return { resources, isLoading, error };
}
