#!/usr/bin/env python3
"""
LLM Comparison for Twitter
Simple interface to compare models on viral-worthy prompts and generate Twitter-ready grids.

Usage:
    python compare_models.py
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
import os
import sys
from typing import Dict, List

import aiohttp
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont

# Configuration
BASE_URL = "http://localhost:8000/api"
FRONTEND_URL = "http://localhost:5175"
RESULTS_DIR = Path("twitter_comparison_results")
THINKING_LEVEL = "med"

# Enhanced viral prompts with detailed, grand descriptions
VIRAL_PROMPTS = [
    {
        "name": "cyberpunk_tokyo",
        "prompt": "Build a massive, highly detailed cyberpunk Tokyo street scene with towering neon-lit skyscrapers, holographic billboards, flying cars weaving between buildings, elevated highways, detailed street vendors, and atmospheric lighting. Make it really grand and intricate with lots of architectural details."
    },
    {
        "name": "space_station",
        "prompt": "Construct an enormous, highly detailed space station complex with multiple rotating sections, massive solar panel arrays, detailed docking bays with ships, observation decks, communication arrays, and intricate structural details. Make it really grand and impressive with lots of technical details."
    },
    {
        "name": "dragon_lair",
        "prompt": "Create a massive, highly detailed ancient dragon's lair deep inside a volcanic mountain with vast treasure chambers filled with gold, intricate cave systems, lava flows, detailed stalactites and stalagmites, ancient ruins, and dramatic lighting. Make it really grand and atmospheric with lots of environmental details."
    },
    {
        "name": "pirate_ship_storm",
        "prompt": "Build a large, highly detailed pirate ship sailing through a dramatic storm with massive waves, detailed rigging and sails, cannon ports, crow's nest, dramatic lightning effects, churning water, and atmospheric storm clouds. Make it really grand and dynamic with lots of nautical details."
    }
]

# Available models
MODELS_TO_TEST = [
    "claude-opus-4-5-20251101",
    "gpt-5.2",
    "gemini/gemini-3-pro-preview",
    "gemini/gemini-3-flash-preview"
]

MODEL_DISPLAY_NAMES = {
    "claude-opus-4-5-20251101": "Claude Opus 4.5",
    "gpt-5.2": "GPT-5.2",
    "gemini/gemini-3-pro-preview": "Gemini 3 Pro",
    "gemini/gemini-3-flash-preview": "Gemini 3 Flash"
}

class TwitterComparison:
    def __init__(self):
        self.results_dir = RESULTS_DIR
        self.results_dir.mkdir(exist_ok=True)
        self.screenshots_dir = self.results_dir / "individual_screenshots"
        self.screenshots_dir.mkdir(exist_ok=True)

    async def test_model_on_prompt(self, session, model: str, prompt_data: dict) -> dict:
        """Test a single model on a single prompt."""
        prompt_name = prompt_data["name"]
        print(f"🎮 Testing {MODEL_DISPLAY_NAMES.get(model, model)} on '{prompt_name}'...")

        start_time = time.time()
        session_id = None

        try:
            # Create session
            async with session.post(f"{BASE_URL}/sessions") as response:
                if response.status != 200:
                    raise Exception(f"Session creation failed: {response.status}")
                data = await response.json()
                session_id = data["session_id"]

            # Send message
            payload = {
                "session_id": session_id,
                "message": prompt_data["prompt"],
                "model": model,
                "thinking_level": THINKING_LEVEL
            }

            async with session.post(f"{BASE_URL}/chat", json=payload) as response:
                if response.status != 200:
                    raise Exception(f"Message send failed: {response.status}")

            # Wait for completion with robust error handling
            timeout = 600  # 10 minutes per build
            while time.time() - start_time < timeout:
                try:
                    async with session.get(f"{BASE_URL}/sessions/{session_id}") as response:
                        if response.status == 200:
                            data = await response.json()
                            status = data.get("task_status")

                            if status == "completed":
                                print(f"  ✅ Completed in {time.time() - start_time:.1f}s")
                                break
                            elif status == "error":
                                raise Exception(f"Task failed: {data.get('error', 'Unknown error')}")
                            else:
                                print(f"  ⏳ {status}...")
                        else:
                            print(f"  ⚠️  Status check returned {response.status}, retrying...")

                except Exception as e:
                    print(f"  ⚠️  Error checking status: {e}, retrying...")

                await asyncio.sleep(5)
            else:
                raise Exception("Task timed out")

            # Get structure data
            structure_data = None
            try:
                async with session.get(f"{BASE_URL}/sessions/{session_id}/structure") as response:
                    if response.status == 200:
                        structure_data = await response.json()
                        block_count = len(structure_data.get('blocks', []))
                        print(f"  🏗️  Generated {block_count} blocks")
                    else:
                        print(f"  ⚠️  No structure available")
            except Exception as e:
                print(f"  ⚠️  Structure error: {e}")

            duration = time.time() - start_time

            # Stage 1: Just generate structures (no screenshots)
            # Screenshots will be captured separately for better quality

            return {
                "model": model,
                "prompt_name": prompt_name,
                "prompt_text": prompt_data["prompt"],
                "session_id": session_id,
                "status": "completed",
                "duration_seconds": duration,
                "has_structure": structure_data is not None,
                "block_count": len(structure_data.get('blocks', [])) if structure_data else 0,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            duration = time.time() - start_time
            print(f"  ❌ Error: {e}")
            return {
                "model": model,
                "prompt_name": prompt_name,
                "session_id": session_id,
                "status": "error",
                "error": str(e),
                "duration_seconds": duration,
                "timestamp": datetime.now().isoformat()
            }

    async def capture_screenshots_multiple_angles(self, session_id: str, model: str, prompt_name: str) -> list:
        """Capture multiple screenshots from different angles for better coverage."""
        screenshot_paths = []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080}
                )
                page = await context.new_page()

                # Navigate to session
                session_url = f"{FRONTEND_URL}/session/{session_id}"
                await page.goto(session_url)

                # Wait for 3D viewer to load
                await page.wait_for_selector('canvas', timeout=30000)
                await page.wait_for_load_state('networkidle')

                # Give extra time for 3D scene to fully render
                await asyncio.sleep(8)

                # Focus on canvas and position for best view
                await page.click('canvas')
                await asyncio.sleep(1)

                # Define comprehensive camera positions for maximum coverage
                angles = [
                    {"name": "front", "description": "Front view", "moves": []},
                    {"name": "front_angle", "description": "Front angled view", "moves": [("ArrowRight", 2)]},
                    {"name": "right", "description": "Right side view", "moves": [("ArrowRight", 6)]},
                    {"name": "right_angle", "description": "Right angled view", "moves": [("ArrowRight", 4)]},
                    {"name": "back", "description": "Back view", "moves": [("ArrowRight", 12)]},
                    {"name": "back_angle", "description": "Back angled view", "moves": [("ArrowRight", 10)]},
                    {"name": "left", "description": "Left side view", "moves": [("ArrowLeft", 6)]},
                    {"name": "left_angle", "description": "Left angled view", "moves": [("ArrowLeft", 4)]},
                    {"name": "top", "description": "Top-down view", "moves": [("ArrowUp", 8), ("KeyS", 3)]},
                    {"name": "top_angle", "description": "Top angled view", "moves": [("ArrowUp", 5), ("ArrowRight", 3), ("KeyS", 5)]},
                    {"name": "elevated", "description": "Elevated perspective", "moves": [("ArrowRight", 3), ("ArrowUp", 3), ("KeyS", 7)]},
                    {"name": "wide", "description": "Wide overview", "moves": [("KeyS", 10), ("ArrowRight", 2)]}
                ]

                for i, angle in enumerate(angles):
                    print(f"  📸 Capturing {angle['description']}...")

                    # Reset to base position if not first angle
                    if i > 0:
                        # Reset by reloading the page (most reliable reset)
                        await page.reload()
                        await page.wait_for_selector('canvas', timeout=30000)
                        await page.wait_for_load_state('networkidle')
                        await asyncio.sleep(5)
                        await page.click('canvas')
                        await asyncio.sleep(1)

                    # Apply camera movements for this angle
                    for key, count in angle["moves"]:
                        for _ in range(count):
                            await page.keyboard.press(key)
                            await asyncio.sleep(0.1)

                    await asyncio.sleep(2)  # Stabilize

                    # Capture screenshot for this angle
                    screenshot_name = f"{model.replace('/', '_')}_{prompt_name}_{angle['name']}.png"
                    screenshot_path = self.screenshots_dir / screenshot_name
                    await page.screenshot(path=screenshot_path)
                    screenshot_paths.append(screenshot_path)

                    print(f"  ✅ {angle['description']} saved: {screenshot_name}")

                await browser.close()
                return screenshot_paths

        except Exception as e:
            print(f"  ⚠️  Multiple screenshots failed: {e}")
            return []

    async def capture_screenshot(self, session_id: str, model: str, prompt_name: str) -> Path:
        """Capture screenshots of the build from multiple angles. Returns primary screenshot path."""
        screenshot_paths = await self.capture_screenshots_multiple_angles(session_id, model, prompt_name)

        # Return the first (front) screenshot as the primary one for compatibility
        if screenshot_paths:
            return screenshot_paths[0]
        return None

    def create_twitter_grid(self, results: List[dict]) -> Path:
        """Create a 4x4 grid comparison image perfect for Twitter."""
        print("\n🎨 Creating Twitter comparison grid...")

        # Filter successful results (screenshots will be generated separately)
        successful_results = [r for r in results if r["status"] == "completed"]

        if not successful_results:
            print("❌ No successful results to create grid")
            return None

        # Organize results by prompt and model
        results_matrix = {}
        for result in successful_results:
            prompt = result["prompt_name"]
            model = result["model"]
            if prompt not in results_matrix:
                results_matrix[prompt] = {}
            results_matrix[prompt][model] = result

        # Grid settings
        cell_width = 400
        cell_height = 300
        label_height = 60
        margin = 10

        # Calculate grid dimensions
        prompts = list(results_matrix.keys())
        models = MODELS_TO_TEST

        grid_width = len(models) * cell_width + (len(models) + 1) * margin
        grid_height = len(prompts) * (cell_height + label_height) + (len(prompts) + 1) * margin + 80  # Extra for title

        # Create blank canvas
        grid_image = Image.new('RGB', (grid_width, grid_height), color='white')
        draw = ImageDraw.Draw(grid_image)

        # Load font (fallback to default if custom font not available)
        try:
            title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
            label_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
            small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
        except:
            title_font = ImageFont.load_default()
            label_font = ImageFont.load_default()
            small_font = ImageFont.load_default()

        # Add title
        title = "LLM Minecraft Build Comparison"
        title_bbox = draw.textbbox((0, 0), title, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        draw.text(((grid_width - title_width) // 2, 20), title, fill='black', font=title_font)

        # Add model headers
        for i, model in enumerate(models):
            x = margin + i * (cell_width + margin) + cell_width // 2
            model_name = MODEL_DISPLAY_NAMES.get(model, model)
            model_bbox = draw.textbbox((0, 0), model_name, font=label_font)
            model_width = model_bbox[2] - model_bbox[0]
            draw.text((x - model_width // 2, 70), model_name, fill='black', font=label_font)

        # Add images and prompt labels
        for row, prompt in enumerate(prompts):
            y_base = 120 + row * (cell_height + label_height + margin)

            # Add prompt label
            prompt_display = prompt.replace('_', ' ').title()
            draw.text((margin, y_base), prompt_display, fill='black', font=label_font)

            # Add model screenshots
            for col, model in enumerate(models):
                x = margin + col * (cell_width + margin)
                y = y_base + 40

                if model in results_matrix.get(prompt, {}):
                    result = results_matrix[prompt][model]
                    screenshot_path = Path(result["screenshot_path"])

                    if screenshot_path.exists():
                        # Load and resize screenshot
                        screenshot = Image.open(screenshot_path)
                        screenshot = screenshot.resize((cell_width, cell_height), Image.LANCZOS)
                        grid_image.paste(screenshot, (x, y))

                        # Add build info
                        block_count = result.get("block_count", 0)
                        duration = result.get("duration_seconds", 0)
                        screenshot_count = result.get("screenshot_count", 1)

                        if screenshot_count > 1:
                            info_text = f"{block_count} blocks • {duration:.0f}s • {screenshot_count} angles"
                        else:
                            info_text = f"{block_count} blocks • {duration:.0f}s"
                        draw.text((x + 5, y + cell_height + 5), info_text, fill='gray', font=small_font)
                    else:
                        # Draw placeholder for missing screenshot
                        draw.rectangle([x, y, x + cell_width, y + cell_height], fill='lightgray', outline='gray')
                        draw.text((x + cell_width // 2 - 40, y + cell_height // 2), "No Image", fill='gray', font=label_font)
                else:
                    # Draw placeholder for failed build
                    draw.rectangle([x, y, x + cell_width, y + cell_height], fill='lightcoral', outline='red')
                    draw.text((x + cell_width // 2 - 30, y + cell_height // 2), "Failed", fill='darkred', font=label_font)

        # Save grid
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        grid_path = self.results_dir / f"twitter_comparison_grid_{timestamp}.png"
        grid_image.save(grid_path, quality=95)

        print(f"🎉 Twitter grid saved: {grid_path}")
        return grid_path

    async def run_comparison(self):
        """Run the complete viral comparison."""
        print("🚀 Starting Viral LLM Comparison for Twitter")
        print("=" * 60)
        print(f"📝 Testing {len(MODELS_TO_TEST)} models on {len(VIRAL_PROMPTS)} viral prompts")
        print(f"🧠 Using thinking level: {THINKING_LEVEL}")
        print(f"⚡ NEW: Full parallelization - ALL {len(MODELS_TO_TEST) * len(VIRAL_PROMPTS)} builds run simultaneously!")
        print(f"⏰ Estimated time: ~5-8 minutes (down from 20+ minutes!)")
        print("=" * 60)

        print("\n🎯 Viral Prompts Selected:")
        for prompt_data in VIRAL_PROMPTS:
            print(f"  • {prompt_data['name']}: {prompt_data['prompt']}")

        async with aiohttp.ClientSession() as session:
            print(f"\n🚀 Launching ALL {len(MODELS_TO_TEST) * len(VIRAL_PROMPTS)} model/prompt combinations in parallel...")

            # Create ALL tasks at once - true parallelization!
            all_tasks = []
            task_info = []

            for prompt_data in VIRAL_PROMPTS:
                for model in MODELS_TO_TEST:
                    task = asyncio.create_task(
                        self.test_model_on_prompt(session, model, prompt_data)
                    )
                    all_tasks.append(task)
                    task_info.append({
                        'prompt': prompt_data['name'],
                        'model': MODEL_DISPLAY_NAMES.get(model, model)
                    })
                    print(f"  📤 {MODEL_DISPLAY_NAMES.get(model, model)} × {prompt_data['name']}")

            print(f"\n⏳ Waiting for all {len(all_tasks)} builds to complete...")
            print("   (This is where the magic happens - everything runs simultaneously!)")

            # Wait for ALL tasks to complete - true parallelization!
            all_results = await asyncio.gather(*all_tasks, return_exceptions=True)

            # Process results and show completion status
            final_results = []
            completed_count = 0

            for i, result in enumerate(all_results):
                task_desc = f"{task_info[i]['model']} × {task_info[i]['prompt']}"

                if isinstance(result, Exception):
                    print(f"  ❌ Failed: {task_desc} - {result}")
                    # Create error result
                    error_result = {
                        "model": task_info[i]['model'],
                        "prompt_name": task_info[i]['prompt'],
                        "status": "error",
                        "error": str(result)
                    }
                    final_results.append(error_result)
                else:
                    print(f"  ✅ Success: {task_desc} - {result.get('duration_seconds', 0):.1f}s")
                    final_results.append(result)
                    completed_count += 1

            all_results = final_results
            print(f"\n🎉 Parallel execution complete! {completed_count}/{len(all_tasks)} builds successful")

        # Save detailed results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_summary = {
            "test_metadata": {
                "timestamp": datetime.now().isoformat(),
                "thinking_level": THINKING_LEVEL,
                "total_tests": len(all_results),
                "models_tested": MODELS_TO_TEST,
                "prompts_tested": [p["name"] for p in VIRAL_PROMPTS],
                "viral_prompts": VIRAL_PROMPTS
            },
            "results": all_results
        }

        results_file = self.results_dir / f"comparison_results_{timestamp}.json"
        with open(results_file, 'w') as f:
            json.dump(results_summary, f, indent=2)

        # Create Twitter grid
        grid_path = self.create_twitter_grid(all_results)

        # Print summary
        self.print_summary(all_results, grid_path)

    def print_summary(self, results: List[dict], grid_path: Path):
        """Print final summary."""
        print("\n" + "=" * 60)
        print("🎉 VIRAL COMPARISON COMPLETE!")
        print("=" * 60)

        # Results by model
        for model in MODELS_TO_TEST:
            model_results = [r for r in results if r["model"] == model]
            completed = [r for r in model_results if r["status"] == "completed"]

            print(f"\n🤖 {MODEL_DISPLAY_NAMES.get(model, model)}:")
            print(f"  ✅ Success rate: {len(completed)}/{len(model_results)}")

            if completed:
                avg_duration = sum(r["duration_seconds"] for r in completed) / len(completed)
                total_blocks = sum(r.get("block_count", 0) for r in completed)
                print(f"  ⏱️  Average time: {avg_duration:.1f}s")
                print(f"  🏗️  Total blocks: {total_blocks:,}")

        if grid_path:
            print(f"\n📸 Twitter-ready grid: {grid_path}")
            print(f"📁 Individual screenshots (multiple angles): {self.screenshots_dir}")
            print(f"📊 Detailed results: {self.results_dir}")

            print("\n🎨 Comprehensive Camera Coverage:")
            print("Each successful build now has 12 professional angles:")
            print("• Front, Front-angled, Right, Right-angled")
            print("• Back, Back-angled, Left, Left-angled")
            print("• Top, Top-angled, Elevated, Wide overview")

            print("\n🐦 Ready for Twitter!")
            print("Upload the grid image and share your LLM comparison!")

def compare_models(*prompts):
    """Simple interface function - for future custom prompts."""
    if prompts:
        print(f"🎨 Custom prompts not yet supported, using viral prompt set")

    comparison = TwitterComparison()
    asyncio.run(comparison.run_comparison())

async def main():
    """Main execution function."""
    comparison = TwitterComparison()
    await comparison.run_comparison()

if __name__ == "__main__":
    print("🎮 LLM Comparison for Twitter")
    print("Creating viral content with fresh prompts...")
    asyncio.run(main())