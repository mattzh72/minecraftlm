# Terrain Generation Guide

This guide covers procedural terrain generation and structure placement in the Minecraft SDK.

## Terrain Size Guidelines

Terrain size is flexible - choose what fits your creative vision:

- **128x128**: Small scenes, intimate builds, quick iteration
- **256x256**: Standard scenes with room for multiple features (recommended for most builds)
- **512x512**: Large landscapes, sprawling villages, epic mountain ranges
- **1024x1024+**: Massive worlds for ambitious projects (may impact render performance)

**Larger terrains enable:**
- More dramatic terrain features (mountain ranges, river systems)
- Better composition and spatial storytelling
- Room for multiple structures with natural spacing
- More realistic landscapes with gradual transitions

Don't hesitate to go big - the terrain system handles large sizes efficiently!

## Quick Start

### Basic Plains Terrain

```python
from app.agent.minecraft import Scene, BlockCatalog
from app.agent.minecraft.terrain import create_terrain

def build_structure() -> dict:
    catalog = BlockCatalog()

    # Generate 256x256 plains terrain (default biome)
    terrain = create_terrain(256, 256, seed=42)
    terrain.generate()

    scene = Scene()
    scene.add(terrain)

    return scene.to_structure()
```

### Choose a Biome

```python
from app.agent.minecraft import Scene
from app.agent.minecraft.terrain import create_terrain

def build_structure() -> dict:
    terrain = create_terrain(256, 256, seed=42, biome='desert')
    terrain.generate()

    scene = Scene()
    scene.add(terrain)

    return scene.to_structure()
```

### Structure on Terrain

```python
from app.agent.minecraft import Scene, Block, Object3D, BlockCatalog
from app.agent.minecraft.terrain import create_terrain, drop_to_surface

def build_structure() -> dict:
    catalog = BlockCatalog()

    # Generate terrain
    terrain = create_terrain(256, 256, seed=42)
    terrain.generate()

    # Build a house
    house = Object3D()
    floor = Block("minecraft:oak_planks", size=(8, 1, 8), catalog=catalog)
    walls = Block("minecraft:oak_planks", size=(8, 4, 8), fill=False, catalog=catalog)
    walls.position.set(0, 1, 0)
    house.add(floor, walls)

    # Drop house onto terrain at position (128, 128)
    dropped = drop_to_surface(house, terrain, 128, 128, fill_bottom=True)

    scene = Scene()
    scene.add(terrain)
    scene.add(dropped)

    return scene.to_structure()
```

## Terrain Configuration

### TerrainConfig

```python
from app.agent.minecraft.terrain import TerrainConfig, Terrain, NoiseConfig

config = TerrainConfig(
    width=256,              # X dimension
    depth=256,              # Z dimension
    base_height=64,         # Sea level / average height
    height_range=32,        # Max deviation from base
    seed=42,                # Random seed
    biome="plains",         # Land biome (single-biome terrain)
    generate_decorations=True,  # Add trees, flowers
    tree_density=1.0,       # Tree multiplier (0.1 = sparse, 3.0 = dense)
    noise_config=NoiseConfig(
        octaves=4,          # Noise detail levels
        persistence=0.5,    # Amplitude decay
        lacunarity=2.0,     # Frequency increase
        scale=50.0,         # Overall smoothness
    ),
)

terrain = Terrain(config)
terrain.generate()
```

### Biome Options

The terrain generator currently supports **one land biome per Terrain** via `TerrainConfig(biome=...)` or `create_terrain(..., biome=...)`.

Available biomes:
- `plains` (default)
- `forest`
- `desert`
- `snowy_plains`
- `taiga`
- `badlands`

### Noise Parameters

| Parameter | Effect | Typical Range |
|-----------|--------|---------------|
| `octaves` | Detail levels (more = more detail) | 3-6 |
| `persistence` | How quickly detail fades | 0.3-0.7 |
| `lacunarity` | Frequency multiplier per octave | 1.5-2.5 |
| `scale` | Overall smoothness (larger = smoother) | 30-100 |

