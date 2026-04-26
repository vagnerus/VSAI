import { GeminiClient } from '../src/api/geminiClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function testClient() {
  const client = new GeminiClient({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL
  });

  console.log('Testing GeminiClient streaming...');
  
  try {
    const stream = client.stream({
      messages: [{ role: 'user', content: 'Hello, are you working?' }],
      system: 'You are a helpful assistant.'
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        process.stdout.write(event.delta.text);
      }
    }
    console.log('\nSuccess!');
  } catch (error) {
    console.error('Error testing client:', error);
  }
}

testClient();
