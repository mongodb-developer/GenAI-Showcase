from langchain_core.tools import tool
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain.embeddings import OpenAIEmbeddings
from typing import Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import os
from dotenv import load_dotenv
import json
from pymongo import MongoClient

# Load environment variables from .env file
load_dotenv()
# Create a MongoDB client and insert the booking

client = MongoClient(
    os.environ["MONGODB_ATLAS_URI"], appname="devrel.showcase.partner.openai"
)


# Initialize OpenAI embeddings with text-embedding-3-small model
embedding_model = OpenAIEmbeddings(
    model="text-embedding-3-small", openai_api_key=os.environ["OPENAI_API_KEY"]
)


class Booking(BaseModel):
    name: str = Field(..., description="Name of the person making the booking")
    payment_method: str = Field(
        ..., description="Payment method (e.g., credit card, PayPal)"
    )
    date: str = Field(..., description="Date of the booking (YYYY-MM-DD format)")
    rental_name: str = Field(..., description="Name of the rental property")
    num_people: int = Field(..., description="Number of people in the booking", ge=1)


@tool
def rentlas_search_tool(query: str, k: int = 5):
    """
    Perform a vector similarity search using MongoDB Atlas Vector Search to find rentals.

    Args:
        query (str): The search query string.
        k (int, optional): Number of top results to return. Defaults to 5.

    Returns:
        list: List of tuples (Document, score), where Document is the matched document
              and score is the similarity score (lower is more similar).

    Note:
        Uses MongoDB Atlas Vector Search for semantic search capabilities.
    """
    vector_store = MongoDBAtlasVectorSearch.from_connection_string(
        connection_string=os.environ["MONGODB_ATLAS_URI"],
        namespace="ai_airbnb.rentals",
        embedding_key="text_embeddings",
        text_key="description",
        index_name="vector_index",
        embedding=embedding_model,
    )

    vector_search_results = vector_store.similarity_search_with_score(query=query, k=k)
    return vector_search_results


@tool
def create_booking(booking_info: str) -> str:
    """
    Create a new booking for a rental property. You must have all input info before exec.

    Args:
        booking_info (str): JSON string containing booking information with the following fields:
            - name: Name of the person making the booking
            - payment_method: Payment method (e.g., credit card, PayPal)
            - date: Date of the booking (YYYY-MM-DD format)
            - rental_name: Name of the rental property
            - num_people: Number of people in the booking

    Returns:
        str: Confirmation message with booking details or error message if validation fails

    Example:
        create_booking('{"name": "John Doe", "payment_method": "credit card", "date": "2024-03-15", "rental_name": "Beach House", "num_people": 4}')
    """
    try:
        # Parse the JSON string into a dictionary
        booking_data = json.loads(booking_info)

        # Validate the booking data using the Booking model
        booking = Booking(**booking_data)

        db = client.ai_airbnb
        bookings_collection = db.bookings

        # Insert the booking into MongoDB
        booking_dict = booking.dict()
        booking_dict["created_at"] = datetime.utcnow()
        result = bookings_collection.insert_one(booking_dict)

        # Return success message
        return f"Booking created successfully! Booking ID: {result.inserted_id}"
    except json.JSONDecodeError:
        return "Error: Invalid JSON format in booking information"
    except Exception as e:
        return f"Error creating booking: {str(e)}"


## Tool to get a booking based by name
@tool
def get_booking_by_name(name: str) -> Dict[str, Any]:
    """
    Get a booking by name.

    Args:
        name (str): Name of the person making the booking

    Returns:
        dict: Dictionary containing booking information or error message if booking not found
    """
    try:
        db = client.ai_airbnb
        bookings_collection = db.bookings

        # Query the bookings collection by name
        booking = list(
            bookings_collection.aggregate(
                [{"$search": {"text": {"query": name, "path": "name", "fuzzy": {}}}}]
            )
        )

        if booking:
            return booking
        else:
            return {"error": "Booking not found"}
    except Exception as e:
        return {"error": f"Error getting booking: {str(e)}"}


TOOLS = [rentlas_search_tool, create_booking, get_booking_by_name]
