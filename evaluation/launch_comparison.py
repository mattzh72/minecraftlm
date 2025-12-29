#!/usr/bin/env python3
"""
LLM Model Comparison
Compare multiple LLM models on Minecraft build prompts.

Usage:
    python launch_comparison.py
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import aiohttp

# Configuration
BASE_URL = "http://localhost:8000/api"
RESULTS_DIR = Path("comparison_results")
THINKING_LEVEL = "med"

# Test prompts with detailed descriptions
COMPARISON_PROMPTS = [
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


class ModelComparison:
    def __init__(self):
        self.results_dir = RESULTS_DIR
        self.results_dir.mkdir(exist_ok=True)

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

            # Wait for completion
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

            return {
                "model": model,
                "model_display_name": MODEL_DISPLAY_NAMES.get(model, model),
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
                "model_display_name": MODEL_DISPLAY_NAMES.get(model, model),
                "prompt_name": prompt_name,
                "session_id": session_id,
                "status": "error",
                "error": str(e),
                "duration_seconds": duration,
                "timestamp": datetime.now().isoformat()
            }

    async def run_comparison(self):
        """Run the model comparison."""
        print("🚀 Starting LLM Model Comparison")
        print("=" * 60)
        print(f"📝 Testing {len(MODELS_TO_TEST)} models on {len(COMPARISON_PROMPTS)} prompts")
        print(f"🧠 Using thinking level: {THINKING_LEVEL}")
        print(f"⚡ Running all {len(MODELS_TO_TEST) * len(COMPARISON_PROMPTS)} builds in parallel")
        print("=" * 60)

        print("\n🎯 Prompts:")
        for prompt_data in COMPARISON_PROMPTS:
            print(f"  • {prompt_data['name']}")

        async with aiohttp.ClientSession() as session:
            print(f"\n🚀 Launching all builds in parallel...")

            # Create all tasks
            all_tasks = []
            task_info = []

            for prompt_data in COMPARISON_PROMPTS:
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

            # Wait for all tasks
            all_results = await asyncio.gather(*all_tasks, return_exceptions=True)

            # Process results
            final_results = []
            completed_count = 0

            for i, result in enumerate(all_results):
                task_desc = f"{task_info[i]['model']} × {task_info[i]['prompt']}"

                if isinstance(result, Exception):
                    print(f"  ❌ Failed: {task_desc} - {result}")
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

            print(f"\n🎉 Complete! {completed_count}/{len(all_tasks)} builds successful")

        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_summary = {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "thinking_level": THINKING_LEVEL,
                "total_tests": len(final_results),
                "successful_tests": completed_count,
                "models_tested": MODELS_TO_TEST,
                "prompts_tested": [p["name"] for p in COMPARISON_PROMPTS],
            },
            "results": final_results
        }

        results_file = self.results_dir / f"comparison_{timestamp}.json"
        with open(results_file, 'w') as f:
            json.dump(results_summary, f, indent=2)

        print(f"\n📊 Results saved: {results_file}")

        # Print summary
        self.print_summary(final_results)

        return final_results

    def print_summary(self, results: List[dict]):
        """Print final summary."""
        print("\n" + "=" * 60)
        print("📊 SUMMARY")
        print("=" * 60)

        for model in MODELS_TO_TEST:
            model_results = [r for r in results if r.get("model") == model]
            completed = [r for r in model_results if r.get("status") == "completed"]

            print(f"\n🤖 {MODEL_DISPLAY_NAMES.get(model, model)}:")
            print(f"  ✅ Success rate: {len(completed)}/{len(model_results)}")

            if completed:
                avg_duration = sum(r["duration_seconds"] for r in completed) / len(completed)
                total_blocks = sum(r.get("block_count", 0) for r in completed)
                print(f"  ⏱️  Average time: {avg_duration:.1f}s")
                print(f"  🏗️  Total blocks: {total_blocks:,}")

        # List session IDs for screenshot generation
        print("\n" + "=" * 60)
        print("📸 Session IDs for screenshot generation:")
        print("=" * 60)
        for result in results:
            if result.get("status") == "completed" and result.get("session_id"):
                print(f"  {result['model_display_name']} - {result['prompt_name']}: {result['session_id']}")


async def main():
    """Main execution function."""
    comparison = ModelComparison()
    await comparison.run_comparison()


if __name__ == "__main__":
    print("🎮 LLM Model Comparison")
    print("Generating Minecraft structures with multiple models...")
    asyncio.run(main())
