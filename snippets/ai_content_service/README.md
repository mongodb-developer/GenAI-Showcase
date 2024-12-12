# Building a Secure AI Content Service

With multiple teams building GenAI applications, we are seeing several organizations adopt a central content/data model, where a single repository of information serves as the knowledge base for all internal AI applications across the company.

While this centralized approach creates a single source of truth for all applications, it also increases the risk of data exposure if any of these applications get compromised. One way to mitigate this risk is to enforce the principle of least privilege (PoLP), giving applications only the minimum permissions required.

Assuming you are using MongoDB to create the central knowledge base for your content service, let's explore how you can adopt PoLP in MongoDB using the document model itself.

## Defining document-level access controls

When modeling data in MongoDB, we advise keeping as much as possible in the same collection, to avoid data duplication and optimize storage costs. For the content service, you can in theory store all your documents in a single collection and distinguish between the document types using a list of tags, such as `public`, `internal`, `code`, `hr` etc. These tags can then be used to define document-level access controls per application.

For example, you can create a `permissions` collection with documents that look as follows:

```
{
  "api_key": "app_api_key",
  "name": "app_name",
  "tags": ["public", "internal"]
}
```

Each document contains:
* `api_key`: An API key which is how applications will authenticate to our content service
* `name`: Application name
* `tags`: Documents, identified by tags, that the application has access to.

## Enforcing access controls

Once you have defined the document-level access controls, you need a way to authenticate an application and enforce the defined access controls in your content service.

There are several ways to authenticate application requests in your service- we have chosen API keys, but you can use other mechanisms such as JSON Web Tokens (JWTs)

An example application request then looks as follows:

```
curl -X POST "https://api.contentservice.com/data/docs" \
     -H "X-API-Key: your_api_key_here" \
     -H "Content-Type: application/json" \
     -d '{"search": "What is the travel reimbursement policy for MongoDB?"}'
```

The context service should have middleware to verify the API key and fetch the permissions document from the `permissions` collection using the API key. It can then use the tags in the document as pre-filters for the search query while retrieving documents from the MongoDB knowledge base.

Here's an example of how to do that in an API built using FastAPI:

```
from fastapi import FastAPI, Depends, HTTPException, Request, status
from pymongo import MongoClient

client = MongoClient("your_connection_string")
db = client["db_name"]
knowledge_base = db["coll_name"]
permissions_coll = db["permissions"]

app = FastAPI()

# Authenticate the API key and retrieve the permissions document
def get_permissions(request: Request) -> Dict:
    # Extract API key from headers
    api_key = request.headers.get("X-API-Key")

    if not api_key:
        raise HTTPException(
            status_code=403, 
            detail="API key missing"
        )

    # Lookup the API key in the database to get app permissions
    app_permissions = permissions_coll.find_one({"api_key": api_key})

    if not app_permissions:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )

    return app_permissions

# Retrieve documents that the app has permissions for
def get_documents_with_permissions( 
    app_permissions: Dict
) -> Dict:
    # Build query filter based on allowed tags
    allowed_tags = app_permissions.get("allowed_tags", [])
    query_filter = {"access_tags": {"$in": allowed_tags}}

    # Vector search pipeline with pre-filter
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_SEARCH_INDEX_NAME,
                "path": "embeddings",
                "queryVector": query_embedding,
                "numCandidates": 150,
                "limit": 5,
                "filter": filter,
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    # Execute the aggregation pipeline
    results = knowledge_base.aggregate(pipeline)
    return results

@app.get("/data/docs")
# Declare dependencies for a route or function
def get_data(app_permissions: Dict = Depends(get_permissions)):
    try:
        documents = get_documents_with_permissions(app_permissions)
        return {"data": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```
