import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoClient } from "mongodb";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.ATLAS_CONNECTION_STRING);
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY1;

async function run() {
    try {
        await client.connect();
        console.log('Connected to MongoDB successfully');
        const database = client.db("langchain_db");
        const collection = database.collection("knowledge_graph");
        const dbConfig = {
            collection: collection,
            indexName: "vector_index", // The name of the Atlas search index to use.
            textKey: "chunks", // Field name for the raw text content. Defaults to "text".
            embeddingKey: "embedding", // Field name for the vector embeddings. Defaults to "embedding".
        };
        // Ensure that the collection is empty
        await collection.deleteMany({});
        const pdfArray = [
            './PDF_KG/Diet, Stress and Mental Healt.pdf', 
            './PDF_KG/Effect of Stress Management Interventions on Job Stress among nurses working in critical care units.pdf', 
            './PDF_KG/Factors contributing to stress among parents of children with autism.pdf',
            './PDF_KG/Level of physical activity, well-being, stress and self rated health in persons with migraine and co existing tension-type headache and neck pain.pdf',
            './PDF_KG/Stress and Blood Pr ess and Blood Pressure During Pr e During Pregnancy Racial Diff egnancy Racial Differences.pdf',
            './PDF_KG/Stress and Headache.pdf',
            './PDF_KG/THE IMPACT OF STRESSFUL LIFE EVENTS ON RELAPSE OF GENERALIZED ANXIETY DISORDER.pdf',
            './PDF_KG/where are we at with stress and headache.pdf'
        ]

        // Load and split the sample data
        pdfArray.forEach(async (pdfname) => {
            console.log("Starting sync...", pdfname);
            const loader = new PDFLoader(pdfname);
            const data = await loader.load();
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const docs = await textSplitter.splitDocuments(data);
            await MongoDBAtlasVectorSearch.fromDocuments(docs, new OpenAIEmbeddings(), dbConfig);
            console.log("Ending sync...", pdfname);
        })
    } catch (error){
        console.log(error)
    }
}
run().catch(console.dir);


