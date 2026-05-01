const express = require('express');
const router = express.Router();
const { createSimliSession } = require('../simliService');
const { canStartVideo, recordVideoUsage, getWellbeingWarning, getUsageSummary } = require('../safeguards');

const SIMLI_FACE_ID = process.env.SIMLI_FACE_ID;

// Start a Simli video session with safeguard check
router.post('/start-session', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Check usage limits
    const check = canStartVideo(userId);
    if (!check.allowed) {
      return res.status(403).json({
        error: 'usage_limit',
        reason: check.reason,
        message: check.message,
      });
    }

    const session = await createSimliSession(SIMLI_FACE_ID);

    res.json({
      success: true,
      session_token: session.session_token,
      remainingMinutes: check.remainingMinutes,
      warning: check.remainingMinutes <= 5 ? '⚠️ You have less than 5 minutes of video remaining this month.' : null,
    });
  } catch (error) {
    console.error('[Video] Session failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record usage after session ends
router.post('/end-session', async (req, res) => {
  try {
    const { userId, minutesUsed } = req.body;
    if (!userId || !minutesUsed) return res.status(400).json({ error: 'userId and minutesUsed required' });

    const usage = recordVideoUsage(userId, minutesUsed);
    const warning = getWellbeingWarning(minutesUsed);

    res.json({
      success: true,
      usage: getUsageSummary(userId),
      wellbeingMessage: warning,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get usage summary
router.get('/usage/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    res.json(getUsageSummary(userId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
