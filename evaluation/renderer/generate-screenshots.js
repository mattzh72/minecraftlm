#!/usr/bin/env node

import { HeadlessRenderer } from './src/HeadlessRenderer.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = '/Users/johnathanchiu/Projects/minecraftlm/.storage/sessions';

/**
 * Generate screenshots for Minecraft structures using HeadlessRenderer
 */
class ScreenshotGenerator {
  constructor(width = 3840, height = 2160, options = {}) {
    this.renderer = new HeadlessRenderer(width, height, options);
  }

  /**
   * Generate screenshot for a single session
   */
  async generateForSession(sessionId, options = {}) {
    const { angle = 'overview', outputDir = './output' } = options;

    console.log(`\n🎮 Processing session: ${sessionId}`);

    try {
      const buffer = await this.renderer.generateScreenshot(sessionId, { angle });

      // Get metadata for filename
      const metadata = await this.renderer.getSessionMetadata(sessionId);
      const modelName = this.cleanModelName(metadata.model || 'unknown');
      const sessionShort = sessionId.substring(0, 8);

      // Create output path
      await fs.mkdir(outputDir, { recursive: true });
      const filename = `${modelName}_${sessionShort}_${angle}.png`;
      const outputPath = path.join(outputDir, filename);

      await fs.writeFile(outputPath, buffer);
      console.log(`✅ Saved: ${outputPath} (${Math.round(buffer.length / 1024)}KB)`);

      return outputPath;
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate screenshots for multiple sessions from a results JSON file
   */
  async generateFromResults(resultsFile, options = {}) {
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
        const buffer = await this.renderer.generateScreenshot(session.session_id, { angle });

        const modelName = this.cleanModelName(session.model_display_name || session.model || 'unknown');
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

  /**
   * Find all sessions with structures
   */
  async findSessions() {
    const entries = await fs.readdir(STORAGE_DIR);
    const sessions = [];

    for (const entry of entries) {
      const codeFile = path.join(STORAGE_DIR, entry, 'code.json');
      try {
        await fs.access(codeFile);
        sessions.push(entry);
      } catch {
        // Skip sessions without code.json
      }
    }

    return sessions;
  }

  cleanModelName(name) {
    return name
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/-/g, '_')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage:
  node generate-screenshots.js <session-id>              Generate for single session
  node generate-screenshots.js --results <file.json>    Generate from comparison results
  node generate-screenshots.js --all                    Generate for all sessions

Options:
  --angle <name>      Camera angle: overview, isometric, high, low, side (default: overview)
  --output <dir>      Output directory (default: ./output)
  --width <px>        Width in pixels (default: 3840)
  --height <px>       Height in pixels (default: 2160)
`);
  process.exit(0);
}

async function main() {
  const angle = args.includes('--angle') ? args[args.indexOf('--angle') + 1] : 'overview';
  const outputDir = args.includes('--output') ? args[args.indexOf('--output') + 1] : './output';
  const width = args.includes('--width') ? parseInt(args[args.indexOf('--width') + 1]) : 3840;
  const height = args.includes('--height') ? parseInt(args[args.indexOf('--height') + 1]) : 2160;

  const generator = new ScreenshotGenerator(width, height, { timePreset: 'sunset' });

  if (args.includes('--results')) {
    const resultsFile = args[args.indexOf('--results') + 1];
    await generator.generateFromResults(resultsFile, { angle, outputDir });
  } else if (args.includes('--all')) {
    const sessions = await generator.findSessions();
    console.log(`Found ${sessions.length} sessions`);
    for (const sessionId of sessions) {
      await generator.generateForSession(sessionId, { angle, outputDir });
    }
  } else {
    // Single session ID
    const sessionId = args.find(a => !a.startsWith('--'));
    if (sessionId) {
      await generator.generateForSession(sessionId, { angle, outputDir });
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
