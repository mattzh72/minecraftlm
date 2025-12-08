"""
Comprehensive test: OpenAI SDK vs LiteLLM SDK through Arcpoint
"""

import os
import asyncio
import json

ARCPOINT_API_KEY = os.environ.get("ARCPOINT_API_KEY")
ARCPOINT_BASE = "https://vector.arcpoint.ai/v1"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather in a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"},
                },
                "required": ["location"],
            },
        },
    }
]

MODELS_TO_TEST = [
    "openai/gpt-5.1",
    "anthropic/claude-4.5-sonnet",
    "google/gemini-2.5-pro",
]


def test_openai_sdk():
    """Test using OpenAI SDK directly"""
    from openai import OpenAI

    client = OpenAI(
        base_url=ARCPOINT_BASE,
        api_key=ARCPOINT_API_KEY,
    )

    print("=" * 60)
    print("OpenAI SDK → Arcpoint")
    print("=" * 60)

    # Test 1: Basic completions across providers
    print("\n--- Basic Completions ---")
    for model in MODELS_TO_TEST:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Say 'Hello' in one word."}],
                max_tokens=10,
            )
            print(f"  ✓ [{model}] {response.choices[0].message.content}")
        except Exception as e:
            print(f"  ✗ [{model}] {str(e)[:80]}")

    # Test 2: Tool calling
    print("\n--- Tool Calling ---")
    for model in MODELS_TO_TEST:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=100,
            )
            msg = response.choices[0].message
            if msg.tool_calls:
                tc = msg.tool_calls[0]
                print(f"  ✓ [{model}] {tc.function.name}({tc.function.arguments})")
            else:
                print(f"  ? [{model}] No tool call, got: {msg.content[:50] if msg.content else 'empty'}")
        except Exception as e:
            print(f"  ✗ [{model}] {str(e)[:80]}")

    # Test 3: Streaming
    print("\n--- Streaming ---")
    for model in MODELS_TO_TEST:
        try:
            stream = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Count 1 to 3, comma separated."}],
                max_tokens=20,
                stream=True,
            )
            result = ""
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    result += chunk.choices[0].delta.content
            print(f"  ✓ [{model}] {result.strip()[:50]}")
        except Exception as e:
            print(f"  ✗ [{model}] {str(e)[:80]}")


async def test_litellm_sdk():
    """Test using LiteLLM SDK"""
    import litellm

    print("\n" + "=" * 60)
    print("LiteLLM SDK → Arcpoint")
    print("=" * 60)

    # For LiteLLM, we need to prefix with openai/ to use custom api_base
    def litellm_model(arcpoint_model):
        return f"openai/{arcpoint_model}"

    # Test 1: Basic completions across providers
    print("\n--- Basic Completions ---")
    for model in MODELS_TO_TEST:
        try:
            response = await litellm.acompletion(
                model=litellm_model(model),
                api_base=ARCPOINT_BASE,
                api_key=ARCPOINT_API_KEY,
                messages=[{"role": "user", "content": "Say 'Hello' in one word."}],
                max_tokens=10,
            )
            print(f"  ✓ [{model}] {response.choices[0].message.content}")
        except Exception as e:
            print(f"  ✗ [{model}] {str(e)[:80]}")

    # Test 2: Tool calling
    print("\n--- Tool Calling ---")
    for model in MODELS_TO_TEST:
        try:
            response = await litellm.acompletion(
                model=litellm_model(model),
                api_base=ARCPOINT_BASE,
                api_key=ARCPOINT_API_KEY,
                messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=100,
            )
            msg = response.choices[0].message
            if msg.tool_calls:
                tc = msg.tool_calls[0]
                print(f"  ✓ [{model}] {tc.function.name}({tc.function.arguments})")
            else:
                print(f"  ? [{model}] No tool call, got: {msg.content[:50] if msg.content else 'empty'}")
        except Exception as e:
            print(f"  ✗ [{model}] {str(e)[:80]}")

    # Test 3: Streaming
    print("\n--- Streaming ---")
    for model in MODELS_TO_TEST:
        try:
            response = await litellm.acompletion(
                model=litellm_model(model),
                api_base=ARCPOINT_BASE,
                api_key=ARCPOINT_API_KEY,
                messages=[{"role": "user", "content": "Count 1 to 3, comma separated."}],
                max_tokens=20,
                stream=True,
            )
            result = ""
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    result += chunk.choices[0].delta.content
            print(f"  ✓ [{model}] {result.strip()[:50]}")
        except Exception as e:
            print(f"  ✗ [{model}] {str(e)[:80]}")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Arcpoint Integration: OpenAI SDK vs LiteLLM SDK")
    print("=" * 60)

    # Run OpenAI SDK tests
    test_openai_sdk()

    # Run LiteLLM SDK tests
    asyncio.run(test_litellm_sdk())

    print("\n" + "=" * 60)
    print("All Tests Complete")
    print("=" * 60)
