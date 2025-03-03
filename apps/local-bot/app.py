import os
from operator import itemgetter

import streamlit as st
import ollama
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_ollama import ChatOllama, OllamaEmbeddings
from pymongo import MongoClient
from langchain_mongodb import MongoDBChatMessageHistory, MongoDBAtlasVectorSearch
from langchain_community.document_loaders import WebBaseLoader
from langchain_community.document_transformers import MarkdownifyTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory

# System message for the chatbot
SYSTEM_MESSAGE = """You're a helpful assistant. Answer all questions to the best of your ability. If you don't know the answer let the user know to find help on the internet.

Available context:
{context}
"""

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

# Initialize embeddings
embedding = OllamaEmbeddings(model=EMBEDDING_MODEL)

# Load documents and create vector search index if not already present
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
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000, chunk_overlap=200)
docs = loader.load()
converted_docs = md.transform_documents(docs)
splits = text_splitter.split_documents(converted_docs)
vectorstore = MongoDBAtlasVectorSearch.from_documents(
    splits, embedding, collection=collection, index_name="default")
vectorstore.create_vector_search_index(768)

# Initialize retriever and chat model
retriever = vectorstore.as_retriever()
chat = ChatOllama(model=MODEL)

# Define prompt template
prompt_template = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_MESSAGE),
    MessagesPlaceholder("history"),
    ("human", "{input}"),
])

# Define the chain of operations
chain = {
    "context": itemgetter("input") | retriever,
    "input": itemgetter("input"),
    "history": itemgetter("history")
} | prompt_template | chat | StrOutputParser()

# Function to get session history
def get_session_history() -> BaseChatMessageHistory:
    return MongoDBChatMessageHistory(MONGO_URI, "user", database_name="bot")


# Initialize history chain
history_chain = RunnableWithMessageHistory(
    chain, get_session_history, input_messages_key="input", history_messages_key="history")

# Streamlit UI
st.title("Chatbot")
st.caption("A Streamlit chatbot")

# Display chat history
history = get_session_history()
for msg in history.messages:
    st.chat_message(msg.type).write(msg.content)

# Handle user input
if prompt := st.chat_input():
    st.chat_message("user").write(prompt)
    with st.chat_message("ai"):
        with st.spinner("Thinking..."):
            st.write_stream(history_chain.stream({"input": prompt}))
