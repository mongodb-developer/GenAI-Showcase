from typing import List, Tuple, Dict
from langchain.docstore.document import Document

def build_system_prompt(base: str, options: Dict[str, bool], extra_instructions: str) -> str:
    base_clean = base.strip()
    lines = [base_clean]

    if options.get("force_citations"):
        lines.append("Always cite sources as (filename p.page).")
    if options.get("refuse_if_ooc"):
        lines.append("If the answer is not fully supported by the context, reply: ‘I don’t have that in the documents.’")
    if options.get("bulleted_style"):
        lines.append("Use concise bullet points.")
    if options.get("structured_style"):
        lines.append("Structure output with headings as appropriate.")

    if extra_instructions:
        lines.append(extra_instructions.strip())

    return "\n".join(lines)


def build_context(docs: List[Document]) -> str:
    parts = []
    for i, d in enumerate(docs, 1):
        src = d.metadata.get("source", "document")
        page = d.metadata.get("page", "n/a")
        parts.append(f"[{i}] ({src} p.{page})\n{d.page_content}")
    return "\n\n".join(parts)


def build_messages(question: str, context: str, system_prompt: str, few_shots: List[Tuple[str, str]]):
    """Return Chat messages as (role, content) tuples in the order the model expects.
    few_shots: list of (role, content) pairs, e.g., [("human","..."), ("assistant","..."), ...]
    """
    messages = [("system", system_prompt)]

    # Append few-shot examples (optional)
    for role, content in few_shots:
        messages.append((role, content))

    messages.append(("human", f"Question: {question}\n\nContext:\n{context}\n\nAnswer:"))
    return messages
