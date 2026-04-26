async function testKey() {
  const apiKey = 'AIzaSyBEynD8cZyjaOvAK04enoFmjsNuje1Blyk';
  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: "Oi" }] }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (response.ok) {
      console.log('SUCCESS: A chave é válida!');
    } else {
      console.error('ERROR: A chave parece inválida ou sem saldo:', JSON.stringify(data));
    }
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
  }
}

testKey();
