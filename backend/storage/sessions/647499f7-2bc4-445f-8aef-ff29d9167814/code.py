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
    wall_height = 4  # y=1 to y=4 inclusive

    # 1. Foundation (Cobblestone)
    # y=0
    foundation = Block("minecraft:cobblestone", size=(width, 1, depth), catalog=catalog)
    scene.add(foundation)

    # 2. Floor (Spruce Planks)
    # y=1, inside walls
    floor = Block("minecraft:spruce_planks", size=(width-2, 1, depth-2), catalog=catalog)
    floor.position.set(1, 1, 1)
    scene.add(floor)

    # 3. Corner Logs (Oak Logs)
    # x=0/8, z=0/8. y=1..4
    for x in [0, width-1]:
        for z in [0, depth-1]:
            log = Block(
                "minecraft:oak_log",
                size=(1, wall_height, 1),
                catalog=catalog,
                properties=axis_properties("y")
            )
            log.position.set(x, 1, z)
            scene.add(log)

    # 4. Walls with Windows

    # Left Wall (x=0)
    # z=1..3
    w1 = Block("minecraft:oak_planks", size=(1, wall_height, 3), catalog=catalog)
    w1.position.set(0, 1, 1)
    scene.add(w1)
    # z=5..7
    w2 = Block("minecraft:oak_planks", size=(1, wall_height, 3), catalog=catalog)
    w2.position.set(0, 1, 5)
    scene.add(w2)
    # z=4 (Window section)
    wb = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    wb.position.set(0, 1, 4)
    scene.add(wb)
    wt = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    wt.position.set(0, 4, 4)
    scene.add(wt)
    # Use full glass block for simplicity
    win = Block("minecraft:glass", size=(1, 2, 1), catalog=catalog)
    win.position.set(0, 2, 4)
    scene.add(win)

    # Right Wall (x=8)
    w3 = Block("minecraft:oak_planks", size=(1, wall_height, 3), catalog=catalog)
    w3.position.set(width-1, 1, 1)
    scene.add(w3)
    w4 = Block("minecraft:oak_planks", size=(1, wall_height, 3), catalog=catalog)
    w4.position.set(width-1, 1, 5)
    scene.add(w4)
    wb2 = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    wb2.position.set(width-1, 1, 4)
    scene.add(wb2)
    wt2 = Block("minecraft:oak_planks", size=(1, 1, 1), catalog=catalog)
    wt2.position.set(width-1, 4, 4)
    scene.add(wt2)
    win2 = Block("minecraft:glass", size=(1, 2, 1), catalog=catalog)
    win2.position.set(width-1, 2, 4)
    scene.add(win2)

    # Back Wall (z=8)
    back = Block("minecraft:oak_planks", size=(width-2, wall_height, 1), catalog=catalog)
    back.position.set(1, 1, depth-1)
    scene.add(back)

    # Front Wall (z=0) with Door
    # Left segment
    f1 = Block("minecraft:oak_planks", size=(3, wall_height, 1), catalog=catalog)
    f1.position.set(1, 1, 0)
    scene.add(f1)
    # Right segment
    f2 = Block("minecraft:oak_planks", size=(3, wall_height, 1), catalog=catalog)
    f2.position.set(5, 1, 0)
    scene.add(f2)
    # Above door
    f_top = Block("minecraft:oak_planks", size=(1, 2, 1), catalog=catalog)
    f_top.position.set(4, 3, 0)
    scene.add(f_top)
    # Door
    d_low = Block("minecraft:oak_door", catalog=catalog, properties={"facing": "north", "half": "lower", "open": "false"})
    d_low.position.set(4, 1, 0)
    scene.add(d_low)
    d_high = Block("minecraft:oak_door", catalog=catalog, properties={"facing": "north", "half": "upper", "open": "false"})
    d_high.position.set(4, 2, 0)
    scene.add(d_high)

    # 5. Roof
    roof_y = 5
    overhang = 1
    roof_depth = depth + 2 * overhang
    
    for i in range(5):
        # Left side (Ascend East -> Facing West)
        # x starts at -1 and increases
        sl = Block(
            "minecraft:stone_brick_stairs", 
            size=(1, 1, roof_depth), 
            catalog=catalog, 
            properties=stair_properties(facing="west")
        )
        sl.position.set(-1 + i, roof_y + i, -1)
        scene.add(sl)
        
        # Right side (Ascend West -> Facing East)
        # x starts at 9 and decreases
        sr = Block(
            "minecraft:stone_brick_stairs", 
            size=(1, 1, roof_depth), 
            catalog=catalog, 
            properties=stair_properties(facing="east")
        )
        sr.position.set(width - i, roof_y + i, -1)
        scene.add(sr)
        
        # Gables (Front and Back)
        gable_w = width - 2*i
        if gable_w > 0:
            # Front gable
            gf = Block("minecraft:oak_planks", size=(gable_w, 1, 1), catalog=catalog)
            gf.position.set(i, roof_y + i, 0)
            scene.add(gf)
            # Back gable
            gb = Block("minecraft:oak_planks", size=(gable_w, 1, 1), catalog=catalog)
            gb.position.set(i, roof_y + i, depth-1)
            scene.add(gb)
            
    # Ridge
    ridge = Block("minecraft:stone_bricks", size=(1, 1, roof_depth), catalog=catalog)
    ridge.position.set(4, roof_y + 5, -1)
    scene.add(ridge)
    
    # 6. Chimney (External)
    # x=9, z=6. Clips through roof overhang at y=5
    chimney = Block("minecraft:bricks", size=(1, 9, 1), catalog=catalog) # y=0..8
    chimney.position.set(9, 0, 6)
    scene.add(chimney)
    
    # Campfire on top for smoke
    smoke = Block("minecraft:campfire", catalog=catalog)
    smoke.position.set(9, 9, 6)
    scene.add(smoke)

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
