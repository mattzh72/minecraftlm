#!/usr/bin/env node

import { HeadlessRenderer } from './src/HeadlessRenderer.js';
import fs from 'fs/promises';
import path from 'path';

// Y-axis rotations (yaw values) - keeping pitch=0.25, distance=1.0 from hero preset
const YAW_ANGLES = [
  { name: 'front', yaw: 0.0 },
  { name: 'right', yaw: 1.0 },
  { name: 'back', yaw: 3.14 },
  { name: 'left', yaw: -1.0 },
];

function cleanName(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function getArg(name, defaultValue = null) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

async function main() {
  const resultsFile = getArg('--results');
  const storageDir = getArg('--storage');
  const outputDir = getArg('--output', './output');
  const width = parseInt(getArg('--width', '3840'));
  const height = parseInt(getArg('--height', '2160'));

  if (!resultsFile || !storageDir) {
    console.log(`
Usage:
  node generate-multi-angle.js --results <file> --storage <dir> [options]

Options:
  --output <dir>   Output directory (default: ./output)
  --width <px>     Width in pixels (default: 3840)
  --height <px>    Height in pixels (default: 2160)

Generates front, right, back, left angles for each session in the results file.
`);
    process.exit(1);
  }

  console.log('🎬 Multi-angle screenshot generator');

  const content = await fs.readFile(resultsFile, 'utf8');
  const data = JSON.parse(content);
  const sessions = data.results.filter(r => r.status === 'completed' && r.session_id);

  console.log(`📂 Found ${sessions.length} sessions`);
  console.log(`🔄 Generating ${YAW_ANGLES.length} angles per session = ${sessions.length * YAW_ANGLES.length} total`);

  const renderer = new HeadlessRenderer(width, height, { timePreset: 'sunset' });
  await fs.mkdir(outputDir, { recursive: true });

  for (const session of sessions) {
    const sessionDir = path.join(storageDir, session.session_id);
    const structureFile = path.join(sessionDir, 'code.json');

    console.log(`\n🎮 ${session.model_display_name} - ${session.prompt_name}`);

    try {
      const structureData = JSON.parse(await fs.readFile(structureFile, 'utf8'));

      for (const angleConfig of YAW_ANGLES) {
        const modelName = cleanName(session.model_display_name || session.model);
        const filename = `${modelName}_${session.prompt_name}_${angleConfig.name}.png`;
        const outputPath = path.join(outputDir, filename);

        const buffer = await renderer.generateScreenshot(structureData, {
          angle: { pitch: 0.25, yaw: angleConfig.yaw, distance: 1.0 }
        });

        await fs.writeFile(outputPath, buffer);
        console.log(`  ✅ ${angleConfig.name}: ${Math.round(buffer.length / 1024)}KB`);
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n🎉 Done!');
}

main().catch(console.error);
