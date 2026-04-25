import dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: "Hello" }] }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (response.ok) {
      console.log('SUCCESS: API is working!');
      // console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('ERROR:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('CRITICAL:', error);
  }
}

testGemini();
