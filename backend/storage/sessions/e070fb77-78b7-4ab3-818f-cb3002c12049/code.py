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

    # Dimensions
    width = 9
    depth = 9

    # 1. Foundation (Cobblestone)
    foundation = Block("minecraft:cobblestone", size=(width, 1, depth), catalog=catalog)
    foundation.position.set(0, 0, 0)
    scene.add(foundation)

    # 2. Frame (Oak Logs)
    # Pillars at corners, height 9 (y=1 to y=9)
    for x in [0, width - 1]:
        for z in [0, depth - 1]:
            pillar = Block(
                "minecraft:oak_log",
                size=(1, 9, 1),
                catalog=catalog,
                properties=axis_properties("y"),
            )
            pillar.position.set(x, 1, z)
            scene.add(pillar)

    # 3. Ground Floor Walls (Stone Bricks)
    # Height 4 (y=1 to y=4)
    
    # West Wall
    w_wall_1 = Block("minecraft:stone_bricks", size=(1, 4, depth - 2), catalog=catalog)
    w_wall_1.position.set(0, 1, 1)
    scene.add(w_wall_1)

    # East Wall
    e_wall_1 = Block("minecraft:stone_bricks", size=(1, 4, depth - 2), catalog=catalog)
    e_wall_1.position.set(width - 1, 1, 1)
    scene.add(e_wall_1)

    # North Wall
    n_wall_1 = Block("minecraft:stone_bricks", size=(width - 2, 4, 1), catalog=catalog)
    n_wall_1.position.set(1, 1, 0)
    scene.add(n_wall_1)

    # South Wall (Front) - with Door hole
    s_wall_left = Block("minecraft:stone_bricks", size=(3, 4, 1), catalog=catalog)
    s_wall_left.position.set(1, 1, depth - 1)
    scene.add(s_wall_left)

    s_wall_right = Block("minecraft:stone_bricks", size=(3, 4, 1), catalog=catalog)
    s_wall_right.position.set(5, 1, depth - 1)
    scene.add(s_wall_right)

    s_wall_top = Block("minecraft:stone_bricks", size=(1, 2, 1), catalog=catalog)
    s_wall_top.position.set(4, 3, depth - 1)
    scene.add(s_wall_top)

    # Door
    door_low = Block(
        "minecraft:oak_door",
        catalog=catalog,
        properties={"facing": "south", "half": "lower"},
    )
    door_low.position.set(4, 1, depth - 1)
    scene.add(door_low)

    door_high = Block(
        "minecraft:oak_door",
        catalog=catalog,
        properties={"facing": "south", "half": "upper"},
    )
    door_high.position.set(4, 2, depth - 1)
    scene.add(door_high)

    # Ground floor interior
    floor1 = Block("minecraft:oak_planks", size=(width - 2, 1, depth - 2), catalog=catalog)
    floor1.position.set(1, 1, 1)
    scene.add(floor1)

    # 4. Second Floor
    # Floor at y=5
    floor2 = Block("minecraft:spruce_planks", size=(width, 1, depth), catalog=catalog)
    floor2.position.set(0, 5, 0)
    scene.add(floor2)

    # Walls (White Wool) - Height 4 (y=6 to y=9)
    # West
    w_wall_2 = Block("minecraft:white_wool", size=(1, 4, depth - 2), catalog=catalog)
    w_wall_2.position.set(0, 6, 1)
    scene.add(w_wall_2)

    # East
    e_wall_2 = Block("minecraft:white_wool", size=(1, 4, depth - 2), catalog=catalog)
    e_wall_2.position.set(width - 1, 6, 1)
    scene.add(e_wall_2)

    # North
    n_wall_2 = Block("minecraft:white_wool", size=(width - 2, 4, 1), catalog=catalog)
    n_wall_2.position.set(1, 6, 0)
    scene.add(n_wall_2)

    # South
    s_wall_2 = Block("minecraft:white_wool", size=(width - 2, 4, 1), catalog=catalog)
    s_wall_2.position.set(1, 6, depth - 1)
    scene.add(s_wall_2)
    
    # 5. Roof (Spruce Stairs)
    roof_z_start = -1
    roof_z_len = depth + 2
    
    for i in range(5):
        y = 10 + i
        x_left = -1 + i
        x_right = 9 - i
        
        # Left slope (West side, facing East)
        stair_l = Block(
            "minecraft:spruce_stairs", 
            size=(1, 1, roof_z_len), 
            catalog=catalog, 
            properties=stair_properties(facing="east")
        )
        stair_l.position.set(x_left, y, roof_z_start)
        scene.add(stair_l)
        
        # Right slope (East side, facing West)
        stair_r = Block(
            "minecraft:spruce_stairs", 
            size=(1, 1, roof_z_len), 
            catalog=catalog, 
            properties=stair_properties(facing="west")
        )
        stair_r.position.set(x_right, y, roof_z_start)
        scene.add(stair_r)

    # Ridge
    ridge = Block("minecraft:spruce_planks", size=(1, 1, roof_z_len), catalog=catalog)
    ridge.position.set(4, 15, roof_z_start)
    scene.add(ridge)

    # Gable Fills (North and South)
    # We fill the triangle at z=0 and z=8
    # y=10: x=0..8
    for z_pos in [0, 8]:
        fill_10 = Block("minecraft:white_wool", size=(9, 1, 1), catalog=catalog)
        fill_10.position.set(0, 10, z_pos)
        scene.add(fill_10)
        
        fill_11 = Block("minecraft:white_wool", size=(7, 1, 1), catalog=catalog)
        fill_11.position.set(1, 11, z_pos)
        scene.add(fill_11)
        
        fill_12 = Block("minecraft:white_wool", size=(5, 1, 1), catalog=catalog)
        fill_12.position.set(2, 12, z_pos)
        scene.add(fill_12)
        
        fill_13 = Block("minecraft:white_wool", size=(3, 1, 1), catalog=catalog)
        fill_13.position.set(3, 13, z_pos)
        scene.add(fill_13)
        
        fill_14 = Block("minecraft:white_wool", size=(1, 1, 1), catalog=catalog)
        fill_14.position.set(4, 14, z_pos)
        scene.add(fill_14)


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
