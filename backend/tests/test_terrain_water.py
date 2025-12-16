from __future__ import annotations


from app.agent.minecraft.terrain import create_terrain


def test_river_sand_does_not_extend_below_min_height() -> None:
    terrain = create_terrain(
        width=96,
        depth=96,
        seed=42,
        base_height=64,
        height_range=18,
        generate_decorations=False,
    )

    terrain.add_mountain(
        center_x=48,
        center_z=48,
        radius=32,
        height=42,
        seed=101,
        snow=True,
        snow_start_percent=0.72,
    )

    terrain.add_river(
        start_x=4,
        start_z=18,
        end_x=91,
        end_z=76,
        width=7,
        depth=10,
        seed=202,
    )

    terrain.generate()
    min_height = terrain.heightmap.min_height()

    sand_blocks = [child for child in terrain.children if getattr(child, "block_id", None) == "minecraft:sand"]
    assert sand_blocks, "Expected sand blocks for riverbed/beach generation"

    for block in sand_blocks:
        assert int(block.position.y) >= min_height

    min_child_y = min(int(child.position.y) for child in terrain.children)
    assert min_child_y >= min_height

