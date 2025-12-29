# Headless Minecraft Structure Renderer

Generates high-quality screenshots of Minecraft structures without a browser using native WebGL.

## Requirements

- **Node.js 20.x** (headless-gl is compiled against Node 20)
- macOS or Linux (headless-gl native bindings)

## Setup

```bash
# Switch to Node 20 (if using nvm)
nvm use 20

# Install dependencies (may need Python 3 for native module compilation)
npm install

# If install fails with Python errors, specify Python 3 explicitly:
PYTHON=/opt/homebrew/bin/python3 npm install

# If gl module fails after Node version switch, rebuild it:
npm rebuild gl
```

## Usage

### CLI Tool

```bash
# Generate screenshot for a single session directory
node generate-screenshots.js --session /path/to/.storage/sessions/abc123

# Generate screenshots from comparison results
node generate-screenshots.js --results ./comparison.json --storage /path/to/.storage/sessions

# Options
node generate-screenshots.js --session <dir> \
  --angle overview \      # overview, isometric, high, low, side
  --output ./output \     # output directory
  --width 3840 \          # width in pixels
  --height 2160           # height in pixels
```

### Programmatic API

```javascript
import { HeadlessRenderer } from './src/HeadlessRenderer.js';
import fs from 'fs/promises';

const renderer = new HeadlessRenderer(3840, 2160, { timePreset: 'sunset' });

// Load structure data yourself
const structureData = JSON.parse(await fs.readFile('code.json', 'utf8'));

// Generate screenshot
const buffer = await renderer.generateScreenshot(structureData, {
  angle: 'overview'  // or 'isometric', 'high', 'low', 'side'
});

await fs.writeFile('output.png', buffer);
```

## Options

### Resolution
```javascript
new HeadlessRenderer(width, height, options)

// Examples:
new HeadlessRenderer(1920, 1080)  // Full HD
new HeadlessRenderer(3840, 2160)  // 4K
```

### Time Presets
```javascript
{ timePreset: 'sunset' }  // Warm orange lighting (default)
{ timePreset: 'day' }     // Bright daylight
{ timePreset: 'night' }   // Dark blue lighting
```

### Camera Angles
```javascript
{ angle: 'overview' }   // Slightly above, good for most structures
{ angle: 'isometric' }  // Classic isometric view
{ angle: 'high' }       // Looking down from above
{ angle: 'low' }        // Low angle looking up
{ angle: 'side' }       // Side view
```

## Performance

- 1080p: ~200ms render time
- 4K: ~300ms render time

## Troubleshooting

### "NODE_MODULE_VERSION" error
You're using the wrong Node version. Switch to Node 20:
```bash
nvm use 20
```

### "headless-gl not available"
Rebuild the gl module:
```bash
npm rebuild gl
```

### Black or empty screenshots
Check that the session has structure data in `.storage/sessions/<id>/code.json`
