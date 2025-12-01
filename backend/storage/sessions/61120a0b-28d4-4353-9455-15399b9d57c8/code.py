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

    # 1. Foundation
    scene.add(Block("minecraft:cobblestone", size=(7, 1, 7), catalog=catalog))

    # 2. Back Wall (Z=6) - Solid
    wall_back = Block("minecraft:oak_planks", size=(7, 4, 1), catalog=catalog)
    wall_back.position.set(0, 1, 6)
    scene.add(wall_back)

    # 3. Front Wall (Z=0)
    # Left Column (X=0)
    scene.add(Block("minecraft:oak_planks", size=(1, 4, 1), catalog=catalog).tap(lambda b: b.position.set(0, 1, 0)))
    # Right Column (X=6)
    scene.add(Block("minecraft:oak_planks", size=(1, 4, 1), catalog=catalog).tap(lambda b: b.position.set(6, 1, 0)))
    
    # Mid-Left (X=1..2)
    scene.add(Block("minecraft:oak_planks", size=(2, 1, 1), catalog=catalog).tap(lambda b: b.position.set(1, 1, 0))) # y=1
    scene.add(Block("minecraft:glass_pane", size=(2, 1, 1), catalog=catalog).tap(lambda b: b.position.set(1, 2, 0))) # y=2 (window)
    scene.add(Block("minecraft:oak_planks", size=(2, 2, 1), catalog=catalog).tap(lambda b: b.position.set(1, 3, 0))) # y=3..4
    
    # Door Area (X=3)
    # Door blocks
    door_lower = Block("minecraft:oak_door", catalog=catalog, properties={"half": "lower", "facing": "north"})
    door_lower.position.set(3, 1, 0)
    scene.add(door_lower)
    door_upper = Block("minecraft:oak_door", catalog=catalog, properties={"half": "upper", "facing": "north"})
    door_upper.position.set(3, 2, 0)
    scene.add(door_upper)
    # Above door
    scene.add(Block("minecraft:oak_planks", size=(1, 2, 1), catalog=catalog).tap(lambda b: b.position.set(3, 3, 0)))

    # Mid-Right (X=4..5)
    scene.add(Block("minecraft:oak_planks", size=(2, 1, 1), catalog=catalog).tap(lambda b: b.position.set(4, 1, 0))) # y=1
    scene.add(Block("minecraft:glass_pane", size=(2, 1, 1), catalog=catalog).tap(lambda b: b.position.set(4, 2, 0))) # y=2 (window)
    scene.add(Block("minecraft:oak_planks", size=(2, 2, 1), catalog=catalog).tap(lambda b: b.position.set(4, 3, 0))) # y=3..4

    # 4. Left Wall (X=0, Z=1..5)
    scene.add(Block("minecraft:oak_planks", size=(1, 1, 5), catalog=catalog).tap(lambda b: b.position.set(0, 1, 1))) # y=1
    # y=2: Planks, Glass, Planks
    scene.add(Block("minecraft:oak_planks", size=(1, 1, 2), catalog=catalog).tap(lambda b: b.position.set(0, 2, 1)))
    scene.add(Block("minecraft:glass_pane", size=(1, 1, 1), catalog=catalog).tap(lambda b: b.position.set(0, 2, 3)))
    scene.add(Block("minecraft:oak_planks", size=(1, 1, 2), catalog=catalog).tap(lambda b: b.position.set(0, 2, 4)))
    # y=3..4
    scene.add(Block("minecraft:oak_planks", size=(1, 2, 5), catalog=catalog).tap(lambda b: b.position.set(0, 3, 1)))

    # 5. Right Wall (X=6, Z=1..5)
    scene.add(Block("minecraft:oak_planks", size=(1, 1, 5), catalog=catalog).tap(lambda b: b.position.set(6, 1, 1))) # y=1
    # y=2: Planks, Glass, Planks
    scene.add(Block("minecraft:oak_planks", size=(1, 1, 2), catalog=catalog).tap(lambda b: b.position.set(6, 2, 1)))
    scene.add(Block("minecraft:glass_pane", size=(1, 1, 1), catalog=catalog).tap(lambda b: b.position.set(6, 2, 3)))
    scene.add(Block("minecraft:oak_planks", size=(1, 1, 2), catalog=catalog).tap(lambda b: b.position.set(6, 2, 4)))
    # y=3..4
    scene.add(Block("minecraft:oak_planks", size=(1, 2, 5), catalog=catalog).tap(lambda b: b.position.set(6, 3, 1)))

    # 6. Roof (Pyramid)
    # Helper to add a ring
    def add_ring(y, x, z, w, d):
        # North (facing south)
        n = Block("minecraft:oak_stairs", size=(w, 1, 1), catalog=catalog, properties=stair_properties(facing="south"))
        n.position.set(x, y, z)
        scene.add(n)
        # South (facing north)
        s = Block("minecraft:oak_stairs", size=(w, 1, 1), catalog=catalog, properties=stair_properties(facing="north"))
        s.position.set(x, y, z + d - 1)
        scene.add(s)
        # West (facing east) - between N and S
        if d > 2:
            w_side = Block("minecraft:oak_stairs", size=(1, 1, d - 2), catalog=catalog, properties=stair_properties(facing="east"))
            w_side.position.set(x, y, z + 1)
            scene.add(w_side)
        # East (facing west) - between N and S
        if d > 2:
            e_side = Block("minecraft:oak_stairs", size=(1, 1, d - 2), catalog=catalog, properties=stair_properties(facing="west"))
            e_side.position.set(x + w - 1, y, z + 1)
            scene.add(e_side)

    # Overhang: start at -1, -1, size 9x9. y=5.
    add_ring(5, -1, -1, 9, 9)
    # Layer 2: 0, 0, size 7x7. y=6.
    add_ring(6, 0, 0, 7, 7)
    # Layer 3: 1, 1, size 5x5. y=7.
    add_ring(7, 1, 1, 5, 5)
    # Layer 4: 2, 2, size 3x3. y=8.
    add_ring(8, 2, 2, 3, 3)
    # Top: single slab or block. 3, 3. y=9.
    top = Block("minecraft:oak_slab", size=(1, 1, 1), catalog=catalog)
    top.position.set(3, 9, 3)
    scene.add(top)


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
