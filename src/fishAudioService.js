// Divinely Phase 5 — Fish Audio S2 Voice Cloning Service
// Clones zzain41's voice and generates speech with emotional tags
// Cost: $15/1M bytes — enforce usage caps

const fs = require('fs');
const path = require('path');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, BUCKET_NAME } = require('./utils/s3Client');
const { v4: uuidv4 } = require('uuid');

const FISH_AUDIO_API = 'https://api.fish.audio';

// ── Emotional tags supported by Fish Audio S2 ───────────────
const EMOTION_TAGS = {
  neutral:   '',
  happy:     '[happy]',
  sad:       '[sad]',
  laughing:  '[laughing]',
  whisper:   '[whisper]',
  excited:   '[excited]',
  crying:    '[crying]',
};

/**
 * Clone a voice from uploaded audio samples
 * Called once during onboarding when user uploads voice clips
 * Returns a Fish Audio model_id for future TTS calls
 */
async function cloneVoice(audioFilePaths, speakerName, description) {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) throw new Error('FISH_AUDIO_API_KEY not set in .env');

  console.log(`[Fish Audio] Cloning voice for: ${speakerName}`);

  // Build multipart form with audio files
  const FormData = require('form-data');
  const form = new FormData();
  
  form.append('title', speakerName);
  form.append('description', description || `Divinely memorial voice — ${speakerName}`);
  form.append('visibility', 'private');
  form.append('type', 'tts');

  // Attach audio files
  for (const filePath of audioFilePaths) {
    if (fs.existsSync(filePath)) {
      form.append('voices', fs.createReadStream(filePath), {
        filename: path.basename(filePath),
        contentType: 'audio/mpeg',
      });
    }
  }

  const response = await fetch(`${FISH_AUDIO_API}/model`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fish Audio clone failed: ${error}`);
  }

  const result = await response.json();
  console.log(`[Fish Audio] Voice cloned. Model ID: ${result._id}`);
  
  return {
    modelId: result._id,
    speakerName,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate speech from text using a cloned voice
 * Supports emotional tags for more natural responses
 */
async function generateSpeech(text, modelId, options = {}) {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) throw new Error('FISH_AUDIO_API_KEY not set in .env');

  const {
    emotion = 'neutral',
    format = 'mp3',
    latency = 'normal',   // 'normal' or 'balanced'
    userId = 'anonymous',
  } = options;

  // Inject emotion tag if specified
  const emotionTag = EMOTION_TAGS[emotion] || '';
  const processedText = emotionTag ? `${emotionTag} ${text}` : text;

  console.log(`[Fish Audio] Generating speech: "${text.substring(0, 50)}..."`);
  console.log(`[Fish Audio] Emotion: ${emotion}, Model: ${modelId}`);

  const response = await fetch(`${FISH_AUDIO_API}/v1/tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: processedText,
      reference_id: modelId,
      format,
      latency,
      normalize: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fish Audio TTS failed: ${error}`);
  }

  // Get audio bytes
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const byteCount = audioBuffer.length;

  console.log(`[Fish Audio] Generated ${byteCount} bytes of audio`);

  // Save to S3
  const s3Key = `users/${userId}/voice-responses/${uuidv4()}.${format}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: audioBuffer,
    ContentType: `audio/${format}`,
    ServerSideEncryption: 'AES256',
    Metadata: {
      userId,
      modelId,
      emotion,
      textLength: String(text.length),
      byteCount: String(byteCount),
    },
  }));

  // Generate 1-hour presigned URL for playback
  const playbackUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }),
    { expiresIn: 3600 }
  );

  return {
    success: true,
    s3Key,
    playbackUrl,
    byteCount,
    emotion,
    format,
    estimatedCost: `$${((byteCount / 1_000_000) * 15).toFixed(4)}`,
  };
}

/**
 * Detect appropriate emotion from LLM response text
 * Used to automatically inject emotional tags
 */
function detectEmotion(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('haha') || lower.includes('lol') || lower.includes('😂') || lower.includes('😄')) {
    return 'laughing';
  }
  if (lower.includes('😢') || lower.includes('💔') || lower.includes('miss') || lower.includes('sad')) {
    return 'sad';
  }
  if (lower.includes('!') && (lower.includes('wow') || lower.includes('amazing') || lower.includes('great'))) {
    return 'excited';
  }
  if (lower.includes('❤️') || lower.includes('love') || lower.includes('pyar')) {
    return 'happy';
  }
  
  return 'neutral';
}

module.exports = { cloneVoice, generateSpeech, detectEmotion, EMOTION_TAGS };
