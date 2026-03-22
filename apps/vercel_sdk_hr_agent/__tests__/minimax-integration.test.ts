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

  it('supports tool calling with MiniMax-M2.7', async () => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: 'What is the weather in San Francisco?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get the current weather for a location',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name' },
                },
                required: ['location'],
              },
            },
          },
        ],
        max_tokens: 100,
        temperature: 1.0,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    // Model should either call the tool or provide a text response
    const choice = data.choices[0];
    expect(choice.message).toBeDefined();
  }, 30000);

  it('completes a request with MiniMax-M2.7-highspeed', async () => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7-highspeed',
        messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
        max_tokens: 50,
        temperature: 1.0,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices[0].message.content).toBeTruthy();
  }, 30000);
});
