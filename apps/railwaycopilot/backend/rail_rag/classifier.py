from langchain_mistralai import ChatMistralAI
import json

CLASSIFIER_SYSTEM_PROMPT = """You are a classification assistant for rail operations and safety.
Classify the input into one of these intents:
- informational
- procedural
- compliance
- safety_critical
- other
Respond ONLY in JSON like:
{"intent": "..."}.
"""

llm_classifier = ChatMistralAI(model="mistral-small-latest", temperature=0.0)

def classify_text(text: str) -> dict:
    messages = [
        ("system", CLASSIFIER_SYSTEM_PROMPT),
        ("human", text),
    ]
    result = llm_classifier.invoke(messages)
    raw = result.content.strip()

    # Try to parse JSON; if it fails, fall back to dict with string
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
        else:
            return {"intent": str(parsed)}
    except Exception:
        # fallback: sometimes the LLM returns plain text or partial JSON
        if raw.startswith("{") and raw.endswith("}"):
            # slightly malformed JSON, try to clean quotes
            raw = raw.replace("'", '"')
            try:
                return json.loads(raw)
            except Exception:
                pass
        return {"intent": raw}
