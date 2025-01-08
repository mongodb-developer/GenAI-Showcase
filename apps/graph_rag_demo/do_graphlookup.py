from pymongo import MongoClient
from pprint import pprint
import os
from dotenv import load_dotenv

load_dotenv()
def graph_lookup(node_name,max_depth):

    graph_lookup_docs = []
    try:
        uri = os.getenv("ATLAS_CONNECTION_STRING")
        client = MongoClient(uri)
        database = client["langchain_db"]
        collection = database["nodes_relationships"]
        pipeline = [
        {
            '$match': {
                '_id': node_name
            }
        }, {
            '$graphLookup': {
                'from': 'nodes_relationships', 
                'startWith': '$_id', 
                'connectFromField': 'relationships', 
                'connectToField': '_id', 
                'as': 'relates_to', 
                'maxDepth': max_depth, 
                'depthField': 'distance', 
                'restrictSearchWithMatch': {}
            }
        }
        ]
        cursor = collection.aggregate(pipeline)
        for doc in cursor:
            graph_lookup_docs.append(doc)
    except Exception as e:
        print(e)
    finally:
        client.close()
    pprint(graph_lookup_docs)
    return graph_lookup_docs