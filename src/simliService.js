const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

// Create a Simli session using new compose API
async function createSimliSession(faceId) {
  const response = await fetch('https://api.simli.ai/compose/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-simli-api-key': SIMLI_API_KEY,
    },
    body: JSON.stringify({
      faceId: faceId,
      audioFormat: 'pcm16',
      audioSampleRate: 16000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Simli session failed: ' + error);
  }

  const data = await response.json();
  return { session_token: data.session_token, success: true };
}

module.exports = { createSimliSession };
