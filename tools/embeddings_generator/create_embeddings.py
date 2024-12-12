import argparse
import logging
from datetime import datetime
from typing import List, Union

import cohere
import openai
import pandas as pd
import utils
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

# Specifications for arguments to the script
parser = argparse.ArgumentParser()
parser.add_argument(
    "--path", type=str, required=True, help="Path to csv file containing the data."
)
parser.add_argument(
    "--type",
    type=str,
    required=True,
    help="Provider to generate embeddings. One of openai, cohere or huggingface.",
)
parser.add_argument(
    "--field",
    type=str,
    required=True,
    help="Field in the csv to generate embeddings for.",
)
parser.add_argument(
    "--uri",
    type=str,
    required=True,
    help="MongoDB connection string.",
)
parser.add_argument(
    "--db",
    type=str,
    default=f"{datetime.now().strftime('%Y-%m-%d')}",
    help="Field in the csv to generate embeddings for.",
)
parser.add_argument(
    "--coll",
    type=str,
    default="embeddings",
    help="Field in the csv to generate embeddings for.",
)
args = parser.parse_args()


def get_embeddings(
    provider: str,
    client: Union[openai.OpenAI, cohere.client.Client, None],
    texts: List[str],
) -> List[List[float]]:
    """
    Choose the embedding function based on the provider, and generate embeddings in batches.

    Args:
        provider (str): Embeddings provider. One of `openai`, `cohere`, `huggingface`
        client (Union[openai.OpenAI, cohere.client.Client, None]): Client to interface with proprietary embeddings APIs. Only required fpr OpenAI, Cohere.
        texts (List[str]): List of texts to embed

    Returns:
        List[List[float]]: Array of embeddings
    """
    model = None
    if provider == "openai":
        emb_fn = func_map.get("openai")
    elif provider == "cohere":
        emb_fn = func_map.get("cohere")
    else:
        emb_fn = func_map.get("huggingface")
        model = utils.SentenceTransformer("thenlper/gte-small")

    embeddings = []
    for i in tqdm(range(0, len(texts), 128)):
        end = min(len(texts), i + 128)
        batch = texts[i:end]
        batch_embeddings = emb_fn(client, model, batch)
        if batch_embeddings is not None:
            embeddings.extend(batch_embeddings)

    return embeddings


def get_data(path: str, field: str) -> pd.DataFrame:
    """
    Load the dataset as a Pandas dataframe.

    Args:
        path (str): Absolute path to the CSV file
        field (str): Field to generate embeddings for

    Returns:
        pd.DataFrame: Dataset loaded as a Pandas dataframe
    """
    try:
        data = pd.read_csv(path)
        data = data.dropna(subset=[field])
        return data
    except Exception as e:
        logging.error("Error reading the CSV file.")
        raise utils.DataError(e)


# Mapping provider names to their respective embedding functions
func_map = {
    "openai": utils.get_openai_embeddings,
    "cohere": utils.get_cohere_embeddings,
    "huggingface": utils.get_hf_embeddings,
}


def main():
    """Main function"""
    provider = args.type
    client = utils.get_client(provider)

    path = args.path
    field = args.field

    logging.info("Loading the dataset...")
    data = get_data(path, field)
    texts = data[args.field].tolist()

    logging.info("Generating embeddings...")
    data["embeddings"] = get_embeddings(provider, client, texts)

    logging.info("Ingesting data into MongoDB...")
    mongo_client = utils.get_mongo_client(args.uri)
    utils.ingest_data(mongo_client, data, args.db, args.coll)
    logging.info(f"Inserted {len(data)} documents into MongoDB.")


if __name__ == "__main__":
    main()
