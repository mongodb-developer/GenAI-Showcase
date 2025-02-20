from os import fsdecode
from openai import OpenAI
from langchain_community.vectorstores import MongoDBAtlasVectorSearch
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from pymongo import MongoClient
from langchain_mongodb import MongoDBAtlasVectorSearch
import os


load_dotenv()

connection = MongoClient(os.environ.get('ATLAS_URL'))
#connection = MongoClient('mongodb://localhost:27017')
db = connection.langchain
collection = db.financial_statements

openai = OpenAI()


def generate_embeddings():
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200, add_start_index=True)
    for file in os.listdir('/Users/josh.smith/Projects/demos/Lang-Chain/finacialstatements'):
        if 'Stellantis' in file:
            print('Found stellantis file so skipping to avoid reloading')
            continue
        loader = PyPDFLoader(f'/Users/josh.smith/Projects/demos/Lang-Chain/finacialstatements/{file}')
        docs = loader.load()
        splits = text_splitter.split_documents(docs)
        print(f'There are {len(splits)} to generate embeddings for file {file}')
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
                collection.insert_many(docs)
                docs = []
                print(f'Inserted 20 more rows for {i} in total')
        collection.insert_many(docs)
        print(f'Inserted final docs for {i} total')
        print(f'File {file} is complete')

    print('Finished loading vectors')


def ask_questions():
    prompt = input("What is your question? ")
    title = input("What is the company you are looking for?")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vector_store = MongoDBAtlasVectorSearch(
        collection=collection,
        embedding=embeddings,
        embedding_key='vectors',
        text_key='content',
        index_name='vector_index',
        relevance_score_fn="cosine"
    )
    promptEmbedding = embeddings.embed_query(prompt)
    #results = vector_store.similarity_search(prompt, k=2)
    # results = vector_store.similarity_search(promptEmbedding)
    pipeline = [
        {
            '$vectorSearch': {
                'queryVector': promptEmbedding,
                'path': "vectors",
                'numCandidates': 10,
                'index': "vector_index",
                'limit': 5,
                'filter': {
                    'metadata.page': {'$lte': 10}
                },
                'exact': False
            }
        },
        {
            '$project': { 'page': 1, 'content':1}
        }
    ]

    vectorWeight = 0.9
    fullTextWeight = 0.1

    hybridpipeline = [
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
                "fileName": "$docs.metadata.fileName"
            }
        }, {
            "$unionWith": {
                "coll": "financial_statements",
                "pipeline": [
                    {
                        "$search": {
                            "index": "rrf-full-text-search",
                            "phrase": {
                                "query": title,
                                "path": "metadata.fileName"
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
                            "fileName": "$docs.metadata.fileName"
                        }
                    }
                ]
            }
        }, {
            "$group": {
                "_id": "$_id",
                "fileName": {"$first": "$fileName"},
                "content": {"$first": "$content"},
                "vs_score": {"$max": "$vs_score"},
                "fts_score": {"$max": "$fts_score"}
            }
        }, {
            "$project": {
                "_id": 1,
                "fileName": 1,
                "content": 1,
                "vs_score": {"$ifNull": ["$vs_score", 0]},
                "fts_score": {"$ifNull": ["$fts_score", 0]}
            }
        }, {
            "$project": {
                "score": {"$add": ["$fts_score", "$vs_score"]},
                "_id": 1,
                "fileName": 1,
                "content": 1,
                "vs_score": 1,
                "fts_score": 1
            }
        },
        {"$sort": {"score": -1}},
        {"$limit": 10}
    ]
    results = collection.aggregate(hybridpipeline)
    for res in results:
        print(f"* {res} with content {res.content}")







if __name__=="__main__":
    ask_questions()
    #generate_embeddings()
