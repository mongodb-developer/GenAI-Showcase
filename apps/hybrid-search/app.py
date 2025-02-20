from flask import Flask, request, jsonify
import os
from flask_pymongo import PyMongo
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI

app = Flask(__name__)
app.app_context()
app.config['DEBUG'] = True
app.config['MONGO_URI'] = os.getenv('ATLAS_URL')
client = PyMongo(app).cx['langchain']
openai = OpenAI()



@app.route("/generate", methods=["POST"])
def generateEmbeddings():
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200, add_start_index=True)
    for file in os.listdir('./finacialstatements'):
        loader = PyPDFLoader(f'./finacialstatements/{file}')
        docs = loader.load()
        splits = text_splitter.split_documents(docs)
        i = 0
        docs = []
        for split in splits:
            vector = openai.embeddings.create(input = [str(split.page_content)], model="text-embedding-3-small").data[0].embedding
            dbDoc = {
                'content': split.page_content,

                'vectors': vector,
                'metadata': {
                    'page': split.metadata.get('page'),
                    'start_index': split.metadata.get('start_index'),
                    'fileName': file
                }
            }
            docs.append(dbDoc)
            i += 1
            if i % 20 == 0:
                client.financial_statements.insert_many(docs)
                docs = []
        client.financial_statements.insert_many(docs)
    return jsonify({"results" "Docs successfully parsed and loaded"})


@app.route('/', methods=["POST"])
def getAnswers():
    data = request.get_json()
    prompt = data.get('prompt')
    company = data.get('company')
    pageNum = data.get('pageNum')
    vcWeight = data.get('vectorWeight')
    textWeight = data.get('textWeight')
    textBoost = data.get('textBoost')

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    promptEmbedding = embeddings.embed_query(prompt)
    if company:
        vectorWeight = vcWeight if vcWeight else 0.9
        fullTextWeight = textWeight if textWeight else 0.1
        textBoostValue = textBoost if textBoost else 1

        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "vectors",
                    "queryVector": promptEmbedding,
                    "numCandidates": 100,
                    "limit": 20
                }
            }, {
                "$group": {
                    "_id": None,
                    "docs": {"$push": "$$ROOT"}
                }
            }, {
                "$unwind": {
                    "path": "$docs",
                    "includeArrayIndex": "rank"
                }
            }, {
                "$addFields": {
                    "vs_score": {
                        "$multiply": [
                            vectorWeight, {
                                "$divide": [
                                    1.0, {
                                        "$add": ["$rank", 60]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }, {
                "$project": {
                    "vs_score": 1,
                    "_id": "$docs._id",
                    "content": "$docs.content",
                    "metadata": "$docs.metadata"
                }
            }, {
                "$unionWith": {
                    "coll": "financial_statements",
                    "pipeline": [
                        {
                            "$search": {
                                "index": "rrf-full-text-search",
                                "text": {
                                    "query": company,
                                    "path": "metadata.fileName",
                                    "score": { "boost": { "value": textBoostValue } }
                                }
                            }
                        }, {
                            "$limit": 20
                        }, {
                            "$group": {
                                "_id": None,
                                "docs": {"$push": "$$ROOT"}
                            }
                        }, {
                            "$unwind": {
                                "path": "$docs",
                                "includeArrayIndex": "rank"
                            }
                        }, {
                            "$addFields": {
                                "fts_score": {
                                    "$multiply": [
                                        fullTextWeight, {
                                            "$divide": [
                                                1.0, {
                                                    "$add": ["$rank", 60]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$project": {
                                "fts_score": 1,
                                "_id": "$docs._id",
                                "content": "$docs.content",
                                "metadata": "$docs.metadata"
                            }
                        }
                    ]
                }
            }, {
                "$group": {
                    "_id": "$_id",
                    "metadata": {"$first": "$metadata"},
                    "content": {"$first": "$content"},
                    "vs_score": {"$max": "$vs_score"},
                    "fts_score": {"$max": "$fts_score"}
                }
            }, {
                "$project": {
                    "_id": 1,
                    "content": 1,
                    "metadata": 1,
                    "vs_score": {"$ifNull": ["$vs_score", 0]},
                    "fts_score": {"$ifNull": ["$fts_score", 0]}
                }
            }, {
                "$project": {
                    "score": {"$add": ["$fts_score", "$vs_score"]},
                    "_id": 1,
                    "content": 1,
                    "metadata": 1,
                    "vs_score": 1,
                    "fts_score": 1
                }
            },
            {"$sort": {"score": -1}},
            {"$limit": 10}
        ]
    else:
        pipeline = [
            {
                '$vectorSearch': {
                    'queryVector': promptEmbedding,
                    'path': "vectors",
                    'numCandidates': 100,
                    'index': "vector_index",
                    'limit': 20,
                    'exact': False
                }
            },
            {
                '$project': { 'page': 1, 'content':1, 'metadata': 1}
            }
        ]
    if pageNum:
        pipeline[0].get('$vectorSearch')['filter'] = {'metadata.page': {'$lte': pageNum}}

    results = client.financial_statements.aggregate(pipeline)

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True)


