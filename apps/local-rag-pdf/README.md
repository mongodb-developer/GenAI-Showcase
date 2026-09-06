# Local RAG with PDF, Ollama, and MongoDB Atlas

This application demonstrates a Retrieval-Augmented Generation (RAG) pipeline using **Ollama** for local LLMs and embeddings, and **MongoDB Atlas** as the vector store. It allows users to upload a PDF, index its content, and ask questions based on the document's context.

## Features

- **PDF Ingestion**: Upload and parse PDF documents.
- **Chunking & Embedding**: Splits text into manageable chunks and generates embeddings using Ollama.
- **Vector Storage**: Stores embeddings in MongoDB Atlas Vector Search.
- **Context-Aware QA**: Retrieves relevant context to answer user queries using a local LLM.
- **Conversation History**: Maintains context across multiple turns of conversation.

## Prerequisites

Before running this application, ensure you have the following:

1.  **Python 3.9+**: Installed on your system.
2.  **MongoDB Atlas Cluster**:
    - Create a [free account](https://www.mongodb.com/cloud/atlas/register).
    - Deploy a cluster (M0 sandbox is sufficient).
    - Get your connection string.
3.  **Ollama**:
    - Download and install [Ollama](https://ollama.com/).
    - Pull the required models:
      ```bash
      ollama pull llama3
      ollama pull nomic-embed-text
      ```
      *(Note: You can configure different models in `config.yaml`)*

## Installation

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone <repository-url>
    cd apps/local-rag-pdf
    ```

2.  **Create a virtual environment**:
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```

3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure the application**:
    - Open `config.yaml`.
    - Update `mongo_connection_str` with your Atlas connection string.
    - (Optional) Change `llm_model` or `embedding_model` if you want to use different Ollama models.

## Usage

1.  **Run the application**:
    ```bash
    streamlit run app.py
    ```

2.  **Interact with the UI**:
    - Upload a PDF file using the sidebar.
    - Wait for the ingestion process to complete (check the logs in the terminal).
    - Type your question in the chat input box.

## Architecture

1.  **User** uploads a PDF.
2.  **PyMuPDF** extracts text from the PDF.
3.  **LangChain** splits the text into chunks.
4.  **Ollama** generates vector embeddings for each chunk.
5.  **MongoDB Atlas** stores these embeddings.
6.  When a **User** asks a question:
    - The question is embedded using **Ollama**.
    - **MongoDB Atlas** performs a vector search to find relevant chunks.
    - The retrieved chunks + the question are sent to the **Ollama** LLM.
    - The LLM generates a response based on the context.

## Troubleshooting

-   **Connection Error**: Ensure your IP address is whitelisted in MongoDB Atlas Network Access.
-   **Ollama Error**: Make sure the Ollama service is running locally (`ollama serve`).
