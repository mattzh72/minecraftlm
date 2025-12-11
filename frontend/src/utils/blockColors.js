/**
 * Block type to color mapping for Three.js renderer
 * Uses approximate Minecraft block colors
 */

// Common block colors (hex values)
const BLOCK_COLORS = {
  // Stone variants
  'minecraft:stone': 0x7d7d7d,
  'minecraft:cobblestone': 0x6b6b6b,
  'minecraft:mossy_cobblestone': 0x6b7d5a,
  'minecraft:stone_bricks': 0x7a7a7a,
  'minecraft:deepslate': 0x4a4a4a,
  'minecraft:andesite': 0x8a8a8a,
  'minecraft:diorite': 0xc0c0c0,
  'minecraft:granite': 0x9a6b4a,
  'minecraft:smooth_stone': 0x9d9d9d,

  // Dirt/Grass
  'minecraft:dirt': 0x8b5a2b,
  'minecraft:grass_block': 0x5d8c32,
  'minecraft:podzol': 0x6b4423,
  'minecraft:mycelium': 0x6f6369,
  'minecraft:coarse_dirt': 0x6b4a2a,
  'minecraft:rooted_dirt': 0x8b6542,
  'minecraft:mud': 0x3c3c3c,

  // Sand
  'minecraft:sand': 0xdbd3a0,
  'minecraft:sandstone': 0xd9d09e,
  'minecraft:red_sand': 0xbf6621,
  'minecraft:red_sandstone': 0xba6621,
  'minecraft:gravel': 0x837f7e,

  // Wood - Oak
  'minecraft:oak_log': 0x6b5839,
  'minecraft:oak_planks': 0xb8945f,
  'minecraft:oak_wood': 0x6b5839,
  'minecraft:stripped_oak_log': 0xb8945f,

  // Wood - Spruce
  'minecraft:spruce_log': 0x3b2912,
  'minecraft:spruce_planks': 0x7a5a32,
  'minecraft:spruce_wood': 0x3b2912,

  // Wood - Birch
  'minecraft:birch_log': 0xd5cda9,
  'minecraft:birch_planks': 0xc8b77a,
  'minecraft:birch_wood': 0xd5cda9,

  // Wood - Dark Oak
  'minecraft:dark_oak_log': 0x3b2912,
  'minecraft:dark_oak_planks': 0x42321a,
  'minecraft:dark_oak_wood': 0x3b2912,

  // Leaves
  'minecraft:oak_leaves': 0x4a7a32,
  'minecraft:spruce_leaves': 0x3b5a32,
  'minecraft:birch_leaves': 0x5a8a42,
  'minecraft:dark_oak_leaves': 0x3a6a2a,
  'minecraft:azalea_leaves': 0x5a8a42,

  // Ores
  'minecraft:coal_ore': 0x4a4a4a,
  'minecraft:iron_ore': 0x8a7a6a,
  'minecraft:gold_ore': 0xfcee4b,
  'minecraft:diamond_ore': 0x5decf5,
  'minecraft:emerald_ore': 0x41f384,
  'minecraft:lapis_ore': 0x2351a8,
  'minecraft:redstone_ore': 0x8b0000,
  'minecraft:copper_ore': 0xbf6621,

  // Processed blocks
  'minecraft:iron_block': 0xdadada,
  'minecraft:gold_block': 0xf5d742,
  'minecraft:diamond_block': 0x5decf5,
  'minecraft:emerald_block': 0x41f384,
  'minecraft:lapis_block': 0x2351a8,
  'minecraft:redstone_block': 0xaa0000,
  'minecraft:copper_block': 0xbf6621,
  'minecraft:coal_block': 0x1a1a1a,

  // Bricks
  'minecraft:bricks': 0x966464,
  'minecraft:nether_bricks': 0x2d1b1b,
  'minecraft:red_nether_bricks': 0x470000,

  // Glass
  'minecraft:glass': 0xc0f0f0,
  'minecraft:tinted_glass': 0x2d2d2d,

  // Concrete
  'minecraft:white_concrete': 0xcfd5d6,
  'minecraft:orange_concrete': 0xe06100,
  'minecraft:magenta_concrete': 0xa9309f,
  'minecraft:light_blue_concrete': 0x2489c7,
  'minecraft:yellow_concrete': 0xf1af15,
  'minecraft:lime_concrete': 0x5ea818,
  'minecraft:pink_concrete': 0xd6658f,
  'minecraft:gray_concrete': 0x36393d,
  'minecraft:light_gray_concrete': 0x7d7d73,
  'minecraft:cyan_concrete': 0x157788,
  'minecraft:purple_concrete': 0x64209c,
  'minecraft:blue_concrete': 0x2d2f8f,
  'minecraft:brown_concrete': 0x603b1f,
  'minecraft:green_concrete': 0x495b24,
  'minecraft:red_concrete': 0x8e2121,
  'minecraft:black_concrete': 0x080a0f,

  // Terracotta
  'minecraft:terracotta': 0x985f45,
  'minecraft:white_terracotta': 0xd1b2a1,
  'minecraft:orange_terracotta': 0xa15325,
  'minecraft:red_terracotta': 0x8f3d2e,
  'minecraft:brown_terracotta': 0x4d3323,

  // Wool
  'minecraft:white_wool': 0xe9ecec,
  'minecraft:orange_wool': 0xf07613,
  'minecraft:magenta_wool': 0xbd44b3,
  'minecraft:light_blue_wool': 0x3ab3da,
  'minecraft:yellow_wool': 0xf8c527,
  'minecraft:lime_wool': 0x70b919,
  'minecraft:pink_wool': 0xed8dac,
  'minecraft:gray_wool': 0x3e4447,
  'minecraft:light_gray_wool': 0x8e8e86,
  'minecraft:cyan_wool': 0x158991,
  'minecraft:purple_wool': 0x792aac,
  'minecraft:blue_wool': 0x35399d,
  'minecraft:brown_wool': 0x724728,
  'minecraft:green_wool': 0x546d1b,
  'minecraft:red_wool': 0xa12722,
  'minecraft:black_wool': 0x141519,

  // Nether
  'minecraft:netherrack': 0x6f3232,
  'minecraft:nether_quartz_ore': 0x8f7a6f,
  'minecraft:quartz_block': 0xebe5de,
  'minecraft:glowstone': 0xffda7a,
  'minecraft:soul_sand': 0x5a4a3a,
  'minecraft:basalt': 0x4a4a4a,
  'minecraft:blackstone': 0x2a2a2a,

  // End
  'minecraft:end_stone': 0xdbe3a0,
  'minecraft:end_stone_bricks': 0xdbe3a0,
  'minecraft:purpur_block': 0xa77ba7,

  // Misc
  'minecraft:obsidian': 0x1a0a24,
  'minecraft:crying_obsidian': 0x2a0a34,
  'minecraft:bedrock': 0x3a3a3a,
  'minecraft:water': 0x3f76e4,
  'minecraft:lava': 0xcf5a00,
  'minecraft:ice': 0x91b5fc,
  'minecraft:packed_ice': 0x7dadfc,
  'minecraft:blue_ice': 0x74b4fc,
  'minecraft:snow_block': 0xf0fafa,
  'minecraft:clay': 0x9ea4b0,
  'minecraft:bookshelf': 0x6b5839,
  'minecraft:hay_block': 0xb5970c,
  'minecraft:melon': 0x6b8b23,
  'minecraft:pumpkin': 0xc77617,
  'minecraft:jack_o_lantern': 0xc77617,
  'minecraft:sponge': 0xc7c74f,
  'minecraft:prismarine': 0x5a9a8a,
  'minecraft:sea_lantern': 0xacdfe6,
  'minecraft:slime_block': 0x7ebf6d,
  'minecraft:honey_block': 0xeba937,
  'minecraft:honeycomb_block': 0xe09e34,
  'minecraft:moss_block': 0x5a7a3a,
  'minecraft:sculk': 0x0d1d2d,
  'minecraft:amethyst_block': 0x8b5cf5,
  'minecraft:tuff': 0x6a6a62,
  'minecraft:calcite': 0xdedede,
  'minecraft:dripstone_block': 0x866b5e,
};

// Default color for unknown blocks
const DEFAULT_COLOR = 0xff00ff; // Magenta for visibility

/**
 * Get the color for a block type
 * @param {string} blockType - Minecraft block ID (e.g., "minecraft:stone")
 * @returns {number} - Hex color value
 */
export function getBlockColor(blockType) {
  // Normalize the block type
  const normalizedType = blockType.startsWith('minecraft:')
    ? blockType
    : `minecraft:${blockType}`;

  return BLOCK_COLORS[normalizedType] ?? DEFAULT_COLOR;
}

/**
 * Get all registered block colors
 * @returns {Object} - Map of block types to colors
 */
export function getAllBlockColors() {
  return { ...BLOCK_COLORS };
}

export default BLOCK_COLORS;
