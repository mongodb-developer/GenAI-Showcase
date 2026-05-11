import { describe, it, expect } from 'vitest';

const API_KEY = process.env.MINIMAX_API_KEY;
const BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';

describe.skipIf(!API_KEY)('MiniMax Integration', () => {
  it('completes a basic chat request with MiniMax-M2.7', async () => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: 'Say "test passed" and nothing else.' }],
        max_tokens: 20,
        temperature: 1.0,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.choices[0].message.content).toBeTruthy();
  }, 30000);

  it('generates structured content analysis with MiniMax-M2.7', async () => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          {
            role: 'system',
            content: 'You are a content quality expert. Return a JSON object with readabilityScore (1-10), clarity (1-10), and suggestions (array of strings).',
          },
          {
            role: 'user',
            content: 'Evaluate the quality of this content: "MongoDB is a popular NoSQL database that stores data in flexible, JSON-like documents."',
          },
        ],
        max_tokens: 200,
        temperature: 1.0,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices[0].message.content).toBeTruthy();
  }, 30000);

  it('handles streaming responses', async () => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
        max_tokens: 50,
        stream: true,
        temperature: 1.0,
      }),
    });

    expect(response.ok).toBe(true);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text.includes('data:')) chunks++;
    }

    expect(chunks).toBeGreaterThan(1);
  }, 30000);
});
