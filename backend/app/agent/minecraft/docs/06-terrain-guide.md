# Terrain Generation Guide

This guide covers procedural terrain generation and structure placement in the Minecraft SDK.

## Quick Start

### Basic Plains Terrain

```python
from app.agent.minecraft import Scene, BlockCatalog
from app.agent.minecraft.terrain import create_terrain

def build_structure() -> dict:
    catalog = BlockCatalog()

    # Generate 128x128 plains terrain
    terrain = create_terrain(128, 128, seed=42)
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
    terrain = create_terrain(128, 128, seed=42)
    terrain.generate()

    # Build a house
    house = Object3D()
    floor = Block("minecraft:oak_planks", size=(8, 1, 8), catalog=catalog)
    walls = Block("minecraft:oak_planks", size=(8, 4, 8), fill=False, catalog=catalog)
    walls.position.set(0, 1, 0)
    house.add(floor, walls)

    # Drop house onto terrain at position (64, 64)
    dropped = drop_to_surface(house, terrain, 64, 64, fill_bottom=True)

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
    generate_decorations=True,  # Add trees, flowers
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

### Noise Parameters

| Parameter | Effect | Typical Range |
|-----------|--------|---------------|
| `octaves` | Detail levels (more = more detail) | 3-6 |
| `persistence` | How quickly detail fades | 0.3-0.7 |
| `lacunarity` | Frequency multiplier per octave | 1.5-2.5 |
| `scale` | Overall smoothness (larger = smoother) | 30-100 |

## Plains Terrain Layers

The terrain generates with these layers (top to bottom):

1. **Grass Block** (1 block) - Surface layer
2. **Dirt** (3 blocks) - Subsurface
3. **Stone** (remaining) - Bedrock

## Terrain Methods

### Query Height

```python
terrain = create_terrain(128, 128)
terrain.generate()

# Get surface height at position
height = terrain.get_height_at(64, 64)

# Place a block on the surface manually
block.position.set(64, height + 1, 64)
```

### Flatten for Structure

```python
# Flatten area - can be called before or after generate()
# If called before, heightmap is auto-generated first
terrain.flatten_for_structure(
    x=50, z=50,           # Position
    width=20, depth=20,   # Area size
    target_height=65,     # Target height (None = use average)
    falloff=4,            # Edge blending distance
)
terrain.generate()  # Will use the flattened heightmap
```

## Placing Structures with drop_to_surface

The `drop_to_surface` function places a structure on the terrain surface.

### Basic Usage

```python
from app.agent.minecraft.terrain import drop_to_surface

# Drop structure onto terrain at (x=64, z=64)
dropped = drop_to_surface(my_structure, terrain, 64, 64)

scene = Scene()
scene.add(terrain)
scene.add(dropped)
```

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

# Get terrain height first
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
terrain = create_terrain(128, 128, seed=42)

# Add a natural-looking mountain
terrain.add_mountain(
    center_x=64, center_z=64,
    radius=35,           # Base radius (use 25+ for grand mountains)
    height=50,           # Peak height above terrain (use 30+ for impressive peaks)
    seed=123,            # Different seeds create different shapes
    snow=True,           # Add snow cap (default: True)
    snow_start_percent=0.7,  # Snow starts at 70% of peak height
)

terrain.generate()
```

### Add a Ridge

Creates an organic ridge with curved centerline and varying width:

```python
terrain = create_terrain(128, 128, seed=42)

# Add a natural ridge with sub-peaks
terrain.add_ridge(
    start_x=10, start_z=64,
    end_x=118, end_z=64,
    width=20,            # Base half-width (varies naturally along length)
    height=40,           # Peak height (varies with sub-peaks)
    seed=456,            # Different seeds create different curves
    snow=True,           # Add snow cap
)

terrain.generate()
```

### Add a Plateau

Creates a flat-topped mesa with stone surface:

```python
terrain = create_terrain(128, 128, seed=42)

# Add a stone plateau
terrain.add_plateau(
    center_x=64, center_z=64,
    radius=25,           # Total radius including slopes
    height=25,           # Height to raise
    flat_radius=15,      # Radius of flat top (default: radius // 2)
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
- **Plains**: Grass/dirt/stone layers for non-mountain areas

### Creating a Mountain Range

```python
terrain = create_terrain(128, 128, seed=42)

# Create organic peaks - each with unique shape from different seeds
terrain.add_mountain(32, 64, radius=30, height=45, seed=100)
terrain.add_mountain(64, 64, radius=35, height=55, seed=200)  # Central peak
terrain.add_mountain(96, 64, radius=30, height=45, seed=300)

# Connect peaks with an organic ridge
terrain.add_ridge(32, 64, 96, 64, width=18, height=35, seed=400)

# Add a plateau for a structure
terrain.add_plateau(64, 20, radius=18, height=20, snow=False)
terrain.flatten_for_structure(55, 11, width=18, depth=18)

terrain.generate()
```

## HeightMap Direct Access

For advanced terrain manipulation (note: using `Terrain` methods is preferred as they handle block types automatically):

```python
from app.agent.minecraft.terrain import HeightMap, HeightMapConfig

config = HeightMapConfig(width=128, depth=128, base_height=64, height_range=32)
heightmap = HeightMap(config)
heightmap.generate()

# Query
height = heightmap.get(50, 50)
avg = heightmap.get_average_height(40, 40, 20, 20)

# Modify
heightmap.flatten_area(50, 50, 10, 10, target_height=70)
heightmap.smooth(radius=2, iterations=1)
heightmap.raise_area(30, 30, 5, 5, amount=3)
heightmap.carve_area(60, 60, 5, 5, amount=4)

# Mountains (heightmap only - won't get stone/snow blocks, use Terrain methods instead)
heightmap.add_mountain(64, 64, radius=35, height=50, seed=123)
heightmap.add_ridge(10, 64, 118, 64, width=20, height=40, seed=456)
heightmap.add_plateau(64, 64, radius=20, height=25)
```

## Complete Example

```python
from app.agent.minecraft import Scene, Block, Object3D, BlockCatalog
from app.agent.minecraft.terrain import create_terrain, drop_to_surface

def build_structure() -> dict:
    catalog = BlockCatalog()

    # Generate terrain
    terrain = create_terrain(
        width=128,
        depth=128,
        seed=42,
        base_height=64,
        height_range=16,
        generate_decorations=True,
    )
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
        cottage, terrain, 64, 64,
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
