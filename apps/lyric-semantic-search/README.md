# lyric-semantic-search
This repo is support the [Building a Semantic Search Service With Spring AI and MongoDB Atlas](https://www.mongodb.com/developer/languages/java/spring-ai-mongodb-atlas/) tutorial.

Spring AI is an application framework from [Spring](https://spring.io/) that allows you to combine various AI services and plugins with your applications. With support for many chat, text-to-image, and embedding models, you can get your AI powered Java application set up for a variety of AI use cases.

With Spring AI, MongoDB Atlas is supported as a vector database, all with [Atlas Vector Search](https://www.mongodb.com/products/platform/atlas-vector-search) to power your semantic search and implement your RAG applications. To learn more about RAG and other key concepts in AI, check out the [MongoDB AI integration docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/ai-integrations/#std-label-ai-key-concepts).

In this tutorial, we’ll go through what you need to get started with Spring AI and MongoDB. Adding documents to your database with the vectorised content (embeddings), and searching this content with semantic search. The full code for this tutorial is available in this [Github repository](https://github.com/timotheekelly/lyric-semantic-search).

## Prerequisites
Before starting this tutorial, you'll need to have the following:
- A MongoDB Atlas account and an M10+ cluster running MongoDB version 6.0.11, 7.0.2, or later.
- An OpenAI API Key with a paid OpenAI account and available credits.
- Java 21 and an IDE such as IntelliJ IDEA or Eclipse.
- Maven 3.9.6+ configured for your project.

## Application Configuration
Configure your Spring application to set up the vector store and other necessary beans. 

In our application properties, we are going to configure our MongoDB database, as well as everything we need for semantically searching our data. We'll also add in information such as our OpenAI embedding model and api key.

```
spring.application.name=lyric-semantic-search
spring.ai.openai.api-key=<Your-API-key>
spring.ai.openai.embedding.options.model=text-embedding-ada-002

spring.data.mongodb.uri=<Your-MongoDB-connection-string>
spring.data.mongodb.database=lyrics
spring.ai.vectorstore.mongodb.indexName=vector_index
spring.ai.vectorstore.mongodb.collection-name=vector_store
spring.ai.vectorstore.mongodb.initialize-schema=true
```

You'll see at the end, we are setting the initialized schema to be `true`. This means our application will set up our search index (if it doesn't exist) so we can semantically search our data. If you already have a search index set up with this name and configuration, you can set this to be `false`.

To test our embedding, let's keep it simple with a few nursery rhymes for now.

## Testing
Use the following CURL command to add sample documents:

```bash
curl -X POST "http://localhost:8080/addDocuments" \
     -H "Content-Type: application/json" \
     -d '[
            {
               "content": "Twinkle, twinkle, little star, How I wonder what you are! Up above the world so high, Like a diamond in the sky.",
               "metadata": {
                  "title": "Twinkle Twinkle Little Star",
                  "artist": "Jane Taylor",
                  "year": "1806"
               }
            },
            {
               "content": "The itsy bitsy spider climbed up the waterspout. Down came the rain and washed the spider out. Out came the sun and dried up all the rain and the itsy bitsy spider climbed up the spout again.",
               "metadata": {
                  "title": "Itsy Bitsy Spider",
                  "artist": "Traditional",
                  "year": "1910"
               }
            },
            {
               "content": "Humpty Dumpty sat on a wall, Humpty Dumpty had a great fall. All the kings horses and all the kings men couldnt put Humpty together again.",
               "metadata": {
                  "title": "Humpty Dumpty",
                  "artist": "Mother Goose",
                  "year": "1797"
               }
            }
         ]'
```

```bash
curl -X GET "http://localhost:8080/search?query=small%20celestial%20bodie&topK=5&similarityThreshold=0.8"
```

### Filter by Metadata

In order to filter our data, we need to head over to our index in MongoDB. You can do this through the Atlas UI by selecting the collection where your data is stored, and going to the search indexes. You can edit this index by selecting the three dots on the right of the index name and we will add our filter for the artist.

```json
{
  "fields": [
    {
      "numDimensions": 1536,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "path": "metadata.artist",
      "type": "filter"
    }
  ]
}
```

Use the following CURL command to try a semantic search with metadata filtering:

```bash
curl -X GET "http://localhost:8080/searchWithFilter?query=little%20star&topK=5&similarityThreshold=0.8&artist=Jane%20Taylor"
```
