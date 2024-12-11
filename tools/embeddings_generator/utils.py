import getpass
import logging
from typing import List, Union

import cohere
import openai
import pandas as pd
import pymongo
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")


# Class to handle client errors
class ClientError(Exception):
    pass


# Class to handle errors with reading data
class DataError(Exception):
    pass


def get_openai_client() -> openai.OpenAI:
    """
    Intiialize and vvalidate OpenAI client.

    Returns:
        openai.OpenAI: OpenAI client
    """
    api_key = getpass.getpass(prompt="Enter your OpenAI API key.")
    client = openai.OpenAI(api_key=api_key)
    try:
        client.models.list()
        return client
    except openai.AuthenticationError:
        logging.error("OpenAI authentication failed.")
        raise ClientError("OpenAI authentication failed. Please check your API key.")


def get_cohere_client() -> cohere.client.Client:
    """
    Initialize and validate Cohere client.

    Returns:
        cohere.client.Client: Cohere client
    """
    api_key = getpass.getpass(prompt="Enter your Cohere API key.")
    client = cohere.Client(api_key)
    try:
        client.tokenize("o")
        return client
    except cohere.error.CohereAPIError:
        logging.error("Cohere authentication failed.")
        raise ClientError("Cohere authentication failed. Please check your API key.")


def get_client(provider: str) -> Union[openai.OpenAI, cohere.client.Client, None]:
    """
    Get the right client (or not) based on the provider.

    Args:
        provider (str):  Embeddings provider. One of `openai`, `cohere` or `huggingface`.

    Returns:
        Union[openai.OpenAI, cohere.client.Client, None]: OpenAI or Cohere client
    """
    if provider not in ["openai", "cohere", "huggingface"]:
        logging.error("Provider not supported.")
        raise ClientError(
            f"Provider {provider} is not supported. Provider can only be 'openai', 'cohere' or 'huggingface'"
        )
    client = None
    if provider == "openai":
        client = get_openai_client()
    elif provider == "cohere":
        client = get_cohere_client()
    return client


def get_openai_embeddings(
    client: openai.OpenAI, model: None, docs: List[str]
) -> List[List[float]]:
    """
    Get OpenAI embeddings.

    Args:
        client (openai.OpenAI): OpenAI client
        model (None): Embedding model. Only required for Hugging Face models.
        docs (List[str]): List of texts to embed

    Returns:
        List[List[float]]: Array of embeddings
    """
    try:
        docs = [doc.replace("\n", " ") for doc in docs]
        response = client.embeddings.create(
            input=docs, model="text-embedding-3-small", dimensions=512
        )
        response = [r.embedding for r in response.data]
        return response
    except Exception as e:
        logging.error(f"Error generating embeddings for batch: {e}")
        return None


def get_cohere_embeddings(
    client: cohere.client.Client, model: None, docs: List[str]
) -> List[List[float]]:
    """
    Get Cohere embeddings.

    Args:
        client (cohere.client.Client): Cohere client
        model (None): Embedding model. Only required for Hugging Face models.
        docs (List[str]): List of texts to embed

    Returns:
        List[List[float]]: Array of embeddings
    """
    try:
        response = client.embed(
            docs, input_type="search_document", model="embed-english-v3.0"
        )
        return response.embeddings
    except Exception as e:
        logging.error(f"Error generating embeddings for batch: {e}")
        return None


def get_hf_embeddings(
    client: None, model: SentenceTransformer, docs: List[str]
) -> List[List[float]]:
    """
    Get embeddings using the gte-small model from Hugging Face/

    Args:
        client (None): Client. Only required for OpenAI and Cohere
        model (SentenceTransformer.SentenceTransformer): gte-small model from Hugging Face
        docs (List[str]): List of texts to embed

    Returns:
        List[List[float]]: Array of embeddings
    """
    try:
        response = model.encode(docs).tolist()
        return response
    except Exception as e:
        logging.error(f"Error generating embeddings for batch: {e}")
        return None


def get_mongo_client(mongo_uri: str) -> pymongo.MongoClient:
    """
    Initialize MongoDB client.

    Args:
        mongo_uri (str): MongoDB connection string

    Returns:
        pymongo.MongoClient: MongoDB client
    """

    try:
        client = pymongo.MongoClient(mongo_uri)
        logging.error("Connection to MongoDB successful.")
        return client
    except pymongo.errors.ConnectionFailure as e:
        logging.error("Error connecting to MongoDB.")
        raise ClientError(e)


def ingest_data(
    client: pymongo.MongoClient, data: pd.DataFrame, db: str, coll: str
) -> None:
    """
    Ingest data with embeddings into MongoDB

    Args:
        client (pymongo.MongoClient): MongoDB client
        data (pd.DataFrame): Data to ingest
        db (str): Database to ingest data into
        coll (str): Collection to ingest data into
    """
    db = client[db]
    collection = db[coll]
    db.collection.drop()
    docs = data.to_dict("records")
    collection.insert_many(docs)
