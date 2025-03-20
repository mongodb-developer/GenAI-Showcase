# Hybrid Search Demo

Performs a configurable hybrid search with the ability to control the weights of the scoring as part of the reciprical rank fusion approach.

Uses a set of financial statements from major vehicle manufacturers as the source. The demo allows you to show the following items

- Benefits of vector search
- Pre-filtering on the vector side
- Hybrid search capabilities
- Ability to influence the weighting of data in the RRF approach

## Setup

Run the following commands

```shell

python -v venv venv

pip install -r requirements.txt

```

### Loading Data

MongoDB employees can use this link to download the dump file from the existing DB and use the command below to load the data
[Google Drive for Dump Files](https://drive.google.com/drive/folders/15m-7-Mp8jTZn0IP-AXvfN9pd3p1ubJh9?usp=drive_link)

```shell
mongorestore --uri="<connection string>" --db langchain --file <folder for data>

```
That will load teh existing data into your cluster and avoid you needing to make additional calls to the LLM to generate embeddings.

Others (or those wishing to use a different model) can submit a `POST` request to the `http://localhost:5000/generate` endpoint and the system will go through the process of generating embeddings on its own.







## Execute demo

The demo runs as a flask app that allows to submit API request to be able to easily change the input params and get back the results.

### Start the app

```shell

source ./venv/bin/activate

export FLASK_APP=app.py
export FLASK_ENV=development
flask run

```


To run calls you need to submit a JSON payload like the example below as a `POST` request to `http://localhost:5000`

```json
{
    "prompt": "What was combined revenue in 2022",
    "company":"Ford",
    "pageNum": 3,
    "vectorWeight": 0.2,
    "textWeight": 0.8,
    "textBoost":3
}

```

Changing the values of the weights (and the question) will allow you to show the benefits of the hybrid search.

The `pageNum` attribute is the one that is used for pre-filtering. The code does a simple `{$lte: {'metadata.page' : <variable> }}` on the vector search. It's simplistic, but it does the job of showing the benefits.
`Company` attribute is used by the Lexical search. You can choose between `Stellantis`, `GM`, or `Ford`