## Biome Terrain Layers

The land surface block stack depends on `biome`:

- `plains` / `forest`: grass block → dirt → stone
- `desert`: sand → sandstone → stone
- `snowy_plains`: snow layer on top of snowy grass block → dirt → stone
- `taiga`: podzol → dirt → stone
- `badlands`: red sand → terracotta → stone

## Terrain Methods

### Query Height

```python
terrain = create_terrain(256, 256)
terrain.generate()

# Get surface height at position
height = terrain.get_height_at(128, 128)

# Place a block on the surface manually
block.position.set(128, height + 1, 128)
```

### Flatten for Structure

```python
# Flatten area - can be called before or after generate()
# If called before, heightmap is auto-generated first
terrain.flatten_for_structure(
    x=50, z=50,           # WARNING: min/corner of area (not center)
    width=20, depth=20,   # Area size
    target_height=65,     # Target height (None = use average)
    falloff=4,            # Edge blending distance
)
terrain.generate()  # Will use the flattened heightmap
```

## Placing Structures with drop_to_surface

The `drop_to_surface` function places a structure on the terrain surface.

> **WARNING (Important)**  
> `drop_to_surface(structure, terrain, x, z, ...)` interprets `x,z` as the **min/corner of the structure footprint**.  
> If you pass a “center” point directly, the structure will be offset into one quadrant of that point.  
> This is especially noticeable when your structure is built around `(0,0,0)` and includes negative local coordinates.

### Basic Usage

```python
from app.agent.minecraft.terrain import drop_to_surface

# Drop structure so its footprint corner starts at (x=64, z=64)
dropped = drop_to_surface(my_structure, terrain, 64, 64)

scene = Scene()
scene.add(terrain)
scene.add(dropped)
```

### Centering a Structure on a Pad

If you want your structure centered on a location `(cx, cz)` (for example, the center of a flattened area), compute the corner first:

```python
# If you know your structure width/depth in blocks:
place_x = cx - struct_width // 2
place_z = cz - struct_depth // 2

dropped = drop_to_surface(my_structure, terrain, place_x, place_z)
```

If your structure is built around `(0,0,0)` using negative coordinates (common for symmetric builds), this corner conversion is required to avoid quadrant offsets.

### With Gap Filling

When terrain is uneven, gaps can appear between the structure and ground. Use `fill_bottom=True` to fill these gaps:

```python
dropped = drop_to_surface(
    my_structure,
    terrain,
    64, 64,
    fill_bottom=True,                      # Fill gaps below structure
    fill_material="minecraft:cobblestone"  # Material for fill blocks
)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `structure` | Object3D | required | Structure to place |
| `terrain` | Terrain | required | Terrain to place on |
| `x` | int | required | X position |
| `z` | int | required | Z position |
| `fill_bottom` | bool | False | Fill gaps to terrain |
| `fill_material` | str | "minecraft:cobblestone" | Block for filling |
| `catalog` | BlockCatalog | None | Block catalog |

## Decorations

### Manual Decoration Placement

```python
from app.agent.minecraft.terrain import (
    generate_oak_tree,
    generate_flowers,
    generate_tall_grass,
)

# Get terrain surface height first
height = terrain.get_height_at(50, 50)

# Add a tree
tree = generate_oak_tree(50, height, 50, catalog=catalog, seed=123)
scene.add(tree)

# Add flowers
flower = generate_flowers(60, height, 60, flower_type="poppy", catalog=catalog)
scene.add(flower)

