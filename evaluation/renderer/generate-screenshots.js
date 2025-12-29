#!/usr/bin/env node

import { HeadlessRenderer } from './src/HeadlessRenderer.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate screenshots for Minecraft structures using HeadlessRenderer
 */
class ScreenshotGenerator {
  constructor(width = 3840, height = 2160, options = {}) {
    this.renderer = new HeadlessRenderer(width, height, options);
  }

  /**
   * Load structure data from a session directory
   */
  async loadSessionData(sessionDir) {
    const structureFile = path.join(sessionDir, 'code.json');
    const content = await fs.readFile(structureFile, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Load metadata from a session directory
   */
  async loadMetadata(sessionDir) {
    try {
      const metadataFile = path.join(sessionDir, 'metadata.json');
      const content = await fs.readFile(metadataFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return { model: 'unknown' };
    }
  }

  /**
   * Generate screenshot for a session directory
   */
  async generateForSession(sessionDir, options = {}) {
    const { angle = 'overview', outputDir = './output' } = options;

    console.log(`\n🎮 Processing: ${sessionDir}`);

    const structureData = await this.loadSessionData(sessionDir);
    const metadata = await this.loadMetadata(sessionDir);
    const buffer = await this.renderer.generateScreenshot(structureData, { angle });

    // Create filename from metadata
    const modelName = this.cleanName(metadata.model || 'unknown');
    const sessionName = path.basename(sessionDir).substring(0, 8);

    await fs.mkdir(outputDir, { recursive: true });
    const filename = `${modelName}_${sessionName}_${angle}.png`;
    const outputPath = path.join(outputDir, filename);

    await fs.writeFile(outputPath, buffer);
    console.log(`✅ Saved: ${outputPath} (${Math.round(buffer.length / 1024)}KB)`);

    return outputPath;
  }

  /**
   * Generate screenshots from a comparison results JSON file
   */
  async generateFromResults(resultsFile, storageDir, options = {}) {
    const { angle = 'overview', outputDir = './output' } = options;

    console.log(`📂 Loading results from: ${resultsFile}`);
    const content = await fs.readFile(resultsFile, 'utf8');
    const data = JSON.parse(content);

    const results = data.results || data;
    const sessions = results.filter(r => r.status === 'completed' && r.session_id);

    console.log(`🎯 Found ${sessions.length} completed sessions`);

    await fs.mkdir(outputDir, { recursive: true });

    let successCount = 0;
    let errorCount = 0;

    for (const session of sessions) {
      try {
        const sessionDir = path.join(storageDir, session.session_id);
        const structureData = await this.loadSessionData(sessionDir);
        const buffer = await this.renderer.generateScreenshot(structureData, { angle });

        const modelName = this.cleanName(session.model_display_name || session.model || 'unknown');
        const promptName = session.prompt_name || 'unknown';
        const filename = `${modelName}_${promptName}_${angle}.png`;
        const outputPath = path.join(outputDir, filename);

        await fs.writeFile(outputPath, buffer);
        console.log(`✅ ${modelName} - ${promptName}: ${Math.round(buffer.length / 1024)}KB`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${session.model_display_name} - ${session.prompt_name}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n🎉 Complete! ${successCount} succeeded, ${errorCount} failed`);
    return { successCount, errorCount };
  }

  cleanName(name) {
    return name
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/-/g, '_')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Usage:
  node generate-screenshots.js --session <dir>                    Generate for a session directory
  node generate-screenshots.js --results <file> --storage <dir>   Generate from comparison results

Options:
  --angle <name>      Camera angle: overview, isometric, high, low, side (default: overview)
  --output <dir>      Output directory (default: ./output)
  --width <px>        Width in pixels (default: 3840)
  --height <px>       Height in pixels (default: 2160)

Examples:
  node generate-screenshots.js --session ./.storage/sessions/abc123
  node generate-screenshots.js --results ./comparison.json --storage ./.storage/sessions
`);
  process.exit(0);
}

function getArg(name, defaultValue = null) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

async function main() {
  const angle = getArg('--angle', 'overview');
  const outputDir = getArg('--output', './output');
  const width = parseInt(getArg('--width', '3840'));
  const height = parseInt(getArg('--height', '2160'));

  const generator = new ScreenshotGenerator(width, height, { timePreset: 'sunset' });

  const sessionDir = getArg('--session');
  const resultsFile = getArg('--results');
  const storageDir = getArg('--storage');

  if (sessionDir) {
    await generator.generateForSession(sessionDir, { angle, outputDir });
  } else if (resultsFile && storageDir) {
    await generator.generateFromResults(resultsFile, storageDir, { angle, outputDir });
  } else {
    console.error('Error: Provide --session <dir> or both --results <file> and --storage <dir>');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
