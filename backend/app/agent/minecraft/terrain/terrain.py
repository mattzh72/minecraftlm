"""
Terrain generator for procedural Minecraft landscapes.

Generates single-biome terrain with configurable surface layers.
Supports mountains with stone surfaces and snow caps.
Integrates with the existing SDK scene graph as an Object3D subclass.

Example:
    terrain = create_terrain(128, 128, seed=42)
    terrain.generate()

    scene = Scene()
    scene.add(terrain)
    result = scene.to_structure()
"""

from __future__ import annotations

from dataclasses import dataclass, field
import math
import random
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.agent.minecraft.sdk import Block, BlockCatalog, Object3D, Vector3
from app.agent.minecraft.terrain.heightmap import HeightMap, HeightMapConfig
from app.agent.minecraft.terrain.noise import NoiseConfig


FILL_TO_BOTTOM_DEPTH = 999


def _normalize_biome(biome: str) -> str:
    normalized = biome.strip().lower().replace("-", "_")
    aliases = {
        "grass": "plains",
        "grassy": "plains",
        "grassland": "plains",
        "snowy": "snowy_plains",
        "snow_plains": "snowy_plains",
        "snowyplains": "snowy_plains",
    }
    return aliases.get(normalized, normalized)


# Land biome layer definitions (top to bottom).
# (block_id, depth, properties)
LAND_LAYERS_BY_BIOME: Dict[str, List[Tuple[str, int, Dict[str, str]]]] = {
    "plains": [
        ("minecraft:grass_block", 1, {"snowy": "false"}),
        ("minecraft:dirt", 3, {}),
        ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),
    ],
    # Forest reuses plains blocks; only decorations differ.
    "forest": [
        ("minecraft:grass_block", 1, {"snowy": "false"}),
        ("minecraft:dirt", 3, {}),
        ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),
    ],
    "desert": [
        ("minecraft:sand", 4, {}),
        ("minecraft:sandstone", 3, {}),
        ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),
    ],
    "snowy_plains": [
        ("minecraft:grass_block", 1, {"snowy": "true"}),
        ("minecraft:dirt", 3, {}),
        ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),
    ],
    "taiga": [
        ("minecraft:podzol", 1, {"snowy": "false"}),
        ("minecraft:dirt", 3, {}),
        ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),
    ],
    "badlands": [
        ("minecraft:red_sand", 2, {}),
        ("minecraft:terracotta", 6, {}),
        ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),
    ],
}


SUPPORTED_BIOMES = tuple(sorted(LAND_LAYERS_BY_BIOME.keys()))


def _iter_layers_with_offsets(
    layers: List[Tuple[str, int, Dict[str, str]]],
) -> List[Tuple[str, int, Dict[str, str], int]]:
    offset = 0
    with_offsets: List[Tuple[str, int, Dict[str, str], int]] = []
    for block_id, depth, properties in layers:
        with_offsets.append((block_id, depth, properties, offset))
        if depth < FILL_TO_BOTTOM_DEPTH:
            offset += depth
    return with_offsets


@dataclass
class MountainInfo:
    """Information about a mountain for block generation."""
    center_x: int
    center_z: int
    radius: int
    peak_height: int  # Absolute Y of peak
    snow_line: Optional[int]  # Y level where snow starts (None = no snow)


@dataclass
class ValleyInfo:
    """Information about a valley for tracking."""
    center_x: int
    center_z: int
    radius: int
    lowest_height: int  # Absolute Y of valley floor
    valley_type: str  # "valley", "gorge", "crater"


@dataclass
class LakeInfo:
    """Information about a lake for water generation."""
    center_x: int
    center_z: int
    radius: int
    water_level: int  # Absolute Y of water surface


@dataclass
class RiverInfo:
    """Information about a river for water generation."""
    points: List[Tuple[int, int, int]]  # Path (x, z, water_level) - water level varies along path
    width: int


@dataclass
class TerrainConfig:
    """Configuration for terrain generation.

    Attributes:
        width: Width in blocks (X axis).
        depth: Depth in blocks (Z axis).
        base_height: Base terrain height.
        height_range: Maximum height deviation from base.
        seed: Random seed for deterministic generation.
        biome: Land biome to generate (single-biome terrain).
        generate_decorations: Whether to add trees/flowers.
        water_level: Global water level for oceans (None = no water).
        noise_config: Configuration for terrain noise.
    """

    width: int = 256
    depth: int = 256
    base_height: int = 64
    height_range: int = 32
    seed: int = 42
    biome: str = "plains"
    generate_decorations: bool = True
    tree_density: float = 1.0  # 1.0 = default density, >1 more trees, <1 fewer
    water_level: Optional[int] = None  # None = no water, set to e.g. 65 for ocean
    noise_config: NoiseConfig = field(default_factory=NoiseConfig)


# Mountain layer definitions - stone surface with snow cap
MOUNTAIN_LAYERS_SNOW = [
    ("minecraft:snow_block", 1, {}),  # Snow cap surface
    ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),  # Stone all the way down
]

MOUNTAIN_LAYERS_STONE = [
    ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),  # Stone surface and below
]

# Underwater terrain layers (sand/gravel bottom)
UNDERWATER_LAYERS = [
    ("minecraft:sand", 3, {}),      # Sandy bottom
    ("minecraft:gravel", 2, {}),    # Gravel layer
    ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),   # Stone bedrock
]

# Beach transition layers
BEACH_LAYERS = [
    ("minecraft:sand", 3, {}),      # Sandy surface
    ("minecraft:sandstone", 2, {}), # Sandstone subsurface
    ("minecraft:stone", FILL_TO_BOTTOM_DEPTH, {}),   # Stone bedrock
]


