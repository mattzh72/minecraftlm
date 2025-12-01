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

    # Constants
    width = 9
    depth = 11
    wall_h = 4
    
    # Foundation
    ground = Block("minecraft:cobblestone", size=(width, 1, depth), catalog=catalog)
    ground.position = Vector3(0, 0, 0)
    scene.add(ground)

    # Floor (inside)
    floor = Block("minecraft:spruce_planks", size=(width - 2, 1, depth - 2), catalog=catalog)
    floor.position = Vector3(1, 1, 1)
    scene.add(floor)

    # Corner Pillars
    log_y = axis_properties("y")
    for x in [0, width - 1]:
        for z in [0, depth - 1]:
            pillar = Block("minecraft:spruce_log", size=(1, wall_h, 1), properties=log_y, catalog=catalog)
            pillar.position = Vector3(x, 1, z)
            scene.add(pillar)

    # Walls
    
    # Left Wall (X=0) - between pillars (Z=1 to depth-2)
    # Split for window at Z=5 (center of 11 is 5)
    # Part 1: Z=1..4 (size 4)
    lw1 = Block("minecraft:oak_planks", size=(1, wall_h, 4), catalog=catalog)
    lw1.position = Vector3(0, 1, 1)
    scene.add(lw1)
    
    # Window col at Z=5
    lw_bot = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    lw_bot.position = Vector3(0, 1, 5)
    scene.add(lw_bot)
    
    lw_glass = Block("minecraft:glass_pane", size=(1, 2, 1), catalog=catalog)
    lw_glass.position = Vector3(0, 2, 5)
    scene.add(lw_glass)
    
    lw_top = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    lw_top.position = Vector3(0, 4, 5)
    scene.add(lw_top)
    
    # Part 2: Z=6..9 (size 4)
    lw2 = Block("minecraft:oak_planks", size=(1, wall_h, 4), catalog=catalog)
    lw2.position = Vector3(0, 1, 6)
    scene.add(lw2)

    # Right Wall (X=8) - symmetrical
    rw1 = Block("minecraft:oak_planks", size=(1, wall_h, 4), catalog=catalog)
    rw1.position = Vector3(8, 1, 1)
    scene.add(rw1)
    
    rw_bot = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    rw_bot.position = Vector3(8, 1, 5)
    scene.add(rw_bot)
    
    rw_glass = Block("minecraft:glass_pane", size=(1, 2, 1), catalog=catalog)
    rw_glass.position = Vector3(8, 2, 5)
    scene.add(rw_glass)
    
    rw_top = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    rw_top.position = Vector3(8, 4, 5)
    scene.add(rw_top)
    
    rw2 = Block("minecraft:oak_planks", size=(1, wall_h, 4), catalog=catalog)
    rw2.position = Vector3(8, 1, 6)
    scene.add(rw2)

    # Back Wall (Z=10) - between pillars (X=1 to 7)
    back_wall = Block("minecraft:oak_planks", size=(width - 2, wall_h, 1), catalog=catalog)
    back_wall.position = Vector3(1, 1, depth - 1)
    scene.add(back_wall)

    # Front Wall (Z=0)
    # Door at X=4.
    # Left: X=1..3
    fw_left = Block("minecraft:oak_planks", size=(3, wall_h, 1), catalog=catalog)
    fw_left.position = Vector3(1, 1, 0)
    scene.add(fw_left)
    
    # Right: X=5..7
    fw_right = Block("minecraft:oak_planks", size=(3, wall_h, 1), catalog=catalog)
    fw_right.position = Vector3(5, 1, 0)
    scene.add(fw_right)
    
    # Above door
    fw_top = Block("minecraft:oak_planks", size=(1, wall_h - 2, 1), catalog=catalog)
    fw_top.position = Vector3(4, 3, 0)
    scene.add(fw_top)

    # Door
    door_low = Block("minecraft:oak_door", catalog=catalog, properties={"facing": "south", "half": "lower"})
    door_low.position = Vector3(4, 1, 0)
    scene.add(door_low)
    
    door_high = Block("minecraft:oak_door", catalog=catalog, properties={"facing": "south", "half": "upper"})
    door_high.position = Vector3(4, 2, 0)
    scene.add(door_high)
    
    # Roof
    base_y = 5
    
    for i in range(5): # 0..4
        # Layers
        y = base_y + i
        
        if i == 4:
            # Ridge
            ridge = Block("minecraft:spruce_planks", size=(1, 1, depth + 2), catalog=catalog)
            ridge.position = Vector3(4, y, -1)
            scene.add(ridge)
        else:
            # Left slope
            stair_l = Block("minecraft:spruce_stairs", size=(1, 1, depth + 2), 
                            properties=stair_properties(facing="east"), catalog=catalog)
            stair_l.position = Vector3(i, y, -1)
            scene.add(stair_l)
            
            # Right slope
            stair_r = Block("minecraft:spruce_stairs", size=(1, 1, depth + 2), 
                            properties=stair_properties(facing="west"), catalog=catalog)
            stair_r.position = Vector3(width - 1 - i, y, -1)
            scene.add(stair_r)

    # Gables (fill triangle at Z=0 and Z=depth-1)
    # Iterate columns X=1..7
    for x in range(1, width - 1):
        dist = min(x, (width - 1) - x)
        h = dist
        if h > 0:
            # Front
            gf = Block("minecraft:oak_planks", size=(1, h, 1), catalog=catalog)
            gf.position = Vector3(x, 5, 0)
            scene.add(gf)
            
            # Back
            gb = Block("minecraft:oak_planks", size=(1, h, 1), catalog=catalog)
            gb.position = Vector3(x, 5, depth - 1)
            scene.add(gb)

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