# Add tall grass
grass = generate_tall_grass(70, height, 70, catalog=catalog)
scene.add(grass)
```

### Available Flower Types

- `poppy`
- `dandelion`
- `cornflower`
- `oxeye_daisy`
- `azure_bluet`

## Mountain Generation

The terrain system creates **organic, realistic mountains** using domain warping and multi-layer noise. Mountains have:
- Irregular, natural base shapes (not cones!)
- Varying slopes on different sides
- Ridge patterns radiating from peaks
- Stone surfaces with optional snow caps

### Add a Mountain

Creates an organic mountain with natural shape variation:

```python
terrain = create_terrain(512, 512, seed=42)

# Add a natural-looking mountain
terrain.add_mountain(
    center_x=256, center_z=256,
    radius=60,           # Base radius (use 25+ for grand mountains, 50+ for epic scale)
    height=80,           # Peak height above terrain (use 30+ for impressive peaks)
    seed=123,            # Different seeds create different shapes
    snow=True,           # Add snow cap (default: True)
    snow_start_percent=0.7,  # Snow starts at 70% of peak height
)

terrain.generate()
```

### Add a Ridge

Creates an organic ridge with curved centerline and varying width:

```python
terrain = create_terrain(512, 512, seed=42)

# Add a natural ridge with sub-peaks
terrain.add_ridge(
    start_x=50, start_z=256,
    end_x=462, end_z=256,
    width=30,            # Base half-width (varies naturally along length)
    height=60,           # Peak height (varies with sub-peaks)
    seed=456,            # Different seeds create different curves
    snow=True,           # Add snow cap
)

terrain.generate()
```

### Add a Plateau

Creates a flat-topped mesa with stone surface:

```python
terrain = create_terrain(256, 256, seed=42)

# Add a stone plateau
terrain.add_plateau(
    center_x=128, center_z=128,
    radius=40,           # Total radius including slopes
    height=30,           # Height to raise
    flat_radius=25,      # Radius of flat top (default: radius // 2)
    snow=False,          # Plateaus don't have snow by default
)

terrain.generate()
```

### Mountain Parameters

| Method | Parameter | Default | Description |
|--------|-----------|---------|-------------|
| All | `seed` | auto | Controls shape variation - try different values! |
| All | `snow` | True (mountain/ridge), False (plateau) | Whether to add snow cap |
| All | `snow_start_percent` | 0.7 | How far up snow starts (0.7 = top 30%) |
| All | `falloff` | 1.8 | Slope steepness (higher = steeper near peak) |
| `add_ridge` | `width` | - | Base half-width (varies naturally) |
| `add_plateau` | `flat_radius` | radius // 2 | Size of flat top |

### Block Types

Mountains use proper Minecraft block layers:
- **Snow cap**: `minecraft:snow_block` at elevations above snow line
- **Stone surface**: `minecraft:stone` for mountain surfaces
- **Land**: Uses the selected `biome` layer stack for non-mountain areas

### Creating a Mountain Range

```python
terrain = create_terrain(512, 512, seed=42)

# Create organic peaks - each with unique shape from different seeds
terrain.add_mountain(128, 256, radius=50, height=70, seed=100)
terrain.add_mountain(256, 256, radius=60, height=85, seed=200)  # Central peak
terrain.add_mountain(384, 256, radius=50, height=70, seed=300)

# Connect peaks with an organic ridge
terrain.add_ridge(128, 256, 384, 256, width=30, height=55, seed=400)

# Add a plateau for a structure
terrain.add_plateau(256, 100, radius=35, height=30, snow=False)
terrain.flatten_for_structure(238, 82, width=36, depth=36)

terrain.generate()
```

## Valley and Depression Generation

The terrain system creates natural valleys, gorges, and craters using organic shape generation. These features can be filled with water to create lakes and rivers.

### Add a Valley

Creates a broad valley with gentle slopes (inverse of mountains):

```python
terrain = create_terrain(256, 256, seed=42)

# Add a natural valley
terrain.add_valley(
    center_x=128, center_z=128,
    radius=50,           # Valley radius (use 25+ for broad valleys, 50+ for grand scale)
    depth=20,            # Depth to carve (use 10-25)
    seed=123,            # Different seeds create different shapes
    fill_water=False,    # Optionally fill with water to create a lake
)

