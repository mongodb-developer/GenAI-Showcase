import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

async function findAllDocuments(dbName, collectionName1, collectionName2) {
    const client = new MongoClient(process.env.ATLAS_CONNECTION_STRING, appname="devrel.showcase.apps.graph_rag_demo");
    try {
        await client.connect();
        console.log('Connected to MongoDB');

        // Access the database
        const db = client.db(dbName);

         // Access the source and destination collections
        const sourceCollection = db.collection(collectionName1);
        const destinationCollection = db.collection(collectionName2);

        // Find all documents in the source collection
        const documents = await sourceCollection.find({}, { projection: { _id: 1 } }).toArray()
        console.log(`Found ${documents.length} documents in source collection`);

        // Insert documents into the destination collection
        if (documents.length > 0) {
            for (let i = 0; i < documents.length; i++) {
                const idRepalce = documents[i]._id.replace(":", ' as a ')
                console.log(idRepalce)
                const agg = [
                    {
                      $search: {
                        index: "default",
                        text: {
                          path: "chunks",
                          query: idRepalce,
                        },
                      },
                    },
                    {
                      $addFields: {
                        tags: {
                          $cond: {
                            if: { $isArray: "$tags" },
                            then: { $concatArrays: [ "$tags", [ {tagName: documents[i]._id, score:  { $meta: "searchScore" }} ] ] },
                            else: [{tagName: documents[i]._id, score:  { $meta: "searchScore" }}]
                          }
                        }
                      }
                    },
                    {
                      $merge: {
                        into: collectionName2, 
                        whenMatched: "merge", 
                        whenNotMatched: "discard"
                      }
                    }
                ]
                const newdocuments = await destinationCollection.aggregate(agg).toArray();
                console.log('Documents copied to destination collection', newdocuments.chunks);
            }
        } else {
            console.log('No documents found in the source collection');
        }
    } catch (err) {
        console.error('Error connecting to the database or finding documents:', err);
    } finally {
        client.close();
    }
}

findAllDocuments('langchain_db', 'nodes_relationships', 'knowledge_graph').catch(console.dir);
