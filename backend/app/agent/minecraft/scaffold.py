"""
Default Python scaffold for new structure-design sessions.

When a new session is created, this template is written into the session's
``code.py`` file. The agent is expected to modify the contents of
``build_structure`` to construct the desired scene using the Minecraft SDK.
"""

DEFAULT_SCAFFOLD = '''"""Minecraft structure builder script.

Edit the build_structure() function below to create the desired Minecraft
structure using the Minecraft SDK.
"""

from app.agent.minecraft import (
    Scene,
    Block,
    Object3D,
    Vector3,
    BlockCatalog,
    SphereEraser,
    BoxEraser,
    CylinderEraser,
    stair_properties,
    axis_properties,
    slab_properties,
    make_stair,
    facing_from_vector,
)
from app.agent.minecraft.terrain import (
    create_terrain,
    drop_to_surface,
    Terrain,
    TerrainConfig,
    generate_oak_tree,
)


def build_structure() -> dict:
    """
    Build and return a structure dictionary with keys:

    - width: int
    - height: int
    - depth: int
    - blocks: list of block cuboids
    """
    catalog = BlockCatalog()
    scene = Scene()

    # TODO: Add Block instances to the scene, e.g.:
    #
    # # Fluent style (recommended):
    # scene.add(
    #     Block("minecraft:grass_block", catalog=catalog, properties={"snowy": "false"})
    #         .with_size(16, 1, 16)
    # )
    #
    # scene.add(
    #     Block("minecraft:stone_bricks", catalog=catalog)
    #         .with_size(10, 4, 1)
    #         .at(3, 1, 5)
    # )
    #
    # scene.add(
    #     Block("minecraft:oak_planks", catalog=catalog)
    #         .with_size(12, 5, 12)
    #         .at(2, 1, 2)
    #         .hollow()
    # )
    #
    # # Slabs require a "type" property.
    # scene.add(
    #     Block("minecraft:quartz_slab", catalog=catalog, properties={"type": "bottom"})
    #         .with_size(6, 1, 6)
    #         .at(4, 5, 4)
    # )
    #
    # scene.add(
    #     Block("minecraft:oak_stairs", catalog=catalog,
    #           properties={"facing": "south", "half": "bottom", "shape": "straight"})
    #         .at(5, 1, 0)
    # )
    #
    # # Connecting blocks (iron_bars, glass_pane, fences) use directional properties:
    # scene.add(
    #     Block(
    #         "minecraft:iron_bars",
    #         catalog=catalog,
    #         properties={"east": "true", "west": "true", "north": "false", "south": "false"},
    #     )
    #         .with_size(4, 5, 1)
    #         .at(10, 1, 5)
    # )
    #
    # # Use .tap() for debugging or side effects in a chain:
    # scene.add(
    #     Block("minecraft:stone", catalog=catalog)
    #         .with_size(5, 1, 5)
    #         .tap(lambda b: print(f"Placing {b.block_id}"))
    #         .at(0, 0, 0)
    # )

    structure = scene.to_structure(padding=0)
    return structure


# The runtime reads this top-level variable as the final result.
# IMPORTANT: The code below is necessary to make your code compilable. Please ensure that it exists in the final script.
structure = build_structure()


if __name__ == "__main__":
    import json
    from pathlib import Path

    output_path = Path(__file__).with_suffix(".json")
    output_path.write_text(json.dumps(structure, indent=2))
    print(f"Wrote structure JSON to {output_path}")
'''