terrain.generate()
```

### Add a Gorge

Creates a narrow, steep-sided canyon:

```python
terrain = create_terrain(512, 512, seed=42)

# Add a dramatic canyon
terrain.add_gorge(
    start_x=50, start_z=256,
    end_x=462, end_z=256,
    width=12,            # Canyon width (use 8-15)
    depth=35,            # Depth to carve (use 15-35 for dramatic gorges)
    seed=456,            # Controls path curvature
    fill_water=False,    # Can create a river canyon
)

terrain.generate()
```

### Add a Crater

Creates a circular depression with optional raised rim:

```python
terrain = create_terrain(256, 256, seed=42)

# Add an impact crater
terrain.add_crater(
    center_x=128, center_z=128,
    radius=35,           # Crater radius
    depth=20,            # Bowl depth
    rim_height=8,        # Raised rim height (0 = no rim)
    fill_water=True,     # Creates a crater lake
    water_level=68,      # Optional: override water surface level (e.g., near the rim)
)

terrain.generate()
```

Note: When you provide `water_level`, the SDK clamps it to the lowest rim height in the rim band to avoid overflow down the crater walls.

### Valley Parameters

| Method | Parameter | Default | Description |
|--------|-----------|---------|-------------|
| `add_valley` | `radius` | - | Valley radius (use 25+) |
| `add_valley` | `depth` | - | Depth to carve (10-25) |
| `add_valley` | `falloff` | 1.8 | Slope steepness |
| `add_valley` | `fill_water` | False | Fill with water |
| `add_gorge` | `width` | - | Canyon width (8-15) |
| `add_gorge` | `depth` | - | Depth to carve (15-35) |
| `add_gorge` | `falloff` | 2.5 | Wall steepness (steeper than valleys) |
| `add_crater` | `rim_height` | 0 | Raised rim height (3-8 for impact craters) |
| `add_crater` | `fill_water` | False | Fill with water |
| `add_crater` | `water_level` | None | Water surface level (when filling) |

## Water Features

The terrain system supports oceans, lakes, and rivers with proper underwater terrain (sand/gravel instead of grass/dirt).

### Global Water Level (Oceans)

Set a global water level for oceans and seas:

```python
# Create terrain with ocean level set
terrain = create_terrain(
    width=512,
    depth=512,
    base_height=64,
    water_level=65,      # All terrain below 65 will be underwater
    seed=42,
)

terrain.generate()

# Creates underwater terrain with sand/gravel layers
# Beach transitions at water edges
```

### Add a Lake

Creates a valley filled with water:

```python
terrain = create_terrain(256, 256, seed=42)

# Add a natural lake
terrain.add_lake(
    center_x=128, center_z=128,
    radius=40,           # Lake radius
    depth=12,            # Depth below terrain
    seed=789,            # Lake shape variation
)

terrain.generate()
```

### Add a River

Creates a terrain-following river between two points:

Note: terrain features apply in the order you call them. For example, if you want a river to cut through a mountain, call `add_mountain(...)` first and `add_river(...)` after. If you add a mountain after a river, it can raise terrain back up and "erase" the river cut.

```python
terrain = create_terrain(512, 512, seed=42)

# Add a winding river
terrain.add_river(
    start_x=50, start_z=50,
    end_x=462, end_z=462,
    width=8,             # River width (use 3-8 for streams, 10-20 for rivers)
    depth=6,             # River depth (use 2-5 for shallow, 6-12 for deep)
    seed=999,            # Path variation
)

terrain.generate()
```

### Water Block Types

Water features automatically use appropriate blocks:
- **Water**: `minecraft:water` fills from terrain to water level
- **Underwater terrain**: Sand (3 blocks), gravel (2 blocks), stone (base)
- **Beaches**: Sand layers at water edges (within 3 blocks of water, up to 2 blocks above water level)

### Creating a Lake System

```python
terrain = create_terrain(512, 512, seed=42)

