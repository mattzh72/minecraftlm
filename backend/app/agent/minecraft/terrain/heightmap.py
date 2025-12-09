"""
HeightMap class for terrain elevation data.

Provides efficient storage and manipulation of terrain height values
using NumPy arrays. Supports generation from noise and terrain modifications.

Example:
    config = HeightMapConfig(width=256, depth=256)
    heightmap = HeightMap(config)
    heightmap.generate()

    height = heightmap.get(100, 100)
    heightmap.flatten_area(50, 50, 20, 20, falloff=4)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from numpy.typing import NDArray

from app.agent.minecraft.terrain.noise import NoiseConfig, PerlinNoise


@dataclass
class HeightMapConfig:
    """Configuration for heightmap generation.

    Attributes:
        width: Width in blocks (X axis).
        depth: Depth in blocks (Z axis).
        base_height: Base terrain height (sea level).
        height_range: Maximum deviation from base_height.
        noise_config: Configuration for noise generation.
    """

    width: int = 256
    depth: int = 256
    base_height: int = 64
    height_range: int = 32
    noise_config: NoiseConfig = field(default_factory=NoiseConfig)


class HeightMap:
    """2D heightmap for terrain elevation.

    Stores integer heights for each (x, z) column. Uses NumPy for
    efficient storage and vectorized operations.

    Example:
        config = HeightMapConfig(width=128, depth=128, base_height=64)
        heightmap = HeightMap(config)
        heightmap.generate()

        # Query height
        h = heightmap.get(50, 50)

        # Flatten area for structure placement
        heightmap.flatten_area(60, 60, 20, 20, target_height=65, falloff=4)
    """

    def __init__(
        self,
        config: HeightMapConfig,
        noise: Optional[PerlinNoise] = None,
    ) -> None:
        """Initialize heightmap.

        Args:
            config: HeightMap configuration.
            noise: Optional noise generator (created from config if not provided).
        """
        self.config = config
        self.noise = noise or PerlinNoise(config.noise_config.seed)
        self._heights: NDArray[np.int32] = np.zeros(
            (config.depth, config.width), dtype=np.int32
        )
        self._generated = False

    @property
    def width(self) -> int:
        """Width of heightmap (X axis)."""
        return self.config.width

    @property
    def depth(self) -> int:
        """Depth of heightmap (Z axis)."""
        return self.config.depth

    @property
    def heights(self) -> NDArray[np.int32]:
        """Raw height array (depth x width). Read-only access."""
        return self._heights

    def generate(self) -> "HeightMap":
        """Generate heightmap using noise.

        Populates internal height grid using fractal noise.
        Returns self for chaining.
        """
        # Create coordinate grids
        x_coords = np.arange(self.config.width, dtype=np.float64)
        z_coords = np.arange(self.config.depth, dtype=np.float64)
        X, Z = np.meshgrid(x_coords, z_coords)

        # Generate fractal noise for entire grid
        noise_values = self.noise.fractal_noise2d_vectorized(
            X, Z, self.config.noise_config
        )

        # Map noise [-1, 1] to height range
        self._heights = (
            self.config.base_height + noise_values * self.config.height_range
        ).astype(np.int32)

        self._generated = True
        return self

    def get(self, x: int, z: int) -> int:
        """Get height at (x, z).

        Args:
            x: X coordinate.
            z: Z coordinate.

        Returns:
            Height at position, or 0 if out of bounds.
        """
        if 0 <= x < self.config.width and 0 <= z < self.config.depth:
            return int(self._heights[z, x])
        return 0

    def set(self, x: int, z: int, height: int) -> None:
        """Set height at (x, z).

        Args:
            x: X coordinate.
            z: Z coordinate.
            height: New height value.
        """
        if 0 <= x < self.config.width and 0 <= z < self.config.depth:
            self._heights[z, x] = height

    def get_area(
        self,
        x: int,
        z: int,
        width: int,
        depth: int,
    ) -> NDArray[np.int32]:
        """Get heights for a rectangular area.

        Args:
            x, z: Corner position.
            width, depth: Area dimensions.

        Returns:
            2D array of heights (depth x width).
        """
        x1 = max(0, x)
        z1 = max(0, z)
        x2 = min(self.config.width, x + width)
        z2 = min(self.config.depth, z + depth)
        return self._heights[z1:z2, x1:x2].copy()

    def get_average_height(
        self,
        x: int,
        z: int,
        width: int,
        depth: int,
    ) -> int:
        """Get average height in an area.

        Args:
            x, z: Corner position.
            width, depth: Area dimensions.

        Returns:
            Average height as integer.
        """
        area = self.get_area(x, z, width, depth)
        if area.size == 0:
            return self.config.base_height
        return int(np.mean(area))

    def flatten_area(
        self,
        x: int,
        z: int,
        width: int,
        depth: int,
        target_height: Optional[int] = None,
        falloff: int = 4,
    ) -> "HeightMap":
        """Flatten an area for structure placement.

        Creates a flat area with smooth transitions at edges.

        Args:
            x, z: Corner position of area to flatten.
            width, depth: Area dimensions.
            target_height: Height to flatten to (uses area average if None).
            falloff: Distance for gradual blending at edges.

        Returns:
            Self for chaining.
        """
        # Calculate target height if not specified
        if target_height is None:
            target_height = self.get_average_height(x, z, width, depth)

        # Expand bounds to include falloff zone
        x1 = max(0, x - falloff)
        z1 = max(0, z - falloff)
        x2 = min(self.config.width, x + width + falloff)
        z2 = min(self.config.depth, z + depth + falloff)

        # Process each cell in expanded area
        for cz in range(z1, z2):
            for cx in range(x1, x2):
                # Calculate distance to inner flat area
                dx = max(0, x - cx, cx - (x + width - 1))
                dz = max(0, z - cz, cz - (z + depth - 1))
                distance = max(dx, dz)

                if distance == 0:
                    # Inside flat area
                    self._heights[cz, cx] = target_height
                elif distance < falloff:
                    # In falloff zone - blend between original and target
                    blend = distance / falloff
                    original = self._heights[cz, cx]
                    self._heights[cz, cx] = int(
                        target_height * (1 - blend) + original * blend
                    )

        return self

    def smooth(self, radius: int = 1, iterations: int = 1) -> "HeightMap":
        """Apply smoothing to heightmap.

        Uses box blur for simple averaging.

        Args:
            radius: Smoothing kernel radius.
            iterations: Number of smoothing passes.

        Returns:
            Self for chaining.
        """
        for _ in range(iterations):
            # Pad array for edge handling
            padded = np.pad(self._heights, radius, mode="edge")

            # Create output array
            smoothed = np.zeros_like(self._heights, dtype=np.float64)
            count = 0

            # Sum neighbors
            for dz in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    smoothed += padded[
                        radius + dz : radius + dz + self.config.depth,
                        radius + dx : radius + dx + self.config.width,
                    ]
                    count += 1

            # Average and convert back to int
            self._heights = (smoothed / count).astype(np.int32)

        return self

    def carve_area(
        self,
        x: int,
        z: int,
        width: int,
        depth: int,
        amount: int,
    ) -> "HeightMap":
        """Lower terrain in an area.

        Args:
            x, z: Corner position.
            width, depth: Area dimensions.
            amount: Amount to lower by.

        Returns:
            Self for chaining.
        """
        x1 = max(0, x)
        z1 = max(0, z)
        x2 = min(self.config.width, x + width)
        z2 = min(self.config.depth, z + depth)

        self._heights[z1:z2, x1:x2] -= amount
        return self

    def raise_area(
        self,
        x: int,
        z: int,
        width: int,
        depth: int,
        amount: int,
    ) -> "HeightMap":
        """Raise terrain in an area.

        Args:
            x, z: Corner position.
            width, depth: Area dimensions.
            amount: Amount to raise by.

        Returns:
            Self for chaining.
        """
        x1 = max(0, x)
        z1 = max(0, z)
        x2 = min(self.config.width, x + width)
        z2 = min(self.config.depth, z + depth)

        self._heights[z1:z2, x1:x2] += amount
        return self

    def to_list(self) -> list[list[int]]:
        """Export heightmap as 2D Python list.

        Returns:
            2D list of heights [z][x].
        """
        return self._heights.tolist()

    def min_height(self) -> int:
        """Get minimum height in heightmap."""
        return int(np.min(self._heights))

    def max_height(self) -> int:
        """Get maximum height in heightmap."""
        return int(np.max(self._heights))
