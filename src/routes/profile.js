const express = require('express');
const router = express.Router();

// Store profiles in memory (replace with DynamoDB in production)
const profiles = {};

router.post('/create', async (req, res) => {
  try {
    const {
      userId, deceasedName, calledBy, relationship, birthYear, passedYear,
      religion, language, personality, topics, speech, phrases, beliefs, advice, memories
    } = req.body;

    if (!userId || !deceasedName) {
      return res.status(400).json({ error: 'userId and deceasedName are required' });
    }

    const profileId = `${userId}_${Date.now()}`;
    const profile = {
      id: profileId,
      userId,
      deceasedName,
      calledBy: calledBy || 'jaan',
      relationship: relationship || 'loved one',
      birthYear,
      passedYear,
      religion: religion || 'Islam',
      language: language || 'Urdu/English',
      personality,
      topics,
      speech,
      phrases,
      beliefs,
      advice,
      memories,
      createdAt: new Date().toISOString()
    };

    profiles[profileId] = profile;

    console.log(`[Profile] Created memorial for ${deceasedName} (${userId})`);

    res.json({
      success: true,
      profileId,
      message: `Memorial created for ${deceasedName}`,
      profile
    });

  } catch (error) {
    console.error('[Profile] Create failed:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/list/:userId', (req, res) => {
  const { userId } = req.params;
  const userProfiles = Object.values(profiles).filter(p => p.userId === userId);
  res.json({ profiles: userProfiles });
});

router.get('/:profileId', (req, res) => {
  const profile = profiles[req.params.profileId];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

module.exports = router;
