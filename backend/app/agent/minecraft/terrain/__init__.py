"""
Procedural terrain generation module for Minecraft SDK.

This module provides tools for generating large-scale procedural terrain
and placing structures on the landscape.

Example:
    from app.agent.minecraft.terrain import create_terrain, drop_to_surface

    # Generate 128x128 plains terrain
    terrain = create_terrain(128, 128, seed=42)
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
    generate_flowers,
    generate_tall_grass,
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
    "generate_flowers",
    "generate_tall_grass",
    # Placement
    "drop_to_surface",
]
