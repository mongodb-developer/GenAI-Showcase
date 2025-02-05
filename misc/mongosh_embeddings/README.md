# Generate your own data using mongosh

Install a random data generator package and LangChain to create embeddings
To generate large volumes of synthetic data for development and testing, install a random data generator on the command line. In this example, we use Falso and LangchainJS

 ```bash
npm install @ngneat/falso
```
## Open AI Embeddings example

Install Open AI Langchain JS dependency
```shell
npm install @langchain/openai
```

## Connect to the MongoDB Shell

The mongoDB shell is an interactive JavaScript interface to MongoDB. You can use the MongoDB shell to quickly and easily create, query, and update data.
```
mongosh <YOUR_ATLAS_URI>
```

Run this script in the shell to generate your data
This script creates a dataset with 100 documents following the document pattern provided. Remember to replace the <OPENAI_API_KEY> with your OpenAI API key.
```js
const falso = require('@ngneat/falso');
const { OpenAIEmbeddings } = require('@langchain/openai');
async function main() {
  const data = [];
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: '<OPENAI_API_KEY>', // In Node.js defaults to process.env.OPENAI_API_KEY
    modelName: "text-embedding-3-small",
  });
// Generate data
for (let i = 0; i < 100; i++) {
  const title = falso.randMovie();
  const actor = falso.randMovieCharacter();
  const text_to_embed = `In movie ${title}, we have ${actor} as the main character.`;
  data.push({
    runtime: falso.randNumber({ min: 0, max: 200 }),
    plot: text_to_embed,
    title: title,
    lastupdated: falso.randPastDate(),
    actors: [actor, falso.randMovieCharacter(), falso.randMovieCharacter()],
    num_theaters: falso.randNumber({ min: 0, max: 1000 }),
    total_revenue: falso.randNumber({ min: 0, max: 10000 }),
    viewers: falso.randNumber({ min: 0, max: 10000 }),
    num_mflix_comments: falso.randNumber({ min: 0, max: 50 })
  });
}
  // Embed the plots
  let progress = 0;
  for (let doc of data) {
    const plot_embedding = await embeddings.embedDocuments([doc.plot]);
    doc.plot_embedding = plot_embedding[0];
    progress++;
    if (progress % 10 === 0) {
     console.log(`Embedded ${progress}% documents`);
    }
  }
  use('movie_app');
  db.embedded_movies.insertMany(data);
}
main().then(() => {
  console.log('done');
}).catch((err) => {
  console.error(err);
});
```

Edit the Highlighted JSON document to modify the data you generate.

## Cohere Embeddings example

To use cohere or any other embedding provider supported by the LangChain JS framework just swap the embeddings code:

### Install
```shell
npm install cohere-ai @langchain/cohere
```js
import { CohereEmbeddings } from "@langchain/cohere";

/* Embed queries */
const embeddings = new CohereEmbeddings({
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.COHERE_API_KEY
  batchSize: 48, // Default value if omitted is 48. Max value is 96
});

...

const plot_embedding = await embeddings.embedDocuments([doc.plot]);

```

To see the available providers list on  Langchain go [here](https://js.langchain.com/docs/integrations/text_embedding).
