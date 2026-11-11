import streamlit as st
from typing import List, Tuple
from langchain_mistralai import ChatMistralAI
from langchain.docstore.document import Document
from rail_rag.prompt_utils import build_context, build_messages, build_system_prompt
from rail_rag.classifier import classify_text


def _human_preview(question_text: str, context_text: str, limit: int = 1200) -> str:
    snippet = context_text if len(context_text) <= limit else context_text[:limit] + "…"
    return f"Question: {question_text}\n\nContext:\n{snippet}"

def run_generation(
    question: str,
    retrieved: List[Document],
    chat_model_name: str,
    lab: dict,
):
    active_system_prompt = lab["active_system_prompt"]
    temperature = lab["temperature"]
    max_tokens = lab["max_tokens"]
    fewshot_pairs: List[Tuple[str, str]] = lab["fewshot_pairs"]
    ab_test = lab["ab_test"]
    base_prompt = lab["base_prompt"]
    refuse_if_ooc = lab["refuse_if_ooc"]
    extra_instructions = lab["extra_instructions"]

    ctx = build_context(retrieved)
    messages_a = build_messages(
        question=question,
        context=ctx,
        system_prompt=active_system_prompt,
        few_shots=fewshot_pairs,
    )

    llm = ChatMistralAI(model=chat_model_name, temperature=temperature, max_tokens=max_tokens)

    # classification
    classification = classify_text(question)
    intent = classification.get("intent", "Unknown").capitalize()

    st.subheader("🧭 Query Classification")
    st.markdown(f"**Intent:** {intent}")
    st.divider()

    with st.expander("🧾 Prompts used (A/B Preview)", expanded=False):
        st.markdown("### Prompt A — System")
        st.code(active_system_prompt, language="markdown")
        st.markdown("**Prompt A — Human**")
        st.code(_human_preview(question, ctx), language="markdown")

        messages_b = None
        alt_system_prompt = None
        if ab_test:
            alt_system_prompt = build_system_prompt(
                base_prompt,
                {
                    "force_citations": True,
                    "refuse_if_ooc": refuse_if_ooc,
                    "bulleted_style": True,
                    "structured_style": True,
                },
                extra_instructions,
            )
            messages_b = build_messages(
                question=question,
                context=ctx,
                system_prompt=alt_system_prompt,
                few_shots=fewshot_pairs,
            )

            st.markdown("---")
            st.markdown("### Prompt B — System")
            st.code(alt_system_prompt, language="markdown")
            st.markdown("**Prompt B — Human**")
            st.code(_human_preview(question, ctx), language="markdown")

    if not ab_test:
        with st.spinner("Thinking…"):
            ans_a = llm.invoke(messages_a)
        st.subheader("Answer")
        st.write(ans_a.content)
    else:
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("### Prompt A")
            with st.spinner("Running A…"):
                ans_a = llm.invoke(messages_a)
            st.write(ans_a.content)

        with col2:
            st.markdown("### Prompt B")
            with st.spinner("Running B…"):
                ans_b = llm.invoke(messages_b)
            st.write(ans_b.content)

    st.subheader("Sources")
    for i, d in enumerate(retrieved, 1):
        src = d.metadata.get("source", "document")
        page = d.metadata.get("page", "n/a")
        st.markdown(f"**{i}. {src} — p.{page}**")
        st.write((d.page_content or "")[:400] + "…")
