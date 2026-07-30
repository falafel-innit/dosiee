import os
import io
import re
import pytesseract
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

FREQUENCY_KEYWORDS = {
    "once daily": "Once daily", "once a day": "Once daily", "od": "Once daily",
    "twice daily": "Twice daily", "twice a day": "Twice daily", "bd": "Twice daily", "bid": "Twice daily",
    "three times daily": "Three times daily", "thrice daily": "Three times daily",
    "tds": "Three times daily", "tid": "Three times daily",
}

GEMINI_PROMPT = """You are reading a medical prescription image, which may be
handwritten or printed. Extract every medicine entry exactly as written.
For each medicine, output one line in this exact format:

MEDICINE_NAME | DOSAGE | FREQUENCY | DURATION

Example:
Metformin | 500mg | twice daily | 30 days

Only include lines that are actual medicines. Do not guess or invent
anything not visibly present. If a field is unclear, write UNKNOWN
for that field only."""


def _extract_with_gemini(file_path: str) -> str | None:
    if not GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        image = Image.open(file_path)
        response = model.generate_content([GEMINI_PROMPT, image])
        return response.text.strip()
    except Exception as e:
        print(f"Gemini extraction failed, falling back to Tesseract: {e}")
        return None


def _extract_with_tesseract(file_path: str) -> str:
    image = Image.open(file_path)
    return pytesseract.image_to_string(image)


def extract_text_from_image(file_path: str, is_handwritten: bool = False) -> str:
    """
    Tries Gemini Vision first (handles both handwritten and printed
    well, since it reasons about content). Falls back to Tesseract
    (free, offline) if no Gemini key is set or the call fails.
    The is_handwritten flag is kept for logging/future tuning but
    Gemini is used for both cases when available.
    """
    gemini_result = _extract_with_gemini(file_path)
    if gemini_result:
        return gemini_result
    return _extract_with_tesseract(file_path)


def parse_medicines_raw(raw_text: str):
    """
    Handles two possible input shapes:
    1. Gemini's structured "NAME | DOSAGE | FREQUENCY | DURATION" format
    2. Tesseract's raw unstructured text (fallback path)
    """
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    medicines = []

    dosage_pattern = re.compile(r"(\d+\s?(mg|ml|mcg|g))", re.IGNORECASE)
    duration_pattern = re.compile(r"(\d+)\s*day", re.IGNORECASE)

    for line in lines:
        # Structured Gemini format
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 2:
                name = parts[0]
                dosage = parts[1] if len(parts) > 1 and parts[1] != "UNKNOWN" else ""
                frequency_raw = parts[2] if len(parts) > 2 else ""
                duration_raw = parts[3] if len(parts) > 3 else ""

                frequency = "Once daily"
                for keyword, label in FREQUENCY_KEYWORDS.items():
                    if keyword in frequency_raw.lower():
                        frequency = label
                        break

                duration_match = duration_pattern.search(duration_raw)
                duration_days = int(duration_match.group(1)) if duration_match else 7

                if name and name.upper() != "UNKNOWN":
                    medicines.append({
                        "raw_name": name,
                        "dosage": dosage,
                        "frequency": frequency,
                        "duration_days": duration_days,
                    })
                continue

        # Fallback: unstructured Tesseract-style line
        dosage_match = dosage_pattern.search(line)
        if not dosage_match:
            continue

        dosage = dosage_match.group(1)
        raw_name = line[:dosage_match.start()].strip(" -:.")
        raw_name = re.sub(r"^(tab\.?|cap\.?|syp\.?|inj\.?)\s*", "", raw_name, flags=re.IGNORECASE).strip()

        frequency = "Once daily"
        for keyword, label in FREQUENCY_KEYWORDS.items():
            if keyword in line.lower():
                frequency = label
                break

        duration_match = duration_pattern.search(line)
        duration_days = int(duration_match.group(1)) if duration_match else 7

        if raw_name:
            medicines.append({
                "raw_name": raw_name,
                "dosage": dosage,
                "frequency": frequency,
                "duration_days": duration_days,
            })

    return medicines