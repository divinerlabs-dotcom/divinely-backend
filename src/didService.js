const DID_API_KEY = process.env.DID_API_KEY;
const DID_BASE = 'https://api.d-id.com';

// Upload image to D-ID and get image URL
async function uploadImageToDID(imageBuffer, fileName) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('image', imageBuffer, { filename: fileName, contentType: 'image/jpeg' });

  const response = await fetch(`${DID_BASE}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${DID_API_KEY}`,
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D-ID image upload failed: ${err}`);
  }

  const data = await response.json();
  return data; // { url, id }
}

// Create a talking video from image URL and text
async function createTalkingVideo(sourceUrl, text, voiceId = 'en-US-JennyNeural') {
  const response = await fetch(`${DID_BASE}/talks`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${DID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_url: sourceUrl,
      script: {
        type: 'text',
        input: text,
        provider: {
          type: 'microsoft',
          voice_id: voiceId
        }
      },
      config: {
        fluent: true,
        pad_audio: 0
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D-ID talk creation failed: ${err}`);
  }

  const data = await response.json();
  return data; // { id, status }
}

// Poll for video completion
async function getTalkStatus(talkId) {
  const response = await fetch(`${DID_BASE}/talks/${talkId}`, {
    headers: {
      'Authorization': `Basic ${DID_API_KEY}`
    }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D-ID status check failed: ${err}`);
  }

  return await response.json(); // { status, result_url }
}

module.exports = { uploadImageToDID, createTalkingVideo, getTalkStatus };