# Main lake in valley
terrain.add_lake(256, 256, radius=60, depth=15)

# Smaller connected lake
terrain.add_lake(360, 200, radius=30, depth=10)

# River connecting to edge
terrain.add_river(
    start_x=360, start_z=230,
    end_x=512, end_z=100,
    width=8,
    depth=5,
)

terrain.generate()
```

### Creating a Coastal Scene

```python
terrain = create_terrain(
    width=512,
    depth=512,
    base_height=64,
    height_range=25,
    water_level=66,      # Ocean level
    seed=42,
)

# Add a mountain near the coast
terrain.add_mountain(360, 256, radius=50, height=60)

# Flatten area for a beach resort
terrain.flatten_for_structure(80, 200, width=40, depth=40)

terrain.generate()

# Now place your resort on the beach!
```

## HeightMap Direct Access

For advanced terrain manipulation (note: using `Terrain` methods is preferred as they handle block types automatically):

```python
from app.agent.minecraft.terrain import HeightMap, HeightMapConfig

config = HeightMapConfig(width=256, depth=256, base_height=64, height_range=32)
heightmap = HeightMap(config)
heightmap.generate()

# Query
height = heightmap.get(100, 100)
avg = heightmap.get_average_height(80, 80, 40, 40)

# Modify
heightmap.flatten_area(100, 100, 20, 20, target_height=70)
heightmap.smooth(radius=2, iterations=1)
heightmap.raise_area(60, 60, 10, 10, amount=3)
heightmap.carve_area(120, 120, 10, 10, amount=4)

# Mountains (heightmap only - won't get stone/snow blocks, use Terrain methods instead)
heightmap.add_mountain(128, 128, radius=60, height=70, seed=123)
heightmap.add_ridge(20, 128, 236, 128, width=30, height=60, seed=456)
heightmap.add_plateau(128, 128, radius=40, height=30)

# Valleys (heightmap only - won't get water, use Terrain methods instead)
heightmap.add_valley(128, 128, radius=50, depth=20, seed=789)
heightmap.add_gorge(20, 128, 236, 128, width=12, depth=30, seed=321)
heightmap.add_crater(128, 128, radius=35, depth=20, rim_height=8)
```

## Complete Example

```python
from app.agent.minecraft import Scene, Block, Object3D, BlockCatalog
from app.agent.minecraft.terrain import create_terrain, drop_to_surface

def build_structure() -> dict:
    catalog = BlockCatalog()

    # Generate terrain with varied features
    terrain = create_terrain(
        width=512,
        depth=512,
        seed=42,
        base_height=64,
        height_range=20,
        generate_decorations=True,
    )

    # Add a mountain for backdrop
    terrain.add_mountain(384, 256, radius=60, height=70, seed=100)

    # Flatten area for cottage placement
    terrain.flatten_for_structure(236, 236, width=40, depth=40, falloff=6)

    terrain.generate()

    # Build a cottage
    cottage = Object3D()

    # Floor
    floor = Block("minecraft:oak_planks", size=(10, 1, 8), catalog=catalog)
    cottage.add(floor)

    # Walls
    walls = Block("minecraft:oak_planks", size=(10, 4, 8), fill=False, catalog=catalog)
    walls.position.set(0, 1, 0)
    cottage.add(walls)

    # Roof
    roof = Block("minecraft:oak_planks", size=(12, 1, 10), catalog=catalog)
    roof.position.set(-1, 5, -1)
    cottage.add(roof)

    # Drop cottage onto terrain with foundation fill
    dropped = drop_to_surface(
        cottage, terrain, 256, 256,
        fill_bottom=True,
        fill_material="minecraft:cobblestone",
        catalog=catalog,
    )

    scene = Scene()
    scene.add(terrain)
    scene.add(dropped)

    return scene.to_structure()

structure = build_structure()
```
