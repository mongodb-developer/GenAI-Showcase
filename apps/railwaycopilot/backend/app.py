import os
import streamlit as st

from langchain_mistralai import ChatMistralAI, MistralAIEmbeddings
from langchain.docstore.document import Document

from rail_rag.config import (
    MONGODB_URI,
    EMBED_MODEL,
    CHAT_MODEL,
)
from rail_rag.index_utils import get_mongo_collection
from rail_rag.retriever import MongoAtlasRetriever
from rail_rag.ui import render_prompt_lab
from rail_rag.generation import run_generation
from rail_rag.classifier import classify_text

# --- Streamlit UI chrome ---
st.set_page_config(page_title="Rail Ops & Safety Assistant", page_icon="🚆", layout="wide")
st.title("🚆 Rail Operations & Safety Assistant (MongoDB + LangChain + Mistral)")

# Sidebar: Prompt Lab (returns all user choices + composed system prompt)
lab = render_prompt_lab()

if not os.getenv("MISTRAL_API_KEY"):
    st.error("Missing `MISTRAL_API_KEY` in environment.")
    st.stop()

if not MONGODB_URI:
    st.error("Missing `MONGODB_URI` in environment.")
    st.stop()

colA, colB, colC = st.columns([2, 1, 1])
with colA:
    q = st.text_input(
        "Ask a question (e.g., 'What must a signaller do when going off duty?')",
        "",
    )
with colB:
    top_k = st.slider("Top-K chunks", 1, 10, 4, 1)
with colC:
    show_debug = st.toggle("Show debug", value=False)

# Connect resources (MongoDB collection + embeddings + retriever)
try:
    collection = get_mongo_collection()
except Exception as e:
    st.exception(e)
    st.stop()

embedder = MistralAIEmbeddings(model=EMBED_MODEL)
retriever = MongoAtlasRetriever(collection=collection, embedder=embedder, k=top_k)

llm = ChatMistralAI(model=CHAT_MODEL)

if q:
    try:
        retrieved = retriever.invoke(q)

        if show_debug:
            with st.expander("🔎 Retrieved docs (debug)"):
                for i, d in enumerate(retrieved, 1):
                    st.write(f"{i}. meta = {d.metadata}")
                    st.write((d.page_content or "")[:300] + "…")

        if not retrieved:
            st.warning(
                "No documents retrieved. "
                "Check MongoDB URI / DB / collection / vector index / field names."
            )
            st.stop()

        # Full prompt-building + A/B + rendering (answers + sources)
        run_generation(
            question=q,
            retrieved=retrieved,
            chat_model_name=CHAT_MODEL,
            lab=lab,
        )

    except Exception as e:
        st.exception(e)
        st.stop()
