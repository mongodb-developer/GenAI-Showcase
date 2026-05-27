from rail_rag.config import SYSTEM_PROMPT as BASE_SYSTEM_PROMPT

PRESETS = {
    "Baseline (Original)": BASE_SYSTEM_PROMPT,
    "Strict Compliance": (
        BASE_SYSTEM_PROMPT
        + "\nAlways refuse to answer if information is missing from context."
        + "\nUse short, numbered steps when appropriate."
    ),
    "Operator Brief (Bulleted)": (
        BASE_SYSTEM_PROMPT
        + "\nRespond in crisp bullet points suitable for radio/ops briefings."
        + "\nIf a rule references a page, include it inline after the bullet."
    ),
    "Incident Response (Structured)": (
        BASE_SYSTEM_PROMPT
        + "\nOrganize output as: Situation, Applicable Rules, Required Actions, Sources."
    ),
    "Trainer Mode (Explain & Cite)": (
        BASE_SYSTEM_PROMPT
        + "\nExplain the rule briefly (1–2 sentences) and then summarize the action."
        + "\nAlways include a Sources section with (filename p.page)."
    ),
}
