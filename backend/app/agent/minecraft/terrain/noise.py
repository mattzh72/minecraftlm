"""
NumPy-optimized Perlin noise for procedural terrain generation.

Provides deterministic, seedable noise with vectorized operations
for efficient bulk generation of large terrains.

Example:
    noise = PerlinNoise(seed=42)

    # Single value
    value = noise.noise2d(10.5, 20.3)

    # Vectorized for entire heightmap (fast!)
    x_coords = np.arange(256)
    z_coords = np.arange(256)
    X, Z = np.meshgrid(x_coords, z_coords)
    heightmap = noise.noise2d_vectorized(X, Z)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Union

import numpy as np
from numpy.typing import NDArray


@dataclass
class NoiseConfig:
    """Configuration for noise generation.

    Attributes:
        seed: Random seed for deterministic generation.
        octaves: Number of noise layers to combine (more = more detail).
        persistence: Amplitude multiplier per octave (0.5 = each octave half as strong).
        lacunarity: Frequency multiplier per octave (2.0 = each octave twice as detailed).
        scale: Base noise scale (larger = smoother terrain).
    """

    seed: int = 42
    octaves: int = 4
    persistence: float = 0.5
    lacunarity: float = 2.0
    scale: float = 50.0


class PerlinNoise:
    """2D Perlin noise generator with NumPy vectorization.

    Supports both scalar and array inputs for flexible usage.
    Vectorized operations provide 10-100x speedup for bulk generation.

    Example:
        noise = PerlinNoise(seed=42)

        # Scalar (single point)
        value = noise.noise2d(10.5, 20.3)

        # Vectorized (entire grid)
        X, Z = np.meshgrid(np.arange(256), np.arange(256))
        values = noise.noise2d_vectorized(X, Z)

        # Fractal noise for terrain
        config = NoiseConfig(octaves=4)
        heightmap = noise.fractal_noise2d_vectorized(X, Z, config)
    """

    def __init__(self, seed: int = 42) -> None:
        """Initialize noise generator with seed.

        Args:
            seed: Random seed for deterministic permutation table.
        """
        self.seed = seed
        self._permutation = self._generate_permutation(seed)

    def _generate_permutation(self, seed: int) -> NDArray[np.int32]:
        """Generate deterministic permutation table from seed."""
        rng = np.random.default_rng(seed)
        perm = rng.permutation(256).astype(np.int32)
        # Double for overflow handling
        return np.concatenate([perm, perm])

    @staticmethod
    def _fade(t: NDArray[np.float64]) -> NDArray[np.float64]:
        """Fade function: 6t^5 - 15t^4 + 10t^3 (vectorized)."""
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

    @staticmethod
    def _lerp(
        a: NDArray[np.float64],
        b: NDArray[np.float64],
        t: NDArray[np.float64],
    ) -> NDArray[np.float64]:
        """Linear interpolation (vectorized)."""
        return a + t * (b - a)

    def _grad(
        self,
        hash_val: NDArray[np.int32],
        x: NDArray[np.float64],
        y: NDArray[np.float64],
    ) -> NDArray[np.float64]:
        """Compute gradient dot product (vectorized)."""
        h = hash_val & 7
        # Select gradient components based on hash
        u = np.where(h < 4, x, y)
        v = np.where(h < 4, y, x)
        # Apply sign based on hash bits
        return np.where((h & 1) == 0, u, -u) + np.where((h & 2) == 0, v, -v)

    def noise2d(self, x: float, z: float) -> float:
        """Get single 2D Perlin noise value at (x, z).

        Args:
            x: X coordinate.
            z: Z coordinate.

        Returns:
            Noise value in range [-1, 1].
        """
        # Use vectorized version with scalar input
        result = self.noise2d_vectorized(
            np.array([x], dtype=np.float64),
            np.array([z], dtype=np.float64),
        )
        return float(result[0])

    def noise2d_vectorized(
        self,
        x: NDArray[np.float64],
        z: NDArray[np.float64],
    ) -> NDArray[np.float64]:
        """Get 2D Perlin noise values for arrays of coordinates.

        Args:
            x: Array of X coordinates.
            z: Array of Z coordinates (same shape as x).

        Returns:
            Array of noise values in range [-1, 1].
        """
        x = np.asarray(x, dtype=np.float64)
        z = np.asarray(z, dtype=np.float64)

        # Grid cell coordinates (integer part)
        xi = np.floor(x).astype(np.int32) & 255
        zi = np.floor(z).astype(np.int32) & 255

        # Relative position within cell (fractional part)
        xf = x - np.floor(x)
        zf = z - np.floor(z)

        # Compute fade curves
        u = self._fade(xf)
        v = self._fade(zf)

        # Hash coordinates of cell corners
        p = self._permutation
        aa = p[p[xi] + zi]
        ab = p[p[xi] + zi + 1]
        ba = p[p[xi + 1] + zi]
        bb = p[p[xi + 1] + zi + 1]

        # Blend contributions from each corner
        x1 = self._lerp(
            self._grad(aa, xf, zf),
            self._grad(ba, xf - 1.0, zf),
            u,
        )
        x2 = self._lerp(
            self._grad(ab, xf, zf - 1.0),
            self._grad(bb, xf - 1.0, zf - 1.0),
            u,
        )

        return self._lerp(x1, x2, v)

    def fractal_noise2d(
        self,
        x: float,
        z: float,
        config: NoiseConfig,
    ) -> float:
        """Generate single fractal noise value.

        Args:
            x: X coordinate.
            z: Z coordinate.
            config: Noise configuration.

        Returns:
            Noise value in range [-1, 1].
        """
        result = self.fractal_noise2d_vectorized(
            np.array([x], dtype=np.float64),
            np.array([z], dtype=np.float64),
            config,
        )
        return float(result[0])

    def fractal_noise2d_vectorized(
        self,
        x: NDArray[np.float64],
        z: NDArray[np.float64],
        config: NoiseConfig,
    ) -> NDArray[np.float64]:
        """Generate fractal noise for arrays of coordinates.

        Combines multiple octaves for natural-looking terrain.

        Args:
            x: Array of X coordinates.
            z: Array of Z coordinates.
            config: Noise configuration.

        Returns:
            Array of noise values in range [-1, 1].
        """
        x = np.asarray(x, dtype=np.float64)
        z = np.asarray(z, dtype=np.float64)

        total = np.zeros_like(x)
        amplitude = 1.0
        frequency = 1.0
        max_value = 0.0

        for _ in range(config.octaves):
            total += self.noise2d_vectorized(
                x * frequency / config.scale,
                z * frequency / config.scale,
            ) * amplitude

            max_value += amplitude
            amplitude *= config.persistence
            frequency *= config.lacunarity

        # Normalize to [-1, 1]
        return total / max_value if max_value > 0 else total
