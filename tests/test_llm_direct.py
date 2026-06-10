import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from core.config import settings
from core.llm import LLMFactory

async def main():
    print("Testing LLMFactory directly...")
    print(f"Provider: {settings.llm_provider.value}")
    print(f"Model: {settings.active_llm_model}")
    print(f"Has Key: {bool(settings.active_llm_key)}")
    
    try:
        print("Obtaining client...")
        client = LLMFactory.get_client()
        print("Client obtained successfully.")
        
        print("Generating completion (timeout 15s)...")
        resp = await asyncio.wait_for(
            client.generate(
                messages=[{"role": "user", "content": "Say hello in 3 words."}],
                temperature=0.1,
                max_tokens=20,
            ),
            timeout=15.0
        )
        print("Response received:")
        print(resp)
    except asyncio.TimeoutError:
        print("LLM call timed out!")
    except Exception as e:
        print(f"Exception raised: {e}")

if __name__ == "__main__":
    asyncio.run(main())