class Terrain(Object3D):
    """Procedural terrain generator.

    Extends Object3D to integrate with the existing scene graph.
    Generates single-biome terrain with optimized block merging.
    Supports mountains with stone surfaces and snow caps.

    Example:
        config = TerrainConfig(width=256, depth=256)
        terrain = Terrain(config)
        terrain.generate()

        scene = Scene()
        scene.add(terrain)

        # Query terrain
        height = terrain.get_height_at(128, 128)
    """

    def __init__(
        self,
        config: TerrainConfig,
        catalog: Optional[BlockCatalog] = None,
    ) -> None:
        """Initialize terrain generator.

        Args:
            config: Terrain configuration.
            catalog: Block catalog for validation (created if not provided).
        """
        super().__init__()
        if not isinstance(config.biome, str):
            raise TypeError(f"TerrainConfig.biome must be a str, got {type(config.biome).__name__}")
        config.biome = _normalize_biome(config.biome)
        if config.biome not in LAND_LAYERS_BY_BIOME:
            raise ValueError(
                f"Unsupported biome {config.biome!r}. Supported biomes: {', '.join(SUPPORTED_BIOMES)}"
            )

        self.config = config
        self.catalog = catalog or BlockCatalog()

        # Initialize heightmap config from terrain config
        heightmap_config = HeightMapConfig(
            width=config.width,
            depth=config.depth,
            base_height=config.base_height,
            height_range=config.height_range,
            noise_config=config.noise_config,
        )
        self.heightmap = HeightMap(heightmap_config)
        self._generated = False

        # Track mountain zones for proper block generation
        self._mountains: List[MountainInfo] = []
        # 2D array tracking terrain type: 0=plains, 1=mountain_stone, 2=mountain_snow
        self._terrain_type: Optional[np.ndarray] = None

        # Track valley features
        self._valleys: List[ValleyInfo] = []

        # Track water features
        self._lakes: List[LakeInfo] = []
        self._rivers: List[RiverInfo] = []

        # Water and beach masks (computed during generation)
        self._water_mask: Optional[np.ndarray] = None  # Boolean: True = has water
        self._water_levels: Optional[np.ndarray] = None  # Int: water level per column
        self._beach_mask: Optional[np.ndarray] = None  # Boolean: True = beach zone

        # Flattened areas mask (set by flatten_for_structure)
        self._flattened_mask: Optional[np.ndarray] = None  # Boolean: True = flattened for structure

    def generate(self) -> "Terrain":
        """Generate complete terrain.

        Creates heightmap, generates terrain blocks, and optionally adds decorations.
        Blocks are optimized by merging contiguous regions.

        Returns:
            Self for chaining.
        """
        # Generate heightmap (if not already generated by flatten_for_structure)
        if not self.heightmap._generated:
            self.heightmap.generate()

        # Compute terrain type map (plains vs mountain)
        self._compute_terrain_types()

        # Compute water and beach masks (if any water features exist)
        self._compute_water_mask()
        self._compute_beach_mask()

        # Generate terrain blocks with optimization (water/beach aware)
        self._generate_terrain_blocks()

        # Generate water blocks
        self._generate_water_blocks()

        # Add biome-specific surface overlays (e.g., snow layers)
        if self.config.biome == "snowy_plains":
            self._add_snow_layers()
        if self.config.biome == "badlands":
            self._add_badlands_spires()

        # Add decorations if enabled (only on plains, not water/beach)
        if self.config.generate_decorations:
            self._add_decorations()

        self._generated = True
        return self

    def _compute_terrain_types(self) -> None:
        """Compute terrain type for each column based on registered mountains."""
        width = self.config.width
        depth = self.config.depth

        # Initialize all as plains (0)
        self._terrain_type = np.zeros((depth, width), dtype=np.int8)

        # Mark mountain areas
        for mountain in self._mountains:
            cx, cz = mountain.center_x, mountain.center_z
            radius = mountain.radius

            # Iterate over bounding box of mountain
            for z in range(max(0, cz - radius), min(depth, cz + radius + 1)):
                for x in range(max(0, cx - radius), min(width, cx + radius + 1)):
                    # Calculate distance from center
                    dx = x - cx
                    dz = z - cz
                    distance = np.sqrt(dx * dx + dz * dz)

                    if distance <= radius:
                        # This column is part of the mountain
                        surface_height = self.heightmap.get(x, z)

                        if mountain.snow_line is not None and surface_height >= mountain.snow_line:
                            self._terrain_type[z, x] = 2  # Snow-capped mountain
                        else:
                            self._terrain_type[z, x] = 1  # Stone mountain

    def _compute_water_mask(self) -> None:
        """Compute which columns should have water.

        Water appears in:
        1. Columns below global water_level (if configured)
        2. Lake areas up to lake water_level
        3. River paths up to river water_level
        """
        width = self.config.width
        depth = self.config.depth

        # Initialize masks
        self._water_mask = np.zeros((depth, width), dtype=bool)
        self._water_levels = np.zeros((depth, width), dtype=np.int32)

        has_water = (
            self.config.water_level is not None or
            len(self._lakes) > 0 or
            len(self._rivers) > 0
        )

        if not has_water:
            return

        # 1. Global water level (ocean)
        if self.config.water_level is not None:
            for z in range(depth):
                for x in range(width):
                    terrain_height = self.heightmap.get(x, z)
                    if terrain_height < self.config.water_level:
                        self._water_mask[z, x] = True
                        self._water_levels[z, x] = self.config.water_level

        # 2. Lakes (can override global water level in lake area)
        for lake in self._lakes:
            cx, cz = lake.center_x, lake.center_z
            radius = lake.radius

            for z in range(max(0, cz - radius), min(depth, cz + radius + 1)):
                for x in range(max(0, cx - radius), min(width, cx + radius + 1)):
                    dx = x - cx
                    dz = z - cz
                    distance = np.sqrt(dx * dx + dz * dz)

                    if distance <= radius:
                        terrain_height = self.heightmap.get(x, z)
                        if terrain_height < lake.water_level:
                            self._water_mask[z, x] = True
                            # Use max water level if multiple features overlap
                            self._water_levels[z, x] = max(
                                self._water_levels[z, x],
                                lake.water_level
                            )

        # 3. Rivers
        for river in self._rivers:
            for px, pz, water_level in river.points:
                # Create water in circular area around each path point
                for z in range(max(0, pz - river.width), min(depth, pz + river.width + 1)):
                    for x in range(max(0, px - river.width), min(width, px + river.width + 1)):
                        dx = x - px
                        dz = z - pz
                        distance = np.sqrt(dx * dx + dz * dz)

                        if distance <= river.width:
                            terrain_height = self.heightmap.get(x, z)
                            if terrain_height < water_level:
                                self._water_mask[z, x] = True
                                self._water_levels[z, x] = max(
                                    self._water_levels[z, x],
                                    water_level
                                )

    def _compute_beach_mask(self) -> None:
        """Compute beach transition zones at water edges.

        Beaches appear at columns that are:
        - Not under water
        - Adjacent to water (within 3 blocks)
        - Close to water level height (within 2 blocks above water)
        """
        width = self.config.width
        depth = self.config.depth

        self._beach_mask = np.zeros((depth, width), dtype=bool)

        if self._water_mask is None or not np.any(self._water_mask):
            return

        beach_range = 3  # How far beaches extend from water

        for z in range(depth):
            for x in range(width):
                # Skip if already under water
                if self._water_mask[z, x]:
                    continue

                # Skip mountains (no beaches on mountains)
                if self._terrain_type is not None and self._terrain_type[z, x] != 0:
                    continue

                # Check if near water
                has_nearby_water = False
                nearby_water_level = 0

                for dz in range(-beach_range, beach_range + 1):
                    for dx in range(-beach_range, beach_range + 1):
                        nx, nz = x + dx, z + dz
                        if 0 <= nx < width and 0 <= nz < depth:
                            if self._water_mask[nz, nx]:
                                has_nearby_water = True
                                nearby_water_level = max(
                                    nearby_water_level,
                                    self._water_levels[nz, nx]
                                )
                    if has_nearby_water:
                        break

                if has_nearby_water:
                    # Only make beach if terrain is close to water level
                    terrain_height = self.heightmap.get(x, z)
                    if terrain_height <= nearby_water_level + 2:
                        self._beach_mask[z, x] = True

    def _generate_terrain_blocks(self) -> None:
        """Generate optimized terrain blocks.

        Uses run-length encoding to merge contiguous columns with same height
        into larger blocks, significantly reducing block count.
        Handles different terrain types (plains, mountains, beaches, underwater).
        """
        heights = self.heightmap.heights
        min_height = self.heightmap.min_height()

        # Generate blocks for each terrain type separately
        # Land areas (type 0) - exclude beaches and underwater
        land_layers = LAND_LAYERS_BY_BIOME[self.config.biome]
        for block_id, layer_depth, properties, surface_offset in _iter_layers_with_offsets(land_layers):
            self._generate_layer_blocks(
                block_id, layer_depth, properties, surface_offset, heights, min_height,
                terrain_type_filter=0,
                exclude_beach=True,
                exclude_underwater=True,
            )

        # Beach areas (plains terrain near water)
        for block_id, layer_depth, properties, surface_offset in _iter_layers_with_offsets(BEACH_LAYERS):
            self._generate_layer_blocks(
                block_id, layer_depth, properties, surface_offset, heights, min_height,
                beach_only=True,
            )

        # Underwater areas
        for block_id, layer_depth, properties, surface_offset in _iter_layers_with_offsets(UNDERWATER_LAYERS):
            self._generate_layer_blocks(
                block_id, layer_depth, properties, surface_offset, heights, min_height,
                underwater_only=True,
            )

        # Mountain stone areas (type 1)
        for block_id, layer_depth, properties, surface_offset in _iter_layers_with_offsets(MOUNTAIN_LAYERS_STONE):
            self._generate_layer_blocks(
                block_id, layer_depth, properties, surface_offset, heights, min_height,
                terrain_type_filter=1
            )

        # Mountain snow areas (type 2)
        for block_id, layer_depth, properties, surface_offset in _iter_layers_with_offsets(MOUNTAIN_LAYERS_SNOW):
            self._generate_layer_blocks(
                block_id, layer_depth, properties, surface_offset, heights, min_height,
                terrain_type_filter=2
            )

    def _generate_layer_blocks(
        self,
        block_id: str,
        layer_depth: int,
        properties: Dict[str, str],
        surface_offset: int,
        heights: np.ndarray,
        min_height: int,
        terrain_type_filter: Optional[int] = None,
        exclude_beach: bool = False,
        exclude_underwater: bool = False,
        beach_only: bool = False,
        underwater_only: bool = False,
    ) -> None:
        """Generate blocks for a single terrain layer with run-length merging.

        Scans the terrain row by row, merging adjacent columns with the
        same layer bounds into single wider blocks.

        Args:
            terrain_type_filter: If set, only generate for columns matching this type.
            exclude_beach: Skip columns marked as beach.
            exclude_underwater: Skip columns under water.
            beach_only: Only generate for beach columns.
            underwater_only: Only generate for underwater columns.
        """
        width = self.config.width
        depth = self.config.depth

        # Track which columns have been processed
        processed = np.zeros((depth, width), dtype=bool)

        for z in range(depth):
            x = 0
            while x < width:
                if processed[z, x]:
                    x += 1
                    continue

                # Skip if terrain type doesn't match filter
                if terrain_type_filter is not None and self._terrain_type is not None:
                    if self._terrain_type[z, x] != terrain_type_filter:
                        x += 1
                        continue

                # Beach filtering
                if exclude_beach and self._beach_mask is not None and self._beach_mask[z, x]:
                    x += 1
                    continue

                if beach_only:
                    if self._beach_mask is None or not self._beach_mask[z, x]:
                        x += 1
                        continue

                # Underwater filtering
                if exclude_underwater and self._water_mask is not None and self._water_mask[z, x]:
                    x += 1
                    continue

                if underwater_only:
                    if self._water_mask is None or not self._water_mask[z, x]:
                        x += 1
                        continue

                # Calculate layer bounds for this column
                surface_height = heights[z, x]
                layer_top, layer_bottom = self._get_layer_bounds(
                    int(surface_height), surface_offset, layer_depth, min_height
                )

                if layer_top <= layer_bottom:
                    x += 1
                    continue

                # Find run of columns with same layer bounds AND same filters
                run_length = 1
                while x + run_length < width:
                    nx = x + run_length
                    # Check terrain type matches
                    if terrain_type_filter is not None and self._terrain_type is not None:
                        if self._terrain_type[z, nx] != terrain_type_filter:
                            break

                    # Check beach/underwater filters match
                    if beach_only:
                        if self._beach_mask is None or not self._beach_mask[z, nx]:
                            break
                    if underwater_only:
                        if self._water_mask is None or not self._water_mask[z, nx]:
                            break
                    if exclude_beach and self._beach_mask is not None and self._beach_mask[z, nx]:
                        break
                    if exclude_underwater and self._water_mask is not None and self._water_mask[z, nx]:
                        break

                    next_surface = heights[z, nx]
                    next_top, next_bottom = self._get_layer_bounds(
                        int(next_surface), surface_offset, layer_depth, min_height
                    )
                    if next_top == layer_top and next_bottom == layer_bottom:
                        run_length += 1
                    else:
                        break

                # Try to extend in Z direction for 2D merging
                run_depth = 1
                can_extend = True
                while can_extend and z + run_depth < depth:
                    # Check if entire row matches
                    for dx in range(run_length):
                        nx, nz = x + dx, z + run_depth
                        if processed[nz, nx]:
                            can_extend = False
                            break
                        # Check terrain type matches
                        if terrain_type_filter is not None and self._terrain_type is not None:
                            if self._terrain_type[nz, nx] != terrain_type_filter:
                                can_extend = False
                                break
                        # Check beach/underwater filters match
                        if beach_only:
                            if self._beach_mask is None or not self._beach_mask[nz, nx]:
                                can_extend = False
                                break
                        if underwater_only:
                            if self._water_mask is None or not self._water_mask[nz, nx]:
                                can_extend = False
                                break
                        if exclude_beach and self._beach_mask is not None and self._beach_mask[nz, nx]:
                            can_extend = False
                            break
                        if exclude_underwater and self._water_mask is not None and self._water_mask[nz, nx]:
                            can_extend = False
                            break
                        row_surface = heights[nz, nx]
                        row_top, row_bottom = self._get_layer_bounds(
                            int(row_surface), surface_offset, layer_depth, min_height
                        )
                        if row_top != layer_top or row_bottom != layer_bottom:
                            can_extend = False
                            break
                    if can_extend:
                        run_depth += 1

                # Create merged block
                layer_height = layer_top - layer_bottom
                block = Block(
                    block_id,
                    size=(run_length, layer_height, run_depth),
                    properties=properties if properties else None,
                    fill=True,
                    catalog=self.catalog,
                )
                block.position.set(x, layer_bottom, z)
                self.children.append(block)

                # Mark columns as processed
                for dz in range(run_depth):
                    for dx in range(run_length):
                        processed[z + dz, x + dx] = True

                x += run_length

    def _get_layer_bounds(
        self,
        surface_height: int,
        surface_offset: int,
        layer_depth: int,
        min_height: int,
    ) -> Tuple[int, int]:
        """Calculate top and bottom Y for a stack-defined layer.

        Returns:
            Tuple of (layer_top, layer_bottom) Y coordinates.
        """
        layer_top = surface_height - surface_offset
        if layer_top <= min_height:
            return (0, 0)

        if layer_depth >= FILL_TO_BOTTOM_DEPTH:
            layer_bottom = min_height
        else:
            layer_bottom = max(layer_top - layer_depth, min_height)

        if layer_top <= layer_bottom:
            return (0, 0)
        return (layer_top, layer_bottom)

    def _generate_water_blocks(self) -> None:
        """Generate water blocks for areas marked in water mask.

        Water blocks are placed from terrain surface to water level.
        Uses run-length encoding for efficiency.
        """
        if self._water_mask is None or not np.any(self._water_mask):
            return

        width = self.config.width
        depth = self.config.depth
        heights = self.heightmap.heights

        processed = np.zeros((depth, width), dtype=bool)

        for z in range(depth):
            x = 0
            while x < width:
                if processed[z, x] or not self._water_mask[z, x]:
                    x += 1
                    continue

                # Calculate water column bounds
                terrain_height = heights[z, x]
                water_level = self._water_levels[z, x]

                if water_level <= terrain_height:
                    x += 1
                    continue

                water_height = water_level - terrain_height

                # Find run of columns with same water column height
                run_length = 1
                while x + run_length < width:
                    nx = x + run_length
                    if not self._water_mask[z, nx]:
                        break
                    next_terrain = heights[z, nx]
                    next_water = self._water_levels[z, nx]
                    next_height = next_water - next_terrain

                    if next_height == water_height and next_water == water_level:
                        run_length += 1
                    else:
                        break

                # Try to extend in Z direction
                run_depth = 1
                can_extend = True
                while can_extend and z + run_depth < depth:
                    for dx in range(run_length):
                        nx, nz = x + dx, z + run_depth
                        if processed[nz, nx]:
                            can_extend = False
                            break
                        if not self._water_mask[nz, nx]:
                            can_extend = False
                            break
                        row_terrain = heights[nz, nx]
                        row_water = self._water_levels[nz, nx]
                        row_height = row_water - row_terrain

                        if row_height != water_height or row_water != water_level:
                            can_extend = False
                            break

                    if can_extend:
                        run_depth += 1

                # Create water block
                water_block = Block(
                    "minecraft:water",
                    size=(run_length, water_height, run_depth),
                    fill=True,
                    catalog=self.catalog,
                )
                water_block.position.set(x, terrain_height, z)
                self.children.append(water_block)

                # Mark as processed
                for dz in range(run_depth):
                    for dx in range(run_length):
                        processed[z + dz, x + dx] = True

                x += run_length

    def _add_snow_layers(self) -> None:
        """Overlay snow layers on land columns for snowy plains biome."""
        width = self.config.width
        depth = self.config.depth

        for z in range(depth):
            x = 0
            while x < width:
                # Skip non-land, water, beach, or flattened columns
                if (
                    (self._terrain_type is not None and self._terrain_type[z, x] != 0)
                    or (self._water_mask is not None and self._water_mask[z, x])
                    or (self._beach_mask is not None and self._beach_mask[z, x])
                    or (self._flattened_mask is not None and self._flattened_mask[z, x])
                ):
                    x += 1
                    continue

                surface_height = int(self.heightmap.get(x, z))
                run_length = 1

                # Extend run for equal-height neighboring columns
                while x + run_length < width:
                    nx = x + run_length
                    if (
                        (self._terrain_type is not None and self._terrain_type[z, nx] != 0)
                        or (self._water_mask is not None and self._water_mask[z, nx])
                        or (self._beach_mask is not None and self._beach_mask[z, nx])
                        or (self._flattened_mask is not None and self._flattened_mask[z, nx])
                    ):
                        break
                    next_height = int(self.heightmap.get(nx, z))
                    if next_height != surface_height:
                        break
                    run_length += 1

                snow_block = Block(
                    "minecraft:snow",
                    size=(run_length, 1, 1),
                    properties={"layers": "1"},
                    fill=True,
                    catalog=self.catalog,
                )
                snow_block.position.set(x, surface_height, z)
                self.children.append(snow_block)

                x += run_length

    def _add_badlands_spires(self) -> None:
        """Generate eroded badlands spires with terracotta banding."""
        from app.agent.minecraft.terrain.noise import PerlinNoise

        width = self.config.width
        depth = self.config.depth
        placement_noise = PerlinNoise(seed=self.config.seed + 7000)
        shape_noise = PerlinNoise(seed=self.config.seed + 7101)
        band_noise = PerlinNoise(seed=self.config.seed + 7002)
        speckle_noise = PerlinNoise(seed=self.config.seed + 7003)

        terracotta_palette = [
            "minecraft:terracotta",
            "minecraft:orange_terracotta",
            "minecraft:yellow_terracotta",
            "minecraft:red_terracotta",
            "minecraft:brown_terracotta",
            "minecraft:white_terracotta",
            "minecraft:light_gray_terracotta",
        ]
        sandstone_palette = [
            "minecraft:red_sandstone",
            "minecraft:cut_red_sandstone",
            "minecraft:smooth_red_sandstone",
        ]

        rng = random.Random(self.config.seed + 7100)
        grid = 12

        def is_available(cx: int, cz: int) -> bool:
            if self._terrain_type is not None and self._terrain_type[cz, cx] != 0:
                return False
            if self._water_mask is not None and self._water_mask[cz, cx]:
                return False
            if self._beach_mask is not None and self._beach_mask[cz, cx]:
                return False
            if self._flattened_mask is not None and self._flattened_mask[cz, cx]:
                return False
            return True

        for z in range(0, depth, grid):
            for x in range(0, width, grid):
                if not is_available(x, z):
                    continue

                n = placement_noise.noise2d(x / 40.0, z / 40.0)
                if n < 0.1:
                    continue

                # Jitter spire center within the grid cell to avoid regularity.
                cx = x + rng.randrange(0, grid)
                cz = z + rng.randrange(0, grid)
                if not (1 <= cx < width - 1 and 1 <= cz < depth - 1):
                    continue
                if not is_available(cx, cz):
                    continue

                strength = max(0.0, min(1.0, (n - 0.1) / 0.9))
                kind_roll = rng.random()
                if kind_roll < 0.25:
                    # Ridges: long, connected eroded formations.
                    feature_type = "ridge"
                    base_radius = rng.randint(18, 34) + int(strength * 8)
                    max_height = rng.randint(16, 34) + int(strength * 10)
                    exponent = 1.25
                    plateau_min = 0.22
                elif kind_roll < 0.55:
                    # Buttes / mesas: broad, flat-ish tops.
                    feature_type = "butte"
                    base_radius = rng.randint(20, 45) + int(strength * 10)
                    max_height = rng.randint(10, 24) + int(strength * 8)
                    exponent = 0.6
                    plateau_min = 0.35
                elif kind_roll < 0.85:
                    # Thick spires: tall, substantial columns.
                    feature_type = "spire"
                    base_radius = rng.randint(8, 16) + int(strength * 4)
                    max_height = rng.randint(22, 50) + int(strength * 12)
                    exponent = 2.1
                    plateau_min = 0.0
                else:
                    # Small spires (fill-in detail).
                    feature_type = "small_spire"
                    base_radius = rng.randint(6, 12) + int(strength * 3)
                    max_height = rng.randint(16, 30) + int(strength * 8)
                    exponent = 1.7
                    plateau_min = 0.0

                angle = rng.random() * math.tau
                cos_a = math.cos(angle)
                sin_a = math.sin(angle)
                if feature_type == "ridge":
                    stretch_x = 6.0 + rng.random() * 8.0
                    stretch_z = 2.0 + rng.random() * 2.5
                elif feature_type == "butte":
                    stretch_x = 1.6 + rng.random() * 2.0
                    stretch_z = 1.6 + rng.random() * 2.0
                else:
                    stretch_x = 1.0 + rng.random() * 0.9
                    stretch_z = 1.0 + rng.random() * 0.9

                bounds = int((base_radius + 3) * max(stretch_x, stretch_z)) + 2

                def local_ground_y(sample_radius: int) -> int:
                    candidates: List[int] = []
                    offsets = [
                        (0, 0),
                        (sample_radius, 0),
                        (-sample_radius, 0),
                        (0, sample_radius),
                        (0, -sample_radius),
                        (sample_radius, sample_radius),
                        (sample_radius, -sample_radius),
                        (-sample_radius, sample_radius),
                        (-sample_radius, -sample_radius),
                    ]
                    for ox, oz in offsets:
                        sx = max(0, min(width - 1, cx + ox))
                        sz = max(0, min(depth - 1, cz + oz))
                        candidates.append(int(self.heightmap.get(sx, sz)))
                    return min(candidates) if candidates else int(self.heightmap.get(cx, cz))

                ground_y = local_ground_y(min(18, max(10, base_radius // 2)))
                for dz in range(-bounds, bounds + 1):
                    wz = cz + dz
                    if wz < 0 or wz >= depth:
                        continue
                    for dx in range(-bounds, bounds + 1):
                        wx = cx + dx
                        if wx < 0 or wx >= width:
                            continue
                        if not is_available(wx, wz):
                            continue

                        # Elliptical, rotated distance for more natural spires.
                        rx = dx * cos_a - dz * sin_a
                        rz = dx * sin_a + dz * cos_a
                        dist = math.sqrt((rx / stretch_x) ** 2 + (rz / stretch_z) ** 2)

                        boundary_warp = shape_noise.noise2d(wx / 7.0, wz / 7.0) * 1.1
                        boundary = max(0.9, base_radius + boundary_warp)
                        if dist > boundary:
                            continue

                        r_norm = dist / boundary
                        profile = (1.0 - r_norm) ** exponent
                        if plateau_min > 0.0:
                            profile = max(profile, plateau_min * max(0.0, 1.0 - r_norm * 0.85))

                        jagged = shape_noise.noise2d((wx + 100) / 4.0, (wz - 100) / 4.0) * 0.25
                        jagged += shape_noise.noise2d(wx / 2.6, wz / 2.6) * 0.10
                        spike_boost = 0.0
                        if feature_type in ("spire", "small_spire") and dist < 0.9:
                            spike_boost = 0.22
                        if feature_type == "ridge" and r_norm < 0.25:
                            spike_boost = 0.12

                        col_height = int(round(max_height * max(0.0, profile + jagged + spike_boost)))
                        if col_height <= 0:
                            continue

                        base_y = min(int(self.heightmap.get(wx, wz)), ground_y)
                        # Embed into terrain so formations look connected.
                        embed = 4 + int(round(max(0.0, profile) * 10.0))
                        if feature_type in ("ridge", "butte"):
                            embed += 2

                        def block_for(local_y: int) -> str:
                            abs_y = base_y + local_y
                            band_offset = int(round(band_noise.noise2d(wx / 12.0, wz / 12.0) * 3.0))
                            use_sandstone = local_y <= 1 or r_norm > 0.78
                            if use_sandstone:
                                stripe = (abs_y // 2 + band_offset) % len(sandstone_palette)
                                block_id = sandstone_palette[stripe]
                            else:
                                stripe = (abs_y // 2 + band_offset) % len(terracotta_palette)
                                block_id = terracotta_palette[stripe]

                            speckle = speckle_noise.noise2d(wx / 6.0, (wz + abs_y * 0.35) / 6.0)
                            if speckle > 0.62:
                                return "minecraft:terracotta"
                            if speckle < -0.62:
                                return "minecraft:light_gray_terracotta"
                            return block_id

                        start_y = -embed
                        seg_start = start_y
                        current_id = block_for(start_y)
                        for local_y in range(start_y + 1, col_height):
                            next_id = block_for(local_y)
                            if next_id != current_id:
                                seg_height = local_y - seg_start
                                block = Block(
                                    current_id,
                                    size=(1, seg_height, 1),
                                    fill=True,
                                    catalog=self.catalog,
                                )
                                block.position.set(wx, base_y + seg_start, wz)
                                self.children.append(block)
                                seg_start = local_y
                                current_id = next_id

                        # Final segment
                        seg_height = col_height - seg_start
                        if seg_height > 0:
                            block = Block(
                                current_id,
                                size=(1, seg_height, 1),
                                fill=True,
                                catalog=self.catalog,
                            )
                            block.position.set(wx, base_y + seg_start, wz)
                            self.children.append(block)

    def _add_decorations(self) -> None:
        """Add trees and vegetation to terrain.

        Imports decoration generators and places them based on noise.
        Only adds decorations to land areas (not mountains, water, or beaches).
        """
        # Import here to avoid circular dependency
        from app.agent.minecraft.terrain.decorations import (
            generate_oak_tree,
            generate_big_oak,
            generate_stumpy_oak,
            generate_birch_tree,
            generate_tall_birch,
            generate_spruce_tree,
            generate_tall_spruce,
            generate_layered_spruce,
            generate_pine,
            generate_flowers,
            generate_tall_grass,
            generate_cactus,
            generate_dead_bush,
            generate_acacia_tree,
            generate_dead_tree,
        )

        # Use separate noise for decoration placement
        from app.agent.minecraft.terrain.noise import PerlinNoise

        biome = self.config.biome
        decor_noise = PerlinNoise(seed=self.config.seed + 1000)
        flower_noise = PerlinNoise(seed=self.config.seed + 2000)

        def is_available(column_x: int, column_z: int) -> bool:
            if self._terrain_type is not None and self._terrain_type[column_z, column_x] != 0:
                return False
            if self._water_mask is not None and self._water_mask[column_z, column_x]:
                return False
            if self._beach_mask is not None and self._beach_mask[column_z, column_x]:
                return False
            if self._flattened_mask is not None and self._flattened_mask[column_z, column_x]:
                return False
            return True

        def add_tree(tree_x: int, tree_z: int, noise_val: float) -> None:
            height = self.heightmap.get(tree_x, tree_z)
            seed = self.config.seed + tree_x * 1000 + tree_z
            tree_kwargs: Dict[str, Any] = {}
            if biome == "forest":
                # Mix oak and birch variants
                if noise_val > 0.55:
                    tree_fn = generate_tall_birch
                elif noise_val > 0.25:
                    tree_fn = generate_birch_tree
                elif noise_val > 0.1:
                    tree_fn = generate_big_oak
                else:
                    tree_fn = generate_stumpy_oak
            elif biome == "taiga":
                if noise_val > 0.6:
                    tree_fn = generate_tall_spruce
                elif noise_val > 0.3:
                    tree_fn = generate_spruce_tree
                else:
                    tree_fn = generate_pine
            elif biome == "snowy_plains":
                if noise_val > 0.6:
                    tree_fn = generate_layered_spruce
                elif noise_val > 0.3:
                    tree_fn = generate_tall_spruce
                else:
                    tree_fn = generate_spruce_tree
                tree_kwargs["snow_cap"] = True
            elif biome in ("desert", "badlands"):
                if noise_val > 0.65 and biome == "desert":
                    tree_fn = generate_acacia_tree
                else:
                    tree_fn = generate_dead_tree
            else:
                # Plains default mix
                if noise_val > 0.5:
                    tree_fn = generate_oak_tree
                elif noise_val > 0.25:
                    tree_fn = generate_big_oak
                else:
                    tree_fn = generate_stumpy_oak

            tree = tree_fn(
                tree_x,
                height,
                tree_z,
                catalog=self.catalog,
                seed=seed,
                **tree_kwargs,
            )
            self.children.append(tree)

        # Trees
        if biome in ("plains", "forest", "taiga", "snowy_plains", "desert", "badlands"):
            density = max(0.1, min(self.config.tree_density, 3.0))
            if biome == "forest":
                tree_spacing = 8
                tree_threshold = 0.15
            elif biome == "taiga":
                tree_spacing = 10
                tree_threshold = 0.25
            elif biome == "snowy_plains":
                tree_spacing = 18
                tree_threshold = 0.35
            elif biome in ("desert", "badlands"):
                tree_spacing = 14
                tree_threshold = 0.28
            else:
                tree_spacing = 12
                tree_threshold = 0.3

            # Apply density scaling: higher density => tighter spacing and lower threshold
            tree_spacing = max(4, int(round(tree_spacing / density)))
            tree_threshold = min(0.9, tree_threshold / density)

            for z in range(0, self.config.depth - 5, tree_spacing):
                for x in range(0, self.config.width - 5, tree_spacing):
                    if not is_available(x, z):
                        continue

                    noise_val = decor_noise.noise2d(x / 20.0, z / 20.0)
                    if noise_val <= tree_threshold:
                        continue

                    offset_x = int((noise_val + 1) * 3) % tree_spacing
                    offset_z = int((noise_val * 2 + 1) * 3) % tree_spacing
                    tree_x = x + offset_x
                    tree_z = z + offset_z

                    if tree_x >= self.config.width - 3 or tree_z >= self.config.depth - 3:
                        continue
                    if not is_available(tree_x, tree_z):
                        continue

                    add_tree(tree_x, tree_z, noise_val)

        # Plants / small props
        for z in range(self.config.depth):
            for x in range(self.config.width):
                if not is_available(x, z):
                    continue

                noise_val = flower_noise.noise2d(x / 5.0, z / 5.0)
                height = self.heightmap.get(x, z)

                if biome in ("plains", "forest"):
                    if noise_val > 0.6:  # flowers
                        flower = generate_flowers(x, height, z, catalog=self.catalog)
                        self.children.append(flower)
                    elif 0.3 < noise_val <= 0.4:  # grass
                        grass = generate_tall_grass(x, height, z, catalog=self.catalog)
                        self.children.append(grass)
                    continue

                if biome == "taiga":
                    if 0.28 < noise_val <= 0.35:
                        grass = generate_tall_grass(x, height, z, catalog=self.catalog)
                        self.children.append(grass)
                    continue

                if biome == "desert":
                    if noise_val > 0.62:
                        cactus = generate_cactus(
                            x,
                            height,
                            z,
                            catalog=self.catalog,
                            seed=self.config.seed + x * 1000 + z,
                        )
                        self.children.append(cactus)
                    elif 0.2 < noise_val <= 0.26:
                        bush = generate_dead_bush(x, height, z, catalog=self.catalog)
                        self.children.append(bush)
                    continue

                if biome == "badlands":
                    if noise_val > 0.7:
                        bush = generate_dead_bush(x, height, z, catalog=self.catalog)
                        self.children.append(bush)
                    elif 0.32 < noise_val <= 0.34:
                        cactus = generate_cactus(
                            x,
                            height,
                            z,
                            catalog=self.catalog,
                            seed=self.config.seed + x * 1000 + z,
                        )
                        self.children.append(cactus)
                    continue

    def get_height_at(self, x: int, z: int) -> int:
        """Get terrain surface height at world position.

        Accounts for terrain position offset.

        Args:
            x: World X coordinate.
            z: World Z coordinate.

        Returns:
            Surface height at position.
        """
        # Adjust for terrain position
        local_x = int(x - self.position.x)
        local_z = int(z - self.position.z)
        return self.heightmap.get(local_x, local_z)

    def flatten_for_structure(
        self,
        x: int,
        z: int,
        width: int,
        depth: int,
        target_height: Optional[int] = None,
        falloff: int = 4,
    ) -> "Terrain":
        """Flatten terrain area for structure placement.

        Can be called before or after generate(). If called before,
        the heightmap will be generated first, then flattened.

        Args:
            x, z: Corner position in local terrain coordinates.
            width, depth: Area dimensions.
            target_height: Height to flatten to (area average if None).
            falloff: Blending distance at edges.

        Returns:
            Self for chaining.
        """
        # Ensure heightmap is generated before flattening
        if not self.heightmap._generated:
            self.heightmap.generate()

        self.heightmap.flatten_area(x, z, width, depth, target_height, falloff)

        # Mark the flattened area (no decorations should spawn here)
        if self._flattened_mask is None:
            self._flattened_mask = np.zeros(
                (self.config.depth, self.config.width), dtype=bool
            )

        # Mark the core flattened area (excluding falloff which blends with terrain)
        x_start = max(0, x)
        x_end = min(self.config.width, x + width)
        z_start = max(0, z)
        z_end = min(self.config.depth, z + depth)
        self._flattened_mask[z_start:z_end, x_start:x_end] = True

        return self

    def add_mountain(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        height: int,
        falloff: float = 1.8,
        seed: Optional[int] = None,
        snow: bool = True,
        snow_start_percent: float = 0.7,
    ) -> "Terrain":
        """Add an organic mountain to the terrain.

        Creates a natural-looking mountain with irregular base shape, varying
        slopes, and stone surface with optional snow cap. Uses domain warping
        for organic shapes - no more cone-shaped mountains!

        Args:
            center_x, center_z: Center position of the mountain.
            radius: Base radius of the mountain. Use 25+ for grand mountains.
            height: Peak height to add above current terrain. Use 30-60+ for impressive peaks.
            falloff: Controls slope steepness. 1.8 default for natural slopes.
            seed: Random seed for shape variation.
            snow: Whether to add snow cap at high elevations.
            snow_start_percent: How far up the mountain snow starts (0.7 = top 30%).

        Returns:
            Self for chaining.

        Example:
            terrain.add_mountain(64, 64, radius=35, height=50, snow=True)
            terrain.generate()
        """
        if not self.heightmap._generated:
            self.heightmap.generate()

        # Get base height at center before adding mountain
        base_height = self.heightmap.get(center_x, center_z)

        self.heightmap.add_mountain(
            center_x, center_z, radius, height, falloff, seed
        )

        # Calculate peak height and snow line
        peak_height = base_height + height
        snow_line = None
        if snow:
            snow_line = int(base_height + height * snow_start_percent)

        # Register mountain for proper block generation
        # Use extended radius to account for domain warping
        extended_radius = int(radius * 1.4)
        self._mountains.append(MountainInfo(
            center_x=center_x,
            center_z=center_z,
            radius=extended_radius,
            peak_height=peak_height,
            snow_line=snow_line,
        ))

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
        snow: bool = True,
        snow_start_percent: float = 0.7,
    ) -> "Terrain":
        """Add an organic mountain ridge between two points.

        Creates a natural-looking ridge with curved centerline, varying width,
        height variation with sub-peaks, and stone surface with optional snow cap.

        Args:
            start_x, start_z: Start point of the ridge.
            end_x, end_z: End point of the ridge.
            width: Base width of the ridge (half-width on each side). Use 15+ for grand ridges.
            height: Peak height to add above current terrain. Use 25-50+ for impressive ridges.
            falloff: Controls slope steepness. 1.8 default for natural slopes.
            seed: Random seed for shape variation.
            snow: Whether to add snow cap at high elevations.
            snow_start_percent: How far up the ridge snow starts (0.7 = top 30%).

        Returns:
            Self for chaining.

        Example:
            terrain.add_ridge(10, 64, 118, 64, width=20, height=40, snow=True)
            terrain.generate()
        """
        if not self.heightmap._generated:
            self.heightmap.generate()

        # Get base height at midpoint before adding ridge
        mid_x = (start_x + end_x) // 2
        mid_z = (start_z + end_z) // 2
        base_height = self.heightmap.get(mid_x, mid_z)

        self.heightmap.add_ridge(
            start_x, start_z, end_x, end_z, width, height, falloff, seed
        )

        # Calculate peak height and snow line
        peak_height = base_height + height
        snow_line = None
        if snow:
            snow_line = int(base_height + height * snow_start_percent)

        # Register as a series of overlapping "mountains" along the ridge for block generation
        # Use extended width to account for curves and width variation
        ridge_dx = end_x - start_x
        ridge_dz = end_z - start_z
        ridge_length = int(np.sqrt(ridge_dx * ridge_dx + ridge_dz * ridge_dz))
        extended_width = int(width * 1.5)

        # Add mountain info points along the ridge
        num_points = max(3, ridge_length // width)
        for i in range(num_points + 1):
            t = i / num_points
            px = int(start_x + t * ridge_dx)
            pz = int(start_z + t * ridge_dz)

            self._mountains.append(MountainInfo(
                center_x=px,
                center_z=pz,
                radius=extended_width,
                peak_height=peak_height,
                snow_line=snow_line,
            ))

        return self

    def add_plateau(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        height: int,
        flat_radius: Optional[int] = None,
        snow: bool = False,
    ) -> "Terrain":
        """Add a flat-topped plateau/mesa.

        Creates a raised flat area with sloped edges and stone surface.

        Args:
            center_x, center_z: Center position.
            radius: Total radius including slopes.
            height: Height to raise the plateau.
            flat_radius: Radius of the flat top (default: radius // 2).
            snow: Whether to add snow on top (default False for plateaus).

        Returns:
            Self for chaining.

        Example:
            terrain.add_plateau(64, 64, radius=20, height=25)
            terrain.generate()
        """
        if not self.heightmap._generated:
            self.heightmap.generate()

        # Get base height at center before adding plateau
        base_height = self.heightmap.get(center_x, center_z)

        self.heightmap.add_plateau(center_x, center_z, radius, height, flat_radius)

        # Calculate peak height and snow line
        peak_height = base_height + height
        snow_line = peak_height if snow else None

        # Register plateau for proper block generation
        self._mountains.append(MountainInfo(
            center_x=center_x,
            center_z=center_z,
            radius=radius,
            peak_height=peak_height,
            snow_line=snow_line,
        ))

        return self

    def add_valley(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        depth: int,
        falloff: float = 1.8,
        seed: Optional[int] = None,
        fill_water: bool = False,
        water_level: Optional[int] = None,
    ) -> "Terrain":
        """Add an organic valley depression to the terrain.

        Creates a natural-looking valley with irregular shape and smooth
        transitions. Optionally fills with water to create a lake.

        Args:
            center_x, center_z: Center position of the valley.
            radius: Base radius of the valley. Use 25+ for broad valleys.
            depth: Maximum depth to carve. Use 10-25 for realistic valleys.
            falloff: Controls slope steepness. 1.8 default for gentle slopes.
            seed: Random seed for shape variation.
            fill_water: Whether to fill valley with water.
            water_level: Water surface level (uses valley floor + depth/2 if None).

        Returns:
            Self for chaining.

        Example:
            terrain.add_valley(64, 64, radius=30, depth=15, fill_water=True)
            terrain.generate()
        """
        if not self.heightmap._generated:
            self.heightmap.generate()

        # Get base height before carving
        base_height = self.heightmap.get(center_x, center_z)

        # Carve the valley
        self.heightmap.add_valley(center_x, center_z, radius, depth, falloff, seed)

        # Calculate lowest point
        lowest_height = base_height - depth

        # Register valley for tracking
        self._valleys.append(ValleyInfo(
            center_x=center_x,
            center_z=center_z,
            radius=int(radius * 1.4),  # Extended for domain warping
            lowest_height=lowest_height,
            valley_type="valley",
        ))

        # Fill with water if requested
        if fill_water:
            if water_level is None:
                water_level = base_height - depth // 2
            self._lakes.append(LakeInfo(
                center_x=center_x,
                center_z=center_z,
                radius=int(radius * 1.4),
                water_level=water_level,
            ))

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
        fill_water: bool = False,
    ) -> "Terrain":
        """Add a gorge or canyon between two points.

        Creates a narrow, steep-sided canyon. Can optionally fill with water
        to create a river canyon.

        Args:
            start_x, start_z: Start point of the gorge.
            end_x, end_z: End point of the gorge.
            width: Base width. Use 8-15 for dramatic canyons.
            depth: Depth to carve. Use 15-35 for impressive gorges.
            falloff: Wall steepness. 2.5 default for steep walls.
            seed: Random seed for variation.
            fill_water: Whether to fill with water (creates river canyon).

        Returns:
            Self for chaining.

        Example:
            terrain.add_gorge(10, 64, 118, 64, width=10, depth=25)
            terrain.generate()
        """
        if not self.heightmap._generated:
            self.heightmap.generate()

        # Get base height at midpoint
        mid_x = (start_x + end_x) // 2
        mid_z = (start_z + end_z) // 2
        base_height = self.heightmap.get(mid_x, mid_z)

        # Carve the gorge
        self.heightmap.add_gorge(
            start_x, start_z, end_x, end_z, width, depth, falloff, seed
        )

        # Calculate gorge length and register valley info
        gorge_dx = end_x - start_x
        gorge_dz = end_z - start_z
        gorge_length = int(np.sqrt(gorge_dx * gorge_dx + gorge_dz * gorge_dz))
        extended_width = int(width * 1.5)

        self._valleys.append(ValleyInfo(
            center_x=mid_x,
            center_z=mid_z,
            radius=gorge_length // 2 + extended_width,
            lowest_height=base_height - depth,
            valley_type="gorge",
        ))

        # Fill with water if requested (as river)
        if fill_water:
            water_level = base_height - depth + 1
            # Create river points along the gorge
            num_points = max(5, gorge_length // 10)
            points = []
            for i in range(num_points + 1):
                t = i / num_points
                px = int(start_x + t * gorge_dx)
                pz = int(start_z + t * gorge_dz)
                points.append((px, pz, water_level))

            self._rivers.append(RiverInfo(
                points=points,
                width=width,
            ))

        return self

    def add_crater(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        depth: int,
        rim_height: int = 0,
        fill_water: bool = False,
        water_level: Optional[int] = None,
    ) -> "Terrain":
        """Add a crater or circular depression.

        Creates a bowl-shaped crater with optional raised rim. Can fill
        with water to create a circular lake.

        Args:
            center_x, center_z: Center position.
            radius: Crater radius. Use 15-30.
            depth: Crater depth. Use 8-20.
            rim_height: Raised rim height (0 = no rim). Use 3-8 for impact craters.
            fill_water: Whether to fill with water.
            water_level: Water surface Y level if filling with water (defaults to a mid-bowl level).

        Returns:
            Self for chaining.

        Example:
            terrain.add_crater(64, 64, radius=20, depth=15, rim_height=5, fill_water=True)
            terrain.generate()
        """
        if not self.heightmap._generated:
            self.heightmap.generate()

        # Get base height before carving
        base_height = self.heightmap.get(center_x, center_z)

        # Carve the crater
        self.heightmap.add_crater(center_x, center_z, radius, depth, rim_height)

        # Register valley for tracking
        self._valleys.append(ValleyInfo(
            center_x=center_x,
            center_z=center_z,
            radius=radius,
            lowest_height=base_height - depth,
            valley_type="crater",
        ))

        # Fill with water if requested
        if fill_water:
            water_surface = water_level if water_level is not None else (base_height - depth // 2)
            rim_width = max(3, radius // 4) if rim_height > 0 else 0
            bowl_radius = radius - rim_width

            # Clamp to the lowest rim height to prevent overflow
            if rim_width > 0:
                rim_inner = radius - rim_width
                min_rim_height: Optional[int] = None
                for z in range(max(0, center_z - radius - 2), min(self.config.depth, center_z + radius + 3)):
                    for x in range(max(0, center_x - radius - 2), min(self.config.width, center_x + radius + 3)):
                        dx = x - center_x
                        dz = z - center_z
                        distance = np.sqrt(dx * dx + dz * dz)
                        # Only sample the rim band (avoid interior bowl heights)
                        if rim_inner <= distance <= radius:
                            h = self.heightmap.get(x, z)
                            if min_rim_height is None or h < min_rim_height:
                                min_rim_height = h

                if min_rim_height is not None:
                    water_surface = min(water_surface, min_rim_height - 1)

            self._lakes.append(LakeInfo(
                center_x=center_x,
                center_z=center_z,
                radius=bowl_radius,
                water_level=water_surface,
            ))

        return self

    def add_lake(
        self,
        center_x: int,
        center_z: int,
        radius: int,
        depth: int,
        water_level: Optional[int] = None,
        seed: Optional[int] = None,
    ) -> "Terrain":
        """Add a lake (valley filled with water).

        Convenience method that creates a valley and fills it with water.
        Equivalent to add_valley(..., fill_water=True).

        Args:
            center_x, center_z: Center position of the lake.
            radius: Lake radius. Use 20-40 for ponds/lakes.
            depth: Depth to carve below terrain. Use 5-15.
            water_level: Water surface level (auto-calculated if None).
            seed: Random seed for lake shape variation.

        Returns:
            Self for chaining.

        Example:
            terrain.add_lake(64, 64, radius=25, depth=10)
            terrain.generate()
        """
        return self.add_valley(
            center_x, center_z, radius, depth,
            seed=seed,
            fill_water=True,
            water_level=water_level,
        )

    def add_river(
        self,
        start_x: int,
        start_z: int,
        end_x: int,
        end_z: int,
        width: int = 5,
        depth: int = 3,
        seed: Optional[int] = None,
    ) -> "Terrain":
        """Add a terrain-following river between two points.

        Carves a winding path and fills it with water. The river follows
        terrain, flowing downhill naturally.

        Args:
            start_x, start_z: Start point of the river.
            end_x, end_z: End point of the river.
            width: River width. Use 3-8 for streams, 10-20 for rivers.
            depth: Depth to carve. Use 2-5 for shallow rivers, 6-12 for deep.
            seed: Random seed for river path variation.

        Returns:
            Self for chaining.

        Example:
            terrain.add_river(10, 10, 118, 118, width=6, depth=4)
            terrain.generate()
        """
        if not self.heightmap._generated:
            self.heightmap.generate()

        from app.agent.minecraft.terrain.noise import PerlinNoise

        noise_seed = seed if seed is not None else (start_x * 1000 + start_z)
        curve_noise = PerlinNoise(seed=noise_seed)

        # Calculate river direction
        river_dx = end_x - start_x
        river_dz = end_z - start_z
        river_length = np.sqrt(river_dx * river_dx + river_dz * river_dz)

        if river_length == 0:
            return self

        dir_x = river_dx / river_length
        dir_z = river_dz / river_length
        perp_x = -dir_z
        perp_z = dir_x

        # Sample river path with terrain-aware water surface level
        num_points = max(10, int(river_length // 5))
        max_curve = width * 2

        points = []
        current_water_level = None

        for i in range(num_points + 1):
            t = i / num_points

            # Calculate curved path point
            curve_offset = curve_noise.noise2d(t * 4, 0) * max_curve
            px = int(start_x + t * river_dx + curve_offset * perp_x)
            pz = int(start_z + t * river_dz + curve_offset * perp_z)

            # Clamp to terrain bounds
            px = max(0, min(self.config.width - 1, px))
            pz = max(0, min(self.config.depth - 1, pz))

            # Get terrain height at this point
            terrain_height = self.heightmap.get(px, pz)

            # Calculate water surface level - terrain following
            if current_water_level is None:
                # Initialize at start point
                current_water_level = terrain_height - 1
            else:
                # River flows downhill - water level can only stay same or go down
                target_water_level = terrain_height - 1
                if target_water_level < current_water_level:
                    current_water_level = target_water_level

            points.append((px, pz, current_water_level))

        # Carve the river channel
        for px, pz, water_level in points:
            # Carve a circular area at each point
            for dz in range(-width, width + 1):
                for dx in range(-width, width + 1):
                    nx = px + dx
                    nz = pz + dz
                    if 0 <= nx < self.config.width and 0 <= nz < self.config.depth:
                        distance = np.sqrt(dx * dx + dz * dz)
                        if distance <= width:
                            # Carve with smooth falloff from center
                            t = distance / width
                            carve_factor = 1 - t ** 1.5

                            current_height = self.heightmap.get(nx, nz)
                            water_surface = water_level

                            # Carve a channel below the water surface, deepest in the center,
                            # tapering to shallow banks near the edge of the river radius.
                            # Ensures the river can cut through tall terrain.
                            min_carve_depth = 1
                            max_carve_depth = max(min_carve_depth, depth)
                            carve_depth = min_carve_depth + int((max_carve_depth - min_carve_depth) * carve_factor)
                            target_height = water_surface - carve_depth

                            if current_height > target_height:
                                self.heightmap.set(nx, nz, target_height)

        # Register river for water generation
        self._rivers.append(RiverInfo(
            points=points,
            width=width,
        ))

        return self


def create_terrain(
    width: int = 128,
    depth: int = 128,
    seed: int = 42,
    base_height: int = 64,
    height_range: int = 32,
    generate_decorations: bool = True,
    water_level: Optional[int] = None,
    catalog: Optional[BlockCatalog] = None,
    biome: str = "plains",
    tree_density: float = 1.0,
) -> Terrain:
    """Create a single-biome terrain with sensible defaults.

    Convenience factory for quick terrain generation.

    Args:
        width: Width in blocks (X axis).
        depth: Depth in blocks (Z axis).
        seed: Random seed.
        base_height: Base terrain height.
        height_range: Height variation range.
        generate_decorations: Add trees and flowers.
        water_level: Global water level for ocean (None = no water).
        catalog: Block catalog (created if not provided).
        biome: Land biome to generate (single-biome terrain).
        tree_density: Multiplier for tree frequency (0.1-3.0 recommended).

    Returns:
        Terrain instance (call .generate() to populate).

    Example:
        terrain = create_terrain(128, 128, seed=42)
        terrain.generate()

        # Or with ocean:
        terrain = create_terrain(128, 128, seed=42, water_level=65)
        terrain.generate()

        scene = Scene()
        scene.add(terrain)
    """
    config = TerrainConfig(
        width=width,
        depth=depth,
        seed=seed,
        base_height=base_height,
        height_range=height_range,
        biome=biome,
        generate_decorations=generate_decorations,
        tree_density=tree_density,
        water_level=water_level,
    )
    return Terrain(config, catalog=catalog)
