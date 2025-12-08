"""
Demo: Using LiteLLM SDK to proxy through Arcpoint

This shows that LiteLLM can route requests through Arcpoint's gateway.
"""

import os
import asyncio
import litellm

ARCPOINT_API_KEY = os.environ.get("ARCPOINT_API_KEY")
ARCPOINT_BASE = "https://vector.arcpoint.ai/v1"


async def demo_litellm_via_arcpoint():
    """Demo basic completion via LiteLLM → Arcpoint"""

    print("=== LiteLLM → Arcpoint Demo ===\n")

    # Method 1: Using openai/ prefix with api_base
    print("1. OpenAI model via Arcpoint:")
    response = await litellm.acompletion(
        model="openai/gpt-4o-mini",
        api_base=ARCPOINT_BASE,
        api_key=ARCPOINT_API_KEY,
        messages=[{"role": "user", "content": "What is 2+2? Reply with just the number."}],
        max_tokens=10,
    )
    print(f"   Response: {response.choices[0].message.content}")

    # Method 2: Google model via Arcpoint
    print("\n2. Google model via Arcpoint:")
    response = await litellm.acompletion(
        model="openai/google/gemini-2.0-flash",
        api_base=ARCPOINT_BASE,
        api_key=ARCPOINT_API_KEY,
        messages=[{"role": "user", "content": "What is 3+3? Reply with just the number."}],
        max_tokens=10,
    )
    print(f"   Response: {response.choices[0].message.content}")

    # Method 3: Streaming
    print("\n3. Streaming via Arcpoint:")
    print("   Response: ", end="")
    response = await litellm.acompletion(
        model="openai/gpt-4o-mini",
        api_base=ARCPOINT_BASE,
        api_key=ARCPOINT_API_KEY,
        messages=[{"role": "user", "content": "Count from 1 to 5, separated by commas."}],
        max_tokens=20,
        stream=True,
    )
    async for chunk in response:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print()

    print("\n✓ LiteLLM successfully proxies through Arcpoint!")


if __name__ == "__main__":
    asyncio.run(demo_litellm_via_arcpoint())
