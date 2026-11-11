import os
import io
import json
import base64
import time
import httpx
from PIL import Image, ImageDraw, ImageFont
import dotenv

dotenv.load_dotenv('.env')
api_key = os.environ.get("GEMINI_API_KEY", "")

# Create a clean test image with unequal two columns
w, h = 650, 850
img = Image.new("RGB", (w, h), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

# Title
draw.text((40, 40), "Astrophysical Degeneracy in Compact Objects", fill=(20, 20, 20))
draw.line([(40, 70), (610, 70)], fill=(180, 180, 180), width=1)

# Narrow left column: x = 40 to 220 (width = 180 -> 27.7%)
draw.text((40, 100), "Column 1: Fundamentals", fill=(40, 40, 40))
draw.text((40, 130), "Degeneracy pressure", fill=(60, 60, 60))
draw.text((40, 150), "arises from Pauli", fill=(60, 60, 60))
draw.text((40, 170), "exclusion in compact", fill=(60, 60, 60))
draw.text((40, 190), "stellar remnants.", fill=(60, 60, 60))

# Wide right column: x = 270 to 610 (width = 340 -> 52.3%)
draw.text((270, 100), "Column 2: Relativistic Equations of State", fill=(40, 40, 40))
draw.text((270, 130), "In the ultra-relativistic regime, the equation of state", fill=(60, 60, 60))
draw.text((270, 150), "transitions such that pressure scales with density to", fill=(60, 60, 60))
draw.text((270, 170), "the four-thirds power: P = K * rho^(4/3).", fill=(60, 60, 60))
draw.text((270, 200), "This soft equation of state sets the Chandrasekhar limit.", fill=(60, 60, 60))

buf = io.BytesIO()
img.save(buf, format="PNG")
img_bytes = buf.getvalue()
b64_data = base64.b64encode(img_bytes).decode('ascii')

prompt = """Extract all text blocks, headings, paragraphs, and equations from this scanned academic document image.
For each item, return:
- "text": the extracted text or equation
- "type": "TEXT" or "EQUATION"
- "column": 1 or 2 (which column it belongs to)
- "box_2d": [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates
- "notation": LaTeX notation if it is an equation, else null

Return as a JSON list of objects:
[
  {
    "text": "...",
    "type": "TEXT",
    "column": 1,
    "box_2d": [ymin, xmin, ymax, xmax],
    "notation": null
  }
]"""

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
payload = {
    "contents": [{
        "parts": [
            {"text": prompt},
            {"inlineData": {"mimeType": "image/png", "data": b64_data}}
        ]
    }],
    "generationConfig": {
        "temperature": 0.1,
        "maxOutputTokens": 4096,
        "responseMimeType": "application/json"
    }
}

t0 = time.time()
with httpx.Client(timeout=30.0) as client:
    res = client.post(url, json=payload)
dur = time.time() - t0

print(f"Status: {res.status_code}, Duration: {dur:.2f}s")
if res.status_code == 200:
    data = res.json()
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    print("--- RAW TEXT ---")
    print(raw_text)
    print("----------------")
    try:
        parsed = json.loads(raw_text)
        print(json.dumps(parsed, indent=2))
    except Exception as e:
        print("JSON parse error:", e)
else:
    print(res.text)
