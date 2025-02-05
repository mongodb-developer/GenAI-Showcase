import os
import re
import tempfile
import time

import streamlit as st
from rag_module import ChatPDF

st.set_page_config(page_title="Local RAG with MongoDB and DeepSeek")


def display_messages():
    """Display the chat history using Streamlit's native chat interface."""
    st.subheader("Chat History")
    for message in st.session_state["messages"]:
        with st.chat_message(message["role"]):
            if message["role"] == "assistant":
                # Process the content to hide <think>...</think> blocks
                content = message["content"]
                # Use regex to find all <think>...</think> blocks
                think_blocks = re.findall(r"<think>(.*?)</think>", content, re.DOTALL)
                # Remove all <think>...</think> blocks from the visible content
                visible_content = re.sub(
                    r"<think>.*?</think>", "", content, flags=re.DOTALL
                ).strip()

                # Display the visible content
                st.markdown(visible_content)

                # For each think block, add an expander to show the hidden content
                for think in think_blocks:
                    with st.expander("Show Hidden Reasoning", expanded=False):
                        st.markdown(think)
            else:
                # For user and system messages, display normally
                st.markdown(message["content"])


def process_query():
    """Process the user input and generate an assistant response."""
    user_input = st.session_state.get("user_input", "").strip()
    if user_input:
        # Add user message to chat history
        st.session_state["messages"].append({"role": "user", "content": user_input})

        with st.chat_message("user"):
            st.markdown(user_input)

        # Prepare conversation history for context (excluding system messages if any)
        conversation_history = [
            msg["content"]
            for msg in st.session_state["messages"]
            if msg["role"] != "system"
        ]

        # Display assistant response
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    # Generate the assistant response with context
                    agent_text = st.session_state["assistant"].query_with_context(
                        user_input,
                        conversation_history=conversation_history,
                        k=st.session_state["retrieval_k"],
                        score_threshold=st.session_state["retrieval_threshold"],
                    )
                except ValueError as e:
                    agent_text = str(e)

            st.markdown(agent_text)

        # Add assistant response to chat history
        st.session_state["messages"].append(
            {"role": "assistant", "content": agent_text}
        )

        # Clear the input box
        st.session_state["user_input"] = ""


def upload_and_index_file():
    """Handle file upload and ingestion."""
    st.session_state["assistant"].reset_retriever()
    st.session_state["messages"] = []
    st.session_state["user_input"] = ""

    for file in st.session_state["file_uploader"]:
        with tempfile.NamedTemporaryFile(delete=False) as tf:
            tf.write(file.getbuffer())
            file_path = tf.name

        with (
            st.session_state["ingestion_spinner"],
            st.spinner(f"Uploading and indexing {file.name}..."),
        ):
            t0 = time.time()
            st.session_state["assistant"].upload_and_index_pdf(file_path)
            t1 = time.time()

        st.session_state["messages"].append(
            {
                "role": "system",
                "content": f"Uploaded and indexed {file.name} in {t1 - t0:.2f} seconds",
            }
        )
        os.remove(file_path)


def initialize_session_state():
    """Initialize session state variables."""
    if "messages" not in st.session_state:
        st.session_state["messages"] = []
    if "assistant" not in st.session_state:
        st.session_state["assistant"] = ChatPDF()
    if "ingestion_spinner" not in st.session_state:
        st.session_state["ingestion_spinner"] = st.empty()
    if "retrieval_k" not in st.session_state:
        st.session_state["retrieval_k"] = 5  # Default value
    if "retrieval_threshold" not in st.session_state:
        st.session_state["retrieval_threshold"] = 0.2  # Default value
    if "user_input" not in st.session_state:
        st.session_state["user_input"] = ""


def page():
    """Main app page layout."""
    initialize_session_state()

    st.header("Local RAG with MongoDB and DeepSeek")

    st.subheader("Upload a Document")
    st.file_uploader(
        "Upload a PDF document",
        type=["pdf"],
        key="file_uploader",
        on_change=upload_and_index_file,
        label_visibility="collapsed",
        accept_multiple_files=True,
    )

    # Display messages and text input
    display_messages()

    # Accept user input using the new chat input
    prompt = st.chat_input("Type your message here...")
    if prompt:
        st.session_state["user_input"] = prompt
        process_query()

    # Clear chat
    if st.button("Clear Chat"):
        st.session_state["messages"] = []
        st.session_state["assistant"].reset_retriever()
        st.session_state["user_input"] = ""


if __name__ == "__main__":
    page()
