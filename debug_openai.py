
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

api_key = os.getenv("OPENAI_API_KEY")
print(f"Key loaded: {api_key[:5]}...{api_key[-5:] if api_key else 'None'}")

client = OpenAI(api_key=api_key)

try:
    print("Sending test request...")
    resp = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "say hi"}],
        max_tokens=5
    )
    print("Response:", resp.choices[0].message.content)
except Exception as e:
    print("Error:", e)
