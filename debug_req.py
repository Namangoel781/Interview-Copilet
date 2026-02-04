
import requests
import json
import time

try:
    print("Sending request...")
    start = time.time()
    r = requests.post(
        "http://127.0.0.1:8000/simulator/generate",
        json={"topic": "Arrays", "difficulty": "Easy"},
        timeout=120
    )
    print(f"Time: {time.time() - start:.2f}s")
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text}")
except Exception as e:
    print(f"Error: {e}")
