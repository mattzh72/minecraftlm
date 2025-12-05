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

from app.agent.minecraft_sdk import (
    Scene,
    Block,
    Group,
    Vector3,
    BlockCatalog,
    stair_properties,
    axis_properties,
    slab_properties,
    instantiate,
    box,
    hollow_box,
    column,
    platform,
    stair_run,
    make_stair,
    facing_from_vector,
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
    # group = Group()  # Use Group for reusable subassemblies

    # TODO: Add Block instances to the scene, e.g.:
    #
    # ground = platform("minecraft:grass_block", width=16, depth=16, catalog=catalog)
    # scene.add(ground)
    #
    # walls = hollow_box(
    #     "minecraft:oak_planks",
    #     size=(12, 4, 12),
    #     catalog=catalog,
    # )
    # walls.translate(2, 1, 2)
    # scene.add(walls)
    #
    # stairs = stair_run(
    #     "minecraft:oak_stairs",
    #     length=4,
    #     direction="south",
    #     catalog=catalog,
    # )
    # scene.add(instantiate(stairs, offset=(8, 1, 1)))

    structure = scene.to_structure(padding=0)
    return structure


# The runtime reads this top-level variable as the final result.
structure = build_structure()


if __name__ == "__main__":
    import json
    from pathlib import Path

    output_path = Path(__file__).with_suffix(".json")
    output_path.write_text(json.dumps(structure, indent=2))
    print(f"Wrote structure JSON to {output_path}")
'''
