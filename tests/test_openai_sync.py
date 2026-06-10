import httpx
from openai import OpenAI

def test():
    print("Initializing sync client with HTTP/2 disabled...")
    # Disable HTTP/2 explicitly to prevent connection deadlocks in httpx/macOS
    http_client = httpx.Client(
        http1=True,
        http2=False
    )
    client = OpenAI(
        api_key="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",
        base_url="https://api.groq.com/openai/v1",
        http_client=http_client
    )
    print("Sending request...")
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "hello"}],
            timeout=10.0
        )
        print("Response received:")
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    test()
