import { NextRequest, NextResponse } from 'next/server';
import { bedrock } from '@/lib/bedrock';
import { generateText } from 'ai';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const documents = data.documents;

    if (!Array.isArray(documents)) {
      return NextResponse.json({ error: 'Invalid input. Expected an array of documents.' }, { status: 400 });
    }

    const sentiments = await Promise.all(
      documents.map(async (doc) => {
        try {
          const { text } = await generateText({
            model: bedrock('aanthropic.claude-3-5-sonnet-20241022-v2:0'),
            prompt: `Analyze the sentiment of the following text and respond with only one word: "positive", "negative", or "neutral". Text: "${doc}"`,
          });
          return text.trim().toLowerCase();
        } catch (error) {
          console.error('Error analyzing individual document:', error);
          return 'error';
        }
      })
    );

    return NextResponse.json({ sentiments });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return NextResponse.json({ error: 'An error occurred while analyzing sentiment.' }, { status: 500 });
  }
}

