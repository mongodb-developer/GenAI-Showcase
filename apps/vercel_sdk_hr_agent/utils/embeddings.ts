
  import { voyage } from 'voyage-ai-provider';
  import { embedMany } from 'ai';

  const embeddingModel = voyage.textEmbeddingModel('voyage-3');

  export const generateEmbeddings = async (
    value: string,
 ): Promise<Array<{ embedding: number[]; content: string }>> => {
    // Generate chunks from the input value
    const chunks = value.split('\n');

    const { embeddings } = await embedMany({
     model: embeddingModel,
     values: chunks,
    });

   return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
 };
