import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

// Initialize the Amazon Bedrock client with explicit credentials
export const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

