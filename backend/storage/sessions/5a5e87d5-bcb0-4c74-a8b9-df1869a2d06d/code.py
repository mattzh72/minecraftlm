"""Minecraft structure builder script.

Edit the build_structure() function below to create the desired Minecraft
structure using the Minecraft SDK.
"""

from app.agent.minecraft_sdk import (
    Scene,
    Block,
    Vector3,
    BlockCatalog,
    stair_properties,
    axis_properties,
    slab_properties,
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

    # TODO: Add Block instances to the scene, e.g.:
    #
    # ground = Block("minecraft:grass_block", size=(16, 1, 16), catalog=catalog)
    # scene.add(ground)
    #
    # walls = Block(
    #     "minecraft:oak_planks",
    #     size=(12, 4, 12),
    #     fill=False,
    #     catalog=catalog,
    # )
    # walls.position.set(2, 1, 2)
    # scene.add(walls)
    #
    # stair = Block(
    #     "minecraft:oak_stairs",
    #     catalog=catalog,
    #     properties=stair_properties(facing="south"),
    # )
    # stair.position.set(8, 1, 1)
    # scene.add(stair)

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
