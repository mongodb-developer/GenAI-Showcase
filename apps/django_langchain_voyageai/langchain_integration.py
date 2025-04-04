import os

from dotenv import load_dotenv
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_voyageai.embeddings import VoyageAIEmbeddings

# from pymongo import MongoClient

load_dotenv()
voyage_api_key = os.getenv("VOYAGE_API_KEY")
connection_string = os.getenv("MONGO_URI")


# This is our embeddings object.
embeddings = VoyageAIEmbeddings(voyage_api_key=voyage_api_key, model="voyage-3-lite")
# This is your `database.collection`.
namespace = "dublinfinder.placesinfo"

# Vector store with our embeddings model.
vector_store = MongoDBAtlasVectorSearch.from_connection_string(
    connection_string=connection_string,
    namespace=namespace,
    embedding_key="embedding",
    index_name="vector_index",
    text_key="reviews",
    embedding=embeddings,
)

# Similarity search.
query = "Wine bar with snacks and outdoor seating"

# LangChain automatically handles embedding the query.
results = vector_store.similarity_search_with_score(query, k=3)

# Post-process and make it look pretty.
for doc, score in results:
    name = doc.metadata.get("displayName", {}).get("text", "Unknown")
    address = doc.metadata.get("formattedAddress", "Unknown")
    review_text = doc.page_content
    short_review = review_text[:200]

    print(f"Name: {name}")
    print(f"Address: {address}")
    print(f"Short review: {short_review}")
    print(f"Score: {score}")
    print()
