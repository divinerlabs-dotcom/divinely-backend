// Divinely Phase 5 — Voice Pipeline Route
// Full pipeline: User message → LLM → Fish Audio TTS → S3 → App
// POST /api/voice/respond

const express = require('express');
const router = express.Router();
const { generateChatResponse } = require('../llmService');
const { generateSpeech, detectEmotion } = require('../fishAudioService');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, BUCKET_NAME } = require('../utils/s3Client');

/**
 * POST /api/voice/respond
 * Main voice pipeline:
 * 1. Get user message
 * 2. Generate LLM text response in deceased's style
 * 3. Convert to speech with Fish Audio using cloned voice
 * 4. Return audio URL + text for display
 */
router.post('/respond', express.json(), async (req, res) => {
  try {
    const {
      userId,
      userMessage,
      voiceModelId,        // Fish Audio model ID from onboarding
      conversationHistory, // Array of {role, content} objects
      memorialProfile,     // Deceased's profile from S3
    } = req.body;

    if (!userId || !userMessage || !voiceModelId) {
      return res.status(400).json({
        error: 'userId, userMessage, and voiceModelId are required'
      });
    }

    console.log(`\n[Voice Pipeline] User: "${userMessage}"`);
    const startTime = Date.now();

    // Step 1 — Generate text response via LLM
    const llmResponse = await generateChatResponse(
      userMessage,
      memorialProfile || { deceasedName: 'zzain41', questionnaire: {}, metadata: {} },
      conversationHistory || []
    );

    console.log(`[Voice Pipeline] LLM: "${llmResponse.text}" (${Date.now() - startTime}ms)`);

    // Step 2 — Detect emotion for natural voice
    const emotion = detectEmotion(llmResponse.text);

    // Step 3 — Convert to speech with cloned voice
    const audioResult = await generateSpeech(
      llmResponse.text,
      voiceModelId,
      { emotion, userId, format: 'mp3' }
    );

    const totalTime = Date.now() - startTime;
    console.log(`[Voice Pipeline] Complete in ${totalTime}ms`);

    res.json({
      success: true,
      response: {
        text: llmResponse.text,
        audioUrl: audioResult.playbackUrl,
        emotion,
        s3Key: audioResult.s3Key,
      },
      metrics: {
        totalMs: totalTime,
        llmTokens: llmResponse.tokensUsed,
        audioBytes: audioResult.byteCount,
        estimatedCost: {
          llm: llmResponse.estimatedCost,
          audio: audioResult.estimatedCost,
        },
      },
    });

  } catch (err) {
    console.error('[Voice Pipeline Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice/clone
 * Clone voice from uploaded audio files
 * Called once during onboarding
 */
router.post('/clone', express.json(), async (req, res) => {
  try {
    const { userId, speakerName, audioS3Keys } = req.body;

    if (!userId || !audioS3Keys || audioS3Keys.length === 0) {
      return res.status(400).json({ error: 'userId and audioS3Keys required' });
    }

    // Download audio files from S3 to temp directory
    const os = require('os');
    const fs = require('fs');
    const tempFiles = [];

    for (const s3Key of audioS3Keys) {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      }));
      
      const tempPath = `${os.tmpdir()}/${Date.now()}.mp3`;
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      fs.writeFileSync(tempPath, Buffer.concat(chunks));
      tempFiles.push(tempPath);
    }

    // Clone voice with Fish Audio
    const { cloneVoice } = require('../fishAudioService');
    const result = await cloneVoice(tempFiles, speakerName || 'Memorial Voice');

    // Clean up temp files
    tempFiles.forEach(f => fs.unlinkSync(f));

    res.json({
      success: true,
      voiceModelId: result.modelId,
      message: 'Voice cloned successfully. Save this voiceModelId for TTS calls.',
    });

  } catch (err) {
    console.error('[Voice Clone Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice/text-only
 * Returns only text response — no TTS
 * Used for chat screen (voice is optional)
 */
router.post('/text-only', express.json(), async (req, res) => {
  try {
    const { userId, userMessage, conversationHistory, memorialProfile } = req.body;

    if (!userId || !userMessage) {
      return res.status(400).json({ error: 'userId and userMessage required' });
    }

    const llmResponse = await generateChatResponse(
      userMessage,
      memorialProfile || { deceasedName: 'zzain41', questionnaire: {}, metadata: {} },
      conversationHistory || []
    );

    res.json({
      success: true,
      response: {
        text: llmResponse.text,
        emotion: detectEmotion(llmResponse.text),
      },
      metrics: {
        tokensUsed: llmResponse.tokensUsed,
        estimatedCost: llmResponse.estimatedCost,
      },
    });

  } catch (err) {
    console.error('[Text Only Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Audio generation endpoint - returns MP3 file directly
router.post('/speak', async (req, res) => {
  try {
    const { text, userId, voiceModelId } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
    const FISH_MODEL_ID = voiceModelId || process.env.FISH_AUDIO_MODEL_ID;

    const ttsResponse = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text,
        format: 'mp3',
        latency: 'normal',
        reference_id: FISH_MODEL_ID,
      })
    });

    if (!ttsResponse.ok) {
      const err = await ttsResponse.text();
      return res.status(500).json({ error: 'TTS failed', detail: err });
    }

    // Stream audio directly to app
    res.set({ 'Content-Type': 'audio/mpeg' });
    const arrayBuffer = await ttsResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);

  } catch (error) {
    console.error('[Voice] Speak failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// GET version of speak endpoint for FileSystem.downloadAsync compatibility
router.get('/speak', async (req, res) => {
  try {
    const { text, userId, voiceModelId } = req.query;
    if (!text) return res.status(400).json({ error: 'text required' });

    const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
    const FISH_MODEL_ID = voiceModelId || process.env.FISH_AUDIO_MODEL_ID;

    const ttsResponse = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text,
        format: 'mp3',
        latency: 'normal',
        reference_id: FISH_MODEL_ID,
      })
    });

    if (!ttsResponse.ok) {
      const err = await ttsResponse.text();
      return res.status(500).json({ error: 'TTS failed', detail: err });
    }

    res.set({ 'Content-Type': 'audio/mpeg' });
    const arrayBuffer = await ttsResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);

  } catch (error) {
    console.error('[Voice] GET Speak failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/video/simli-token - Get Simli session token for video avatar
router.get('/simli-token', async (req, res) => {
  try {
    const { faceId } = req.query;
    const SIMLI_API_KEY = process.env.SIMLI_API_KEY;
    const SIMLI_FACE_ID = faceId || process.env.SIMLI_FACE_ID;

    const response = await fetch('https://api.simli.ai/compose/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-simli-api-key': SIMLI_API_KEY,
      },
      body: JSON.stringify({
        faceId: SIMLI_FACE_ID,
        audioFormat: 'pcm16',
        audioSampleRate: 16000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Simli token failed', detail: err });
    }

    const data = await response.json();
    res.json({ success: true, session_token: data.session_token, faceId: SIMLI_FACE_ID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
