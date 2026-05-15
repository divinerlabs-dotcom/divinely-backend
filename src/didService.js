const DID_API_KEY = process.env.DID_API_KEY;
const DID_BASE = 'https://api.d-id.com';

// Upload image buffer to D-ID
async function uploadImageToDID(imageBuffer, fileName) {
  const Blob = (await import('node:buffer')).Blob;
  
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  formData.append('image', blob, fileName || 'profile.jpg');

  const response = await fetch(`${DID_BASE}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${DID_API_KEY}`,
    },
    body: formData
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
  return data;
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

  return await response.json();
}

module.exports = { uploadImageToDID, createTalkingVideo, getTalkStatus };
