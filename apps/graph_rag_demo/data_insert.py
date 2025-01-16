from langchain_core.documents import Document
from langchain_community.graphs.graph_document import GraphDocument, Node, Relationship
from pymongo import MongoClient
from dotenv import load_dotenv
from pprint import pprint
import os
import json
from nodes_relationships import nodes,links

def build_lookup_map():
    quick_lookup = {}
    for key in links.keys():
        relationship = links[key]
        source_node = relationship.source
        lookup_key = str(source_node.id)+":"+str(source_node.type)
        lookup_content = quick_lookup.get(lookup_key,"empty")
        if lookup_content != "empty":
            quick_lookup.get(lookup_key).append(relationship)
        else:
            quick_lookup[lookup_key] = [relationship]
    return quick_lookup

def create_mongo_documents():
    mongo_documents = []
    quick_lookup = build_lookup_map()
    for key in nodes.keys():
        node = nodes[key]
        id = str(node.id)+":"+str(node.type)
        type = node.type
        rel = quick_lookup.get(id,None)
        relationships = set()
        targets = {}
        if rel!=None:
            for relationship in rel:
                target_id = str(relationship.target.id)+":"+str(relationship.target.type)
                relationships.add(target_id)
                target_type = targets.get(target_id,None)
                if target_type != None:
                    targets[target_id].append(relationship.type)
                else:
                    targets[target_id] = [relationship.type]
            mongo_documents.append({"_id":id,"type":type,"relationships":list(relationships),"targets":targets})
        else:
            mongo_documents.append({"_id":id,"type":type,"relationships":[],"targets":{}})
    return mongo_documents

def mongo_insert():
    mongo_documents = create_mongo_documents()
    try:
        uri = os.getenv("ATLAS_CONNECTION_STRING")
        print(uri)
        client = MongoClient(uri)
        database = client["langchain_db"]
        collection = database["nodes_relationships"]
        for doc in mongo_documents:
            collection.insert_one(doc)
    except Exception as e:
        print(e)
    finally:
        client.close()
if __name__=="__main__":
    load_dotenv()
    print("Inserting Documents")
    mongo_insert()
    print("Successfully Inserted Documents")