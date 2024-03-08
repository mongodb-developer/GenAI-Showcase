# Embeddings Generator

Python tool to add embeddings to a dataset of your choice, and ingest it into a MongoDB Atlas cluster.

The tool currently supports three embedding models:
* `text-embedding-3-small`: One of OpenAI's latest text embedding models. Dimensions are set to 512 for this model.
* `embed-english-v3.0`: One of Cohere's embedding models with 1024 dimensions.
* `gte-small`: An open-source model available on Hugging Face Model Hub.

## Pre-requisites

* Have Python installed. Preferably version 3.10+. If you don't have it installed, download it from [here](https://www.python.org/downloads/).

* Have your data saved locally as a CSV file. Keep the absolute path to the file handy.

* [Create](https://www.mongodb.com/cloud/atlas/register/?utm_campaign=devrel&utm_source=cross-post&utm_medium=cta&utm_content=https%3A%2F%2Fgithub.com%2Fmongodb-developer%2FGenAI-Showcase%2Fedit%2Fmain%2Ftools%2Fembeddings_generator%2FREADME.md&utm_term=apoorva.joshi) a MongoDB Atlas account, and  [deploy](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/) a free MongoDB Atlas cluster.

* Get the connection string for your database deployment on the free cluster. See instructions to do this [here](https://www.mongodb.com/docs/guides/atlas/connection-string/).

* If you want to use OpenAI or Cohere to generate embeddings, you'll need an API key.
    * To obtain an OpenAI API key, follow the instructions [here](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)
    * For Cohere, you just need to [sign up](https://dashboard.cohere.com/welcome/register) to get a free trial API key

## Getting Started

* Clone this repo and navigate to the tool folder

```
git clone https://github.com/mongodb-developer/GenAI-Showcase.git
cd GenAI-Showcase/tools/embeddings_generator
```

* Create and activate a Python virtual environment
This ensures that the dependencies for this project don't interfere with your global Python installation.

```
pip install virtualenv
virtualenv venv
source venv/bin/activate
```

* Install the project dependencies

```
pip install -r requirements.txt
```

* To check that everything was properly installed run the tool with the `--help` flag

```console
$ python create_embeddings.py --help

Usage: create_embeddings.py [-h] --path PATH --type TYPE --field FIELD --uri URI [--db DB] [--coll COLL]

Options:
  -h, --help     show this help message and exit
  --path PATH    Path to csv file containing the data.
  --type TYPE    Provider to generate embeddings. One of openai, cohere or huggingface.
  --field FIELD  Field in the csv to generate embeddings for.
  --uri URI      MongoDB connection string.
  --db DB        Field in the csv to generate embeddings for.
  --coll COLL    Field in the csv to generate embeddings for.
```

**NOTE:** This script only generates embeddings for a single field in the dataset. This is primarily because these embeddings are meant to be used for Vector Search and Vector Search indexes in MongoDB Atlas can only be created on a single embedding field. When picking the embedding field, choose the one that makes the most sense for semantic search-- usually the more descriptive the content, the better.

## Usage

* To generate embeddings using the OpenAI model, run the following command:

```
python create_embeddings.py --path PATH_TO_YOUR_DATA --type openai --field FIELD_TO_EMBED --uri YOUR_MONGODB_CONNECTION_STRING
```

Paste your OpenAI API key when prompted.

* To generate embeddings using the Cohere model, run the following command:

```
python create_embeddings.py --path PATH_TO_YOUR_DATA --type cohere --field FIELD_TO_EMBED --uri YOUR_MONGODB_CONNECTION_STRING
```

Paste your Cohere API key when prompted.

* To generate embeddings using the open-source Hugging Face model, run the following command:

```
python create_embeddings.py --path PATH_TO_YOUR_DATA --type huggingface --field FIELD_TO_EMBED --uri YOUR_MONGODB_CONNECTION_STRING
```

### Sample Output

Here's a sample console output from running the script:

```console
$ python create_embeddings.py --path "/Users/apoorva.joshi/Downloads/data.csv" --type openai --field text --uri "mongodb+srv://username:password@cluster.net/?retryWrites=true&w=majority&appName=Cluster1"

Enter your OpenAI API key.
2024-03-05 16:09:24,331 INFO: HTTP Request: GET https://api.openai.com/v1/models "HTTP/1.1 200 OK"
2024-03-05 16:09:24,337 INFO: Loading the dataset...
2024-03-05 16:09:24,343 INFO: Generating embeddings...
  0%|                                                                                                                                                                                                                                                                                                                                               | 0/1 [00:00<?, ?it/s]2024-03-05 16:09:24,512 INFO: HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
100%|███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 1/1 [00:00<00:00,  5.22it/s]
2024-03-05 16:09:24,546 INFO: Ingesting data into MongoDB
2024-03-05 16:09:24,597 ERROR: Connection to MongoDB successful.
2024-03-05 16:09:25,577 INFO: Inserted 5 documents into MongoDB.
```
