const fetch = require('node-fetch');

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

// Create a Simli session for real-time video avatar
async function createSimliSession(faceId) {
  const response = await fetch('https://api.simli.ai/startAudioToVideoSession', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: SIMLI_API_KEY,
      faceId: faceId,
      syncAudio: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Simli session failed: ${error}`);
  }

  return await response.json();
}

// Send audio chunk to Simli for lip-sync video
async function sendAudioToSimli(sessionToken, audioBase64) {
  const response = await fetch('https://api.simli.ai/sendAudio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_token: sessionToken,
      audio: audioBase64,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Simli audio send failed: ${error}`);
  }

  return await response.json();
}

// Get available Simli faces
async function getSimliFaces() {
  const response = await fetch('https://api.simli.ai/faces', {
    headers: {
      'x-simli-api-key': SIMLI_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Simli faces failed: ${error}`);
  }

  return await response.json();
}

module.exports = { createSimliSession, sendAudioToSimli, getSimliFaces };
