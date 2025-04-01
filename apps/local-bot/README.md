# Step-by-Step Guide: Building a Local Chatbot with Streamlit, LangChain, Ollama, and MongoDB Atlas

In this tutorial, we'll set up a local chatbot using **Streamlit**, **LangChain**, **Ollama**, and **MongoDB Atlas Search**. This bot will leverage MongoDB's powerful Atlas Search capabilities alongside local LLMs (Large Language Models) via Ollama, allowing you to enhance user queries with context from chat history.

## Prerequisites
Before starting, make sure you have the following installed:

* Docker
* Docker Compose

> [!NOTE]
> For this tutorial, Docker is essential for containerized, isolated development.

## Step 1: Setting Up the Project

### Project Overview
We’ll start by creating a directory for the project files and setting up our working structure.

```sh
mkdir localai
cd localai
```

### Project Structure

Organize your project files as shown:

```
localai/
├── app.py
├── Dockerfile
├── compose.yaml
└── requirements.txt
```

### Tool Overview

Here’s a quick rundown of the tools we’re using in this project:

*	*[Streamlit](https://streamlit.io)*: A Python library for easily creating data-based web applications. We'll use it to create a local chatbot interface.
*	*[LangChain](https://langchain.com)*: A framework that simplifies working with LLMs and document processing. It will assist processing user queries and generate responses.
*	*[Ollama](https://ollama.com)*: A solution for deploying LLMs locally without external API dependency. It to host our models.
*	*[MongoDB Atlas Search](https://www.mongodb.com/products/platform/atlas-search)*: Adds a powerful, flexible vector search functionality to our app. It will store user queries and responses in MongoDB.

### Setting Up `requirements.txt`

In `requirements.txt`, specify the dependencies needed for this project:

```requirements.txt
streamlit
ollama
langchain
langchain_ollama
pymongo
langchain_mongodb
langchain_community
markdownify
```

### Docker Configuration

#### `Dockerfile`
Create a Dockerfile and add the following content. This file will define the container setup, ensuring our app and its dependencies run consistently across environments.

```Dockerfile
FROM python:3.12
WORKDIR /opt/app
ADD requirements.txt .
RUN pip install -r requirements.txt
ADD app.py .

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

#### `compose.yaml`
Define your Docker Compose configuration in `compose.yaml`:

```yaml
services:
  app:
    build:
      context: .
    ports:
      - 8501:8501/tcp
    environment:
      MONGO_URI: mongodb://root:root@mongo:27017/admin?directConnection=true
  ollama:
    image: ollama/ollama
  mongo:
    image: mongodb/mongodb-atlas-local
    environment:
      - MONGODB_INITDB_ROOT_USERNAME=root
      - MONGODB_INITDB_ROOT_PASSWORD=root
    ports:
       - 27017:27017
```

> [!TIP]
> If you are on macOS, install Ollama locally and use this modified version of `compose.yaml`:
> ```yaml
> services:
>   app:
>     build:
>       context: .
>     ports:
>       - 8501:8501/tcp
>     environment:
>       OLLAMA_HOST: host.docker.internal:11434
>       MONGO_URI: mongodb://root:root@mongo:27017/admin?directConnection=true
>     extra_hosts:
>       - "host.docker.internal:host-gateway"
>   mongo:
>     image: mongodb/mongodb-atlas-local
>     environment:
>       - MONGODB_INITDB_ROOT_USERNAME=root
>       - MONGODB_INITDB_ROOT_PASSWORD=root
>     ports:
>        - 27017:27017
> ```

## Step 2: Creating the Initial App

Create app.py with a simple “Hello World” message to ensure your environment is set up correctly.

```python
import streamlit as st

st.write('Hello, World!')
```

With all files in place, you can now build and run the Docker containers:

```sh
docker compose up --build
```

Access the app at http://localhost:8501 in your browser. You should see the message Hello, World!

> _Expected Output_: A browser page displaying “Hello, World!” confirms your setup is correct.

## Step 3: Build the Chatbot

### Step 3.1: Setting Up MongoDB and Ollama

In `app.py`, connect to MongoDB and Ollama. This will pull LLM models from Ollama and set up MongoDB for data storage.

```python
import os
import streamlit as st
from pymongo import MongoClient
import ollama

# Model and embedding configurations
MODEL = "llama3.2"
EMBEDDING_MODEL = "nomic-embed-text"
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# Pull models from Ollama
ollama.pull(MODEL)
ollama.pull(EMBEDDING_MODEL)

# Initialize MongoDB client
try:
    mongo_client = MongoClient(MONGO_URI)
    collection = mongo_client["bot"]["data"]
except Exception as e:
    st.error(f"Failed to connect to MongoDB: {e}")
    st.stop()
```

> [!NOTE]
> After each step, you can test the app by re-running `docker compose up --build`.

### Step 3.2: Loading Documents and Creating a Vector Search Index

Now, load documents, process them with LangChain, and store them as vector embeddings in MongoDB. This setup allows MongoDB Atlas to perform fast vector-based searches.

```python
from langchain_ollama import OllamaEmbeddings
from langchain_community.document_loaders import WebBaseLoader
from langchain_community.document_transformers import MarkdownifyTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mongodb import MongoDBAtlasVectorSearch

embedding = OllamaEmbeddings(model=EMBEDDING_MODEL)
collection.drop()

loaders = [
    WebBaseLoader("https://en.wikipedia.org/wiki/AT%26T"),
    WebBaseLoader("https://en.wikipedia.org/wiki/Bank_of_America")
]
docs = []
for loader in loaders:
    for doc in loader.load():
        docs.append(doc)

md = MarkdownifyTransformer()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
converted_docs = md.transform_documents(docs)
splits = text_splitter.split_documents(converted_docs)

vectorstore = MongoDBAtlasVectorSearch.from_documents(splits, embedding, collection=collection, index_name="default")
vectorstore.create_vector_search_index(768)
```

> _Expected Output_: After this step, MongoDB Atlas should contain indexed documents, enabling fast vector-based search capabilities.

### Step 3.3: Setting Up the Chat Model

Next, set up the chat model with a retrieval mechanism and define the chain of operations that will handle user queries.

```python
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_mongodb import MongoDBChatMessageHistory

retriever = vectorstore.as_retriever()
chat = ChatOllama(model=MODEL)

# System message for the chatbot
SYSTEM_MESSAGE = """You're a helpful assistant. Answer all questions to the best of your ability. If you don't know the answer let the user know to find help on the internet.

Available context:
{context}
"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_MESSAGE),
    MessagesPlaceholder("history"),
    ("human", "{input}"),
])

chain = {
    "context": itemgetter("input") | retriever,
    "input": itemgetter("input"),
    "history": itemgetter("history")
} | prompt_template | chat | StrOutputParser()

def get_session_history(session_id: str) -> BaseChatMessageHistory:
    return MongoDBChatMessageHistory(MONGO_URI, session_id, database_name="bot")

history_chain = RunnableWithMessageHistory(chain, get_session_history, input_messages_key="input", history_messages_key="history")
```

### Step 3.4: Creating the Chat Interface

Now, use Streamlit to create a chat interface for interacting with the chatbot.

```python
st.title("Chatbot")
st.caption("A Streamlit chatbot")

history = get_session_history()
for msg in history.messages:
    st.chat_message(msg.type).write(msg.content)

if prompt := st.chat_input():
    st.chat_message("user").write(prompt)
    with st.chat_message("ai"):
        with st.spinner("Thinking..."):
            st.write_stream(history_chain.stream({"input": prompt}))
```

At this point, you can start prompting with inputs like “Who started AT&T?” and see the chatbot respond!

## Conclusion and Next Steps

In this tutorial, we built a local chatbot setup using MongoDB Atlas Search and local LLMs via Ollama, integrated through Streamlit. This project forms a robust foundation for further development and deployment.

Possible Extensions:

* Add more sophisticated pre-processing for documents.
* Experiment with different models in Ollama.
* Deploy to a cloud environment like AWS or Azure for production scaling.

Feel free to customize this setup to suit your needs. Happy coding!
