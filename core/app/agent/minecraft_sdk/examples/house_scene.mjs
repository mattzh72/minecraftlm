// Example: build a small house using the Three.js-style Minecraft SDK.
// Run from repo root with:
//   node app/agent/minecraft_sdk/examples/house_scene.mjs

import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Scene,
  Block,
  Vector3,
  BlockCatalog,
  stairProperties,
} from "../index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalog = new BlockCatalog();
const scene = new Scene();

// Ground (16x1x16 grass)
const ground = new Block("minecraft:grass_block", {
  size: [16, 1, 16],
  catalog,
});
scene.add(ground);

// Floor (12x1x12 planks, inset)
const floor = new Block("minecraft:oak_planks", {
  size: [12, 1, 12],
  catalog,
});
floor.position = new Vector3(2, 1, 2);
scene.add(floor);

// Walls: hollow oak shell 12x4x12
const walls = new Block("minecraft:oak_planks", {
  size: [12, 4, 12],
  fill: false,
  catalog,
});
walls.position = new Vector3(2, 2, 2);
scene.add(walls);

// Glass inset on all sides (simple solid volume)
const glass = new Block("minecraft:glass", {
  size: [10, 3, 10],
  catalog,
});
glass.position = new Vector3(3, 3, 3);
scene.add(glass);

// Roof: solid stone brick slab
const roof = new Block("minecraft:stone_bricks", {
  size: [12, 1, 12],
  catalog,
});
roof.position = new Vector3(2, 6, 2);
scene.add(roof);

// Simple oak door (lower half only) centered on south wall
const door = new Block("minecraft:oak_door", {
  catalog,
  properties: {
    facing: "south",
    half: "lower",
    hinge: "left",
    open: "false",
  },
});
door.position = new Vector3(8, 2, 2);
scene.add(door);

// Front step: oak stair facing south
const step = new Block("minecraft:oak_stairs", {
  catalog,
  properties: stairProperties({ facing: "south" }),
});
step.position = new Vector3(8, 1, 1);
scene.add(step);

// Export structure JSON for the legacy viewer
const structure = scene.toStructure({ padding: 0 });
const outputPath = path.join(__dirname, "house_scene.json");

writeFileSync(outputPath, JSON.stringify(structure, null, 2));
console.log(`Wrote house scene to ${outputPath}`);

