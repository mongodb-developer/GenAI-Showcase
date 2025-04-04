import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Get the environment variable and connect.
connection_string = os.getenv("MONGO_URI")
connect = MongoClient(connection_string)

# Specify our database and collection.
database = connect["dublinfinder"]
collection = database["placesinfo"]

# Load in our JSON file.
with open("embedded_guinness_wine_dublin_cleaned2.json", "r") as file:
    data = json.load(file)

# Our JSON file starts with "places" so this is just making sure it fits.
if isinstance(data,dict) and "places" in data:
    places = data["places"]

# Use `insert_many` since we have 40 documents.
result = collection.insert_many(places)



