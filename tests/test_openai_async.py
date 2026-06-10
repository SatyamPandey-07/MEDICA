import asyncio
from openai import AsyncOpenAI

async def test():
    print("Initializing client...")
    client = AsyncOpenAI(
        api_key="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",
        base_url="https://api.groq.com/openai/v1"
    )
    print("Sending request...")
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "hello"}],
            timeout=10.0
        )
        print("Response received:")
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(test())
