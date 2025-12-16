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

    def add_mountain(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        height: int,
        falloff: float = 1.8,
        seed: Optional[int] = None,
    ) -> "HeightMap":
        """Add an organic, realistic mountain at the specified location.

        Creates a natural-looking mountain with irregular base shape, varying
        slopes, and subtle ridges radiating from the peak. Uses domain warping
        for organic shapes.

        Args:
            center_x, center_z: Center position of the mountain.
            radius: Base radius of the mountain. Use 25+ for grand mountains.
            height: Peak height to add above current terrain. Use 30+ for impressive peaks.
            falloff: Controls slope steepness. 1.8 default for natural slopes.
            seed: Random seed for shape (uses position if None).

        Returns:
            Self for chaining.

        Example:
            heightmap.add_mountain(64, 64, radius=35, height=50)
        """
        from app.agent.minecraft.terrain.noise import PerlinNoise

        noise_seed = seed if seed is not None else (center_x * 1000 + center_z)

        # Multiple noise layers for organic shape
        shape_noise = PerlinNoise(seed=noise_seed)        # Domain warping
        ridge_noise = PerlinNoise(seed=noise_seed + 100)  # Ridge patterns
        detail_noise = PerlinNoise(seed=noise_seed + 200) # Surface detail

        # Expand processing area to account for warping
        warp_extent = int(radius * 0.35)
        extended_radius = radius + warp_extent

        for z in range(max(0, center_z - extended_radius), min(self.config.depth, center_z + extended_radius + 1)):
            for x in range(max(0, center_x - extended_radius), min(self.config.width, center_x + extended_radius + 1)):

                # Domain warping - distort coordinates for organic base shape
                warp_scale = radius * 0.4
                warp_freq = 25.0
                wx = x + shape_noise.noise2d(x / warp_freq, z / warp_freq) * warp_scale
                wz = z + shape_noise.noise2d(x / warp_freq + 500, z / warp_freq + 500) * warp_scale

                # Calculate distance using warped coordinates
                dx = wx - center_x
                dz = wz - center_z
                distance = np.sqrt(dx * dx + dz * dz)

                if distance <= radius:
                    # Normalized distance: 0 at center, 1 at edge
                    t = distance / radius

                    # Base mountain shape with smooth falloff
                    mountain_factor = (1 - t ** falloff)

                    # Add ridge patterns radiating from peak
                    # Ridges are stronger near the peak and fade toward edges
                    ridge_val = ridge_noise.noise2d(x / 12.0, z / 12.0)
                    ridge_strength = (1 - t) * 0.25  # Stronger near peak
                    if ridge_val > 0.1:
                        mountain_factor *= (1 + ridge_val * ridge_strength)

                    # Add subtle surface variation
                    detail_val = detail_noise.noise2d(x / 8.0, z / 8.0)
                    mountain_factor *= (1 + detail_val * 0.08)

                    # Ensure non-negative
                    mountain_factor = max(0, mountain_factor)

                    # Add height to terrain
                    added_height = int(height * mountain_factor)
                    if added_height > 0:
                        self._heights[z, x] += added_height

        return self

    def add_ridge(
        self,
        start_x: int,
        start_z: int,
        end_x: int,
        end_z: int,
        width: int,
        height: int,
        falloff: float = 1.8,
        seed: Optional[int] = None,
    ) -> "HeightMap":
        """Add an organic mountain ridge between two points.

        Creates a natural-looking ridge with:
        - Slightly curved/wavy centerline
        - Varying width along length
        - Height variation with occasional sub-peaks
        - Organic edges using domain warping

        Args:
            start_x, start_z: Start point of the ridge.
            end_x, end_z: End point of the ridge.
            width: Base width of the ridge (half-width on each side). Use 15+ for grand ridges.
            height: Peak height to add above current terrain. Use 25+ for impressive ridges.
            falloff: Controls slope steepness. 1.8 default for natural slopes.
            seed: Random seed for shape.

        Returns:
            Self for chaining.

        Example:
            heightmap.add_ridge(10, 64, 118, 64, width=20, height=40)
        """
        from app.agent.minecraft.terrain.noise import PerlinNoise

        noise_seed = seed if seed is not None else (start_x * 1000 + start_z)

        # Multiple noise layers for organic shape
        curve_noise = PerlinNoise(seed=noise_seed)         # Ridge line curvature
        width_noise = PerlinNoise(seed=noise_seed + 100)   # Width variation
        height_noise = PerlinNoise(seed=noise_seed + 200)  # Height variation
        detail_noise = PerlinNoise(seed=noise_seed + 300)  # Surface detail

        # Calculate ridge direction
        ridge_dx = end_x - start_x
        ridge_dz = end_z - start_z
        ridge_length = np.sqrt(ridge_dx * ridge_dx + ridge_dz * ridge_dz)

        if ridge_length == 0:
            return self

        # Normalized direction
        dir_x = ridge_dx / ridge_length
        dir_z = ridge_dz / ridge_length

        # Perpendicular direction for curve offset
        perp_x = -dir_z
        perp_z = dir_x

        # Expand bounding box to account for curve and width variation
        max_curve = width * 0.4
        extended_width = int(width * 1.4 + max_curve)

        min_x = max(0, min(start_x, end_x) - extended_width)
        max_x = min(self.config.width, max(start_x, end_x) + extended_width + 1)
        min_z = max(0, min(start_z, end_z) - extended_width)
        max_z = min(self.config.depth, max(start_z, end_z) + extended_width + 1)

        for z in range(min_z, max_z):
            for x in range(min_x, max_x):
                # Vector from start to current point
                to_point_x = x - start_x
                to_point_z = z - start_z

                # Project onto ridge direction (how far along the ridge)
                along = to_point_x * dir_x + to_point_z * dir_z

                # Clamp to ridge length
                along_clamped = max(0, min(ridge_length, along))

                # Calculate curved ridge centerline
                # The ridge curves based on position along its length
                curve_t = along_clamped / ridge_length
                curve_offset = curve_noise.noise2d(curve_t * 3, 0) * max_curve

                # Apply curve to closest point on ridge
                closest_x = start_x + along_clamped * dir_x + curve_offset * perp_x
                closest_z = start_z + along_clamped * dir_z + curve_offset * perp_z

                # Distance from curved ridge line
                dist_x = x - closest_x
                dist_z = z - closest_z
                distance = np.sqrt(dist_x * dist_x + dist_z * dist_z)

                # Vary width along the ridge (creates natural bulges)
                width_variation = width_noise.noise2d(curve_t * 4, 0) * 0.3
                local_width = width * (1 + width_variation)

                if distance <= local_width:
                    # Calculate height factor with smooth falloff
                    t = distance / local_width
                    ridge_factor = (1 - t ** falloff)

                    # Vary height along the ridge (creates sub-peaks)
                    height_variation = height_noise.noise2d(curve_t * 5, 0)
                    # Boost peaks, don't reduce valleys too much
                    height_mult = 1.0 + height_variation * 0.35 if height_variation > 0 else 1.0 + height_variation * 0.15
                    ridge_factor *= height_mult

                    # Smooth taper at ends
                    taper_dist = width * 0.8
                    if along_clamped < taper_dist:
                        ridge_factor *= (along_clamped / taper_dist) ** 0.5
                    elif along_clamped > ridge_length - taper_dist:
                        ridge_factor *= ((ridge_length - along_clamped) / taper_dist) ** 0.5

                    # Add surface detail
                    detail_val = detail_noise.noise2d(x / 8.0, z / 8.0)
                    ridge_factor *= (1 + detail_val * 0.1)

                    # Add height to terrain
                    added_height = int(height * max(0, ridge_factor))
                    if added_height > 0:
                        self._heights[z, x] += added_height

        return self

    def add_plateau(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        height: int,
        flat_radius: Optional[int] = None,
        falloff: int = 5,
    ) -> "HeightMap":
        """Add a flat-topped plateau/mesa.

        Creates a raised flat area with sloped edges.

        Args:
            center_x, center_z: Center position.
            radius: Total radius including slopes.
            height: Height to raise the plateau.
            flat_radius: Radius of the flat top (default: radius // 2).
            falloff: Width of the sloped edge.

        Returns:
            Self for chaining.

        Example:
            heightmap.add_plateau(64, 64, radius=15, height=20)
        """
        if flat_radius is None:
            flat_radius = radius // 2

        for z in range(max(0, center_z - radius), min(self.config.depth, center_z + radius + 1)):
            for x in range(max(0, center_x - radius), min(self.config.width, center_x + radius + 1)):
                dx = x - center_x
                dz = z - center_z
                distance = np.sqrt(dx * dx + dz * dz)

                if distance <= flat_radius:
                    # Flat top
                    self._heights[z, x] += height
                elif distance <= radius:
                    # Sloped edge
                    slope_dist = distance - flat_radius
                    slope_width = radius - flat_radius
                    t = slope_dist / slope_width
                    # Smooth falloff
                    factor = 1 - (t ** 2)
                    self._heights[z, x] += int(height * factor)

        return self

    def add_valley(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        depth: int,
        falloff: float = 1.8,
        seed: Optional[int] = None,
    ) -> "HeightMap":
        """Add an organic valley depression at the specified location.

        Creates a natural-looking valley with irregular shape, varying
        depths, and smooth transitions to surrounding terrain. Uses domain
        warping for organic shapes (inverse of mountain generation).

        Args:
            center_x, center_z: Center position of the valley.
            radius: Base radius of the valley. Use 25+ for broad valleys.
            depth: Maximum depth to carve below current terrain. Use 10-25.
            falloff: Controls slope steepness. 1.8 default for gentle slopes.
            seed: Random seed for shape (uses position if None).

        Returns:
            Self for chaining.

        Example:
            heightmap.add_valley(64, 64, radius=30, depth=15)
        """
        from app.agent.minecraft.terrain.noise import PerlinNoise

        noise_seed = seed if seed is not None else (center_x * 1000 + center_z)

        # Multiple noise layers for organic shape
        shape_noise = PerlinNoise(seed=noise_seed)        # Domain warping
        detail_noise = PerlinNoise(seed=noise_seed + 100) # Floor detail
        edge_noise = PerlinNoise(seed=noise_seed + 200)   # Edge variation

        # Expand processing area to account for warping
        warp_extent = int(radius * 0.35)
        extended_radius = radius + warp_extent

        for z in range(max(0, center_z - extended_radius), min(self.config.depth, center_z + extended_radius + 1)):
            for x in range(max(0, center_x - extended_radius), min(self.config.width, center_x + extended_radius + 1)):

                # Domain warping - distort coordinates for organic shape
                warp_scale = radius * 0.4
                warp_freq = 25.0
                wx = x + shape_noise.noise2d(x / warp_freq, z / warp_freq) * warp_scale
                wz = z + shape_noise.noise2d(x / warp_freq + 500, z / warp_freq + 500) * warp_scale

                # Calculate distance using warped coordinates
                dx = wx - center_x
                dz = wz - center_z
                distance = np.sqrt(dx * dx + dz * dz)

                if distance <= radius:
                    # Normalized distance: 0 at center, 1 at edge
                    t = distance / radius

                    # Base valley shape with smooth falloff (inverse of mountain)
                    valley_factor = (1 - t ** falloff)

                    # Add subtle floor variation
                    detail_val = detail_noise.noise2d(x / 10.0, z / 10.0)
                    valley_factor *= (1 + detail_val * 0.15)

                    # Vary edge depth slightly
                    edge_val = edge_noise.noise2d(x / 15.0, z / 15.0)
                    if t > 0.6:  # Only affect edges
                        valley_factor *= (1 + edge_val * 0.1 * (t - 0.6) / 0.4)

                    # Ensure non-negative
                    valley_factor = max(0, valley_factor)

                    # Subtract height from terrain
                    carved_depth = int(depth * valley_factor)
                    if carved_depth > 0:
                        self._heights[z, x] -= carved_depth

        return self

    def add_gorge(
        self,
        start_x: int,
        start_z: int,
        end_x: int,
        end_z: int,
        width: int,
        depth: int,
        falloff: float = 2.5,
        seed: Optional[int] = None,
    ) -> "HeightMap":
        """Add a narrow gorge or canyon between two points.

        Creates a steep-sided canyon with:
        - Curved centerline for natural appearance
        - Narrower width than valleys
        - Steeper walls (higher falloff)
        - Varying depth along length

        Args:
            start_x, start_z: Start point of the gorge.
            end_x, end_z: End point of the gorge.
            width: Base width of the gorge. Use 8-15 for dramatic canyons.
            depth: Maximum depth to carve. Use 15-35 for impressive gorges.
            falloff: Controls wall steepness. 2.5 default for steep canyon walls.
            seed: Random seed for shape variation.

        Returns:
            Self for chaining.

        Example:
            heightmap.add_gorge(10, 64, 118, 64, width=10, depth=25)
        """
        from app.agent.minecraft.terrain.noise import PerlinNoise

        noise_seed = seed if seed is not None else (start_x * 1000 + start_z)

        # Multiple noise layers for organic shape
        curve_noise = PerlinNoise(seed=noise_seed)         # Gorge line curvature
        width_noise = PerlinNoise(seed=noise_seed + 100)   # Width variation
        depth_noise = PerlinNoise(seed=noise_seed + 200)   # Depth variation
        detail_noise = PerlinNoise(seed=noise_seed + 300)  # Floor detail

        # Calculate gorge direction
        gorge_dx = end_x - start_x
        gorge_dz = end_z - start_z
        gorge_length = np.sqrt(gorge_dx * gorge_dx + gorge_dz * gorge_dz)

        if gorge_length == 0:
            return self

        # Normalized direction
        dir_x = gorge_dx / gorge_length
        dir_z = gorge_dz / gorge_length

        # Perpendicular direction for curve offset
        perp_x = -dir_z
        perp_z = dir_x

        # Expand bounding box
        max_curve = width * 0.3  # Less curve than ridges for gorges
        extended_width = int(width * 1.3 + max_curve)

        min_x = max(0, min(start_x, end_x) - extended_width)
        max_x = min(self.config.width, max(start_x, end_x) + extended_width + 1)
        min_z = max(0, min(start_z, end_z) - extended_width)
        max_z = min(self.config.depth, max(start_z, end_z) + extended_width + 1)

        for z in range(min_z, max_z):
            for x in range(min_x, max_x):
                # Vector from start to current point
                to_point_x = x - start_x
                to_point_z = z - start_z

                # Project onto gorge direction
                along = to_point_x * dir_x + to_point_z * dir_z

                # Clamp to gorge length
                along_clamped = max(0, min(gorge_length, along))

                # Calculate curved gorge centerline
                curve_t = along_clamped / gorge_length
                curve_offset = curve_noise.noise2d(curve_t * 3, 0) * max_curve

                # Apply curve to closest point
                closest_x = start_x + along_clamped * dir_x + curve_offset * perp_x
                closest_z = start_z + along_clamped * dir_z + curve_offset * perp_z

                # Distance from curved gorge line
                dist_x = x - closest_x
                dist_z = z - closest_z
                distance = np.sqrt(dist_x * dist_x + dist_z * dist_z)

                # Vary width along gorge (slight variation)
                width_variation = width_noise.noise2d(curve_t * 4, 0) * 0.2
                local_width = width * (1 + width_variation)

                if distance <= local_width:
                    # Calculate depth factor with steep falloff
                    t = distance / local_width
                    gorge_factor = (1 - t ** falloff)

                    # Vary depth along gorge
                    depth_variation = depth_noise.noise2d(curve_t * 5, 0)
                    depth_mult = 1.0 + depth_variation * 0.25
                    gorge_factor *= depth_mult

                    # Taper at ends
                    taper_dist = width * 0.6
                    if along_clamped < taper_dist:
                        gorge_factor *= (along_clamped / taper_dist) ** 0.5
                    elif along_clamped > gorge_length - taper_dist:
                        gorge_factor *= ((gorge_length - along_clamped) / taper_dist) ** 0.5

                    # Add floor detail
                    detail_val = detail_noise.noise2d(x / 6.0, z / 6.0)
                    gorge_factor *= (1 + detail_val * 0.08)

                    # Subtract height from terrain
                    carved_depth = int(depth * max(0, gorge_factor))
                    if carved_depth > 0:
                        self._heights[z, x] -= carved_depth

        return self

    def add_crater(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        depth: int,
        rim_height: int = 0,
        falloff_inner: float = 1.5,
        falloff_outer: float = 2.0,
        seed: Optional[int] = None,
    ) -> "HeightMap":
        """Add a circular crater or depression with optional raised rim.

        Creates a bowl-shaped depression with:
        - Circular shape (less domain warping for cleaner craters)
        - Optional raised rim around edge
        - Smooth interior slopes
        - Can simulate impact craters or sinkholes

        Args:
            center_x, center_z: Center position of the crater.
            radius: Outer radius including rim. Use 15-30 for craters.
            depth: Depth of the crater bowl. Use 8-20.
            rim_height: Height of raised rim (0 = no rim). Use 3-8 for impact craters.
            falloff_inner: Controls interior slope steepness.
            falloff_outer: Controls exterior slope steepness (if rim exists).
            seed: Random seed for subtle shape variation.

        Returns:
            Self for chaining.

        Example:
            heightmap.add_crater(64, 64, radius=20, depth=15, rim_height=5)
        """
        from app.agent.minecraft.terrain.noise import PerlinNoise

        noise_seed = seed if seed is not None else (center_x * 1000 + center_z)

        # Subtle noise for rim irregularity
        rim_noise = PerlinNoise(seed=noise_seed)
        floor_noise = PerlinNoise(seed=noise_seed + 100)

        # Calculate rim zone
        rim_width = max(3, radius // 4) if rim_height > 0 else 0
        bowl_radius = radius - rim_width

        for z in range(max(0, center_z - radius - 2), min(self.config.depth, center_z + radius + 3)):
            for x in range(max(0, center_x - radius - 2), min(self.config.width, center_x + radius + 3)):
                dx = x - center_x
                dz = z - center_z
                distance = np.sqrt(dx * dx + dz * dz)

                # Add subtle irregularity to distance
                angle = np.arctan2(dz, dx)
                rim_variation = rim_noise.noise2d(angle * 2, 0) * (radius * 0.08)
                effective_distance = distance + rim_variation

                if effective_distance <= bowl_radius:
                    # Inside the bowl - carve down
                    t = effective_distance / bowl_radius
                    bowl_factor = (1 - t ** falloff_inner)

                    # Add floor detail
                    floor_val = floor_noise.noise2d(x / 8.0, z / 8.0)
                    bowl_factor *= (1 + floor_val * 0.1)

                    carved_depth = int(depth * max(0, bowl_factor))
                    if carved_depth > 0:
                        self._heights[z, x] -= carved_depth

                elif rim_height > 0 and effective_distance <= radius:
                    # In the rim zone - raise up
                    rim_t = (effective_distance - bowl_radius) / rim_width
                    # Peak in middle of rim, tapering both sides
                    rim_factor = 1 - abs(rim_t - 0.5) * 2
                    rim_factor = max(0, rim_factor) ** falloff_outer

                    raised_height = int(rim_height * rim_factor)
                    if raised_height > 0:
                        self._heights[z, x] += raised_height

        return self
