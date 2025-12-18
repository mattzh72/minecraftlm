"""
Procedural terrain generation module for Minecraft SDK.

This module provides tools for generating large-scale procedural terrain
and placing structures on the landscape.

Example:
    from app.agent.minecraft.terrain import create_terrain, drop_to_surface

    # Generate 128x128 plains terrain (default biome)
    terrain = create_terrain(128, 128, seed=42, biome="plains")
    terrain.generate()

    # Drop a structure onto the terrain
    dropped = drop_to_surface(my_house, terrain, x=64, z=64, fill_bottom=True)

    scene = Scene()
    scene.add(terrain)
    scene.add(dropped)
"""

from app.agent.minecraft.terrain.noise import NoiseConfig, PerlinNoise
from app.agent.minecraft.terrain.heightmap import HeightMap, HeightMapConfig
from app.agent.minecraft.terrain.terrain import Terrain, TerrainConfig, create_terrain
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
    generate_dead_bush,
    generate_cactus,
    generate_acacia_tree,
    generate_dead_tree,
)
from app.agent.minecraft.terrain.melding import drop_to_surface

__all__ = [
    # Noise
    "NoiseConfig",
    "PerlinNoise",
    # HeightMap
    "HeightMap",
    "HeightMapConfig",
    # Terrain
    "Terrain",
    "TerrainConfig",
    "create_terrain",
    # Decorations
    "generate_oak_tree",
    "generate_big_oak",
    "generate_stumpy_oak",
    "generate_birch_tree",
    "generate_tall_birch",
    "generate_spruce_tree",
    "generate_tall_spruce",
    "generate_layered_spruce",
    "generate_pine",
    "generate_flowers",
    "generate_tall_grass",
    "generate_dead_bush",
    "generate_cactus",
    "generate_acacia_tree",
    "generate_dead_tree",
    # Placement
    "drop_to_surface",
]
