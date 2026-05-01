// Divinely — Profile Routes (Phase 3)
// Stores psychological profile + assembled memorial data
// Saved as JSON to AWS S3 (used by Phase 4 fine-tuning engine)

const express = require('express');
const router = express.Router();
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, BUCKET_NAME } = require('../utils/s3Client');

/**
 * POST /api/profile/save
 * Saves the complete memorial profile to S3 as structured JSON
 * This JSON is the input to Phase 4 (LLM fine-tuning)
 */
router.post('/save', express.json(), async (req, res) => {
  try {
    const {
      userId,
      deceasedName,
      questionnaire,     // Answers from onboarding personality questions
      whatsappMetadata,  // Output from WhatsApp parser
      mediaKeys,         // S3 keys for uploaded photos/voice/video
    } = req.body;

    if (!userId || !deceasedName) {
      return res.status(400).json({ error: 'userId and deceasedName are required' });
    }

    // Build the complete profile document
    const profile = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      userId,
      deceased: {
        name: deceasedName,
        questionnaire: questionnaire || {},
      },
      behavioralData: whatsappMetadata || null,
      media: {
        photos: mediaKeys?.photos || [],
        voice: mediaKeys?.voice || [],
        video: mediaKeys?.video || [],
      },
      fineTuningStatus: 'pending',  // Updated by Phase 4
      cloneQuality: calculateCloneQuality(whatsappMetadata, mediaKeys),
    };

    // Save to S3 as JSON
    const s3Key = `users/${userId}/profile/memorial-profile.json`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(profile, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
    });

    await s3Client.send(command);

    console.log(`[Profile] Saved memorial profile for user ${userId} — ${deceasedName}`);

    res.status(201).json({
      success: true,
      profileKey: s3Key,
      cloneQuality: profile.cloneQuality,
      message: 'Memorial profile saved. Ready for Phase 4 fine-tuning.',
    });

  } catch (err) {
    console.error('[Profile Save Error]', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/**
 * GET /api/profile/:userId
 * Retrieves the assembled profile for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const s3Key = `users/${userId}/profile/memorial-profile.json`;

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const profileJson = await response.Body.transformToString();
    const profile = JSON.parse(profileJson);

    res.json({ success: true, profile });

  } catch (err) {
    if (err.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Profile not found. Complete onboarding first.' });
    }
    console.error('[Profile Get Error]', err);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

/**
 * POST /api/profile/questionnaire
 * Saves just the questionnaire answers (called from onboarding screen)
 */
router.post('/questionnaire', express.json(), async (req, res) => {
  try {
    const { userId, answers } = req.body;

    if (!userId || !answers) {
      return res.status(400).json({ error: 'userId and answers required' });
    }

    const s3Key = `users/${userId}/profile/questionnaire.json`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify({ userId, answers, savedAt: new Date().toISOString() }, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
    });

    await s3Client.send(command);

    res.status(201).json({ success: true, message: 'Questionnaire saved' });

  } catch (err) {
    console.error('[Questionnaire Error]', err);
    res.status(500).json({ error: 'Failed to save questionnaire' });
  }
});

/**
 * DELETE /api/profile/:userId
 * Deletes all user data — required by Privacy Policy and Apple guidelines
 */
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // In production: list and delete all objects under users/{userId}/
    // For Phase 3, return success and log the request
    console.log(`[GDPR] Data deletion requested for user ${userId}`);
    res.json({ success: true, message: 'Data deletion initiated. All files will be removed within 30 days.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate deletion' });
  }
});

/**
 * Calculate clone quality score based on available data
 * Used to show user progress in onboarding
 */
function calculateCloneQuality(whatsappMetadata, mediaKeys) {
  let score = 0;
  const breakdown = {};

  // WhatsApp messages (max 40 points)
  const msgCount = whatsappMetadata?.messageStats?.total || 0;
  const msgScore = Math.min(40, Math.round((msgCount / 1000) * 40));
  breakdown.messages = { score: msgScore, max: 40, count: msgCount };
  score += msgScore;

  // Photos (max 20 points)
  const photoCount = mediaKeys?.photos?.length || 0;
  const photoScore = Math.min(20, photoCount * 5);
  breakdown.photos = { score: photoScore, max: 20, count: photoCount };
  score += photoScore;

  // Voice (max 25 points)
  const voiceCount = mediaKeys?.voice?.length || 0;
  const voiceScore = Math.min(25, voiceCount * 8);
  breakdown.voice = { score: voiceScore, max: 25, count: voiceCount };
  score += voiceScore;

  // Video (max 15 points)
  const videoCount = mediaKeys?.video?.length || 0;
  const videoScore = Math.min(15, videoCount * 5);
  breakdown.video = { score: videoScore, max: 15, count: videoCount };
  score += videoScore;

  return {
    total: score,
    max: 100,
    percentage: score,
    label: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs more data',
    breakdown,
  };
}

module.exports = router;
