// Phase 7 — Ethical Safeguards
// Enforces usage limits, cooldowns, and psychological warnings

const usageStore = {}; // In-memory store (replace with DynamoDB in production)

const LIMITS = {
  videoMinutesPerMonth: 20,
  voiceMinutesPerMonth: 30,
  sessionWarningMinutes: 10,
  cooldownHours: 24,
};

const WARNINGS = [
  "You've been talking for a while. Remember to take care of yourself. 💙",
  "Grief takes time. It's okay to step away and rest.",
  "This is an AI simulation. Connecting with friends and family can also help.",
  "Your wellbeing matters. Consider taking a short break.",
];

// Get or create user usage record
function getUserUsage(userId) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  if (!usageStore[userId]) {
    usageStore[userId] = {};
  }
  if (!usageStore[userId][monthKey]) {
    usageStore[userId][monthKey] = {
      videoMinutes: 0,
      voiceMinutes: 0,
      sessionStart: null,
      lastSession: null,
      cooldownUntil: null,
    };
  }
  return usageStore[userId][monthKey];
}

// Check if user can start a video session
function canStartVideo(userId) {
  const usage = getUserUsage(userId);
  const now = new Date();

  // Check cooldown
  if (usage.cooldownUntil && now < new Date(usage.cooldownUntil)) {
    const hoursLeft = Math.ceil((new Date(usage.cooldownUntil) - now) / 3600000);
    return {
      allowed: false,
      reason: `cooldown`,
      message: `You've reached your limit. Please rest and return in ${hoursLeft} hours. 💙`,
    };
  }

  // Check monthly cap
  if (usage.videoMinutes >= LIMITS.videoMinutesPerMonth) {
    return {
      allowed: false,
      reason: `monthly_cap`,
      message: `You've used your 20 minutes of video this month. This limit protects your wellbeing.`,
    };
  }

  return { allowed: true, remainingMinutes: LIMITS.videoMinutesPerMonth - usage.videoMinutes };
}

// Record video usage and check for warnings
function recordVideoUsage(userId, minutesUsed) {
  const usage = getUserUsage(userId);
  usage.videoMinutes += minutesUsed;
  usage.lastSession = new Date().toISOString();

  // Trigger cooldown if cap reached
  if (usage.videoMinutes >= LIMITS.videoMinutesPerMonth) {
    const cooldownUntil = new Date();
    cooldownUntil.setHours(cooldownUntil.getHours() + LIMITS.cooldownHours);
    usage.cooldownUntil = cooldownUntil.toISOString();
  }

  return usage;
}

// Get wellbeing warning based on session duration
function getWellbeingWarning(sessionMinutes) {
  if (sessionMinutes < LIMITS.sessionWarningMinutes) return null;
  const index = Math.floor(sessionMinutes / 10) % WARNINGS.length;
  return WARNINGS[index];
}

// Get usage summary for a user
function getUsageSummary(userId) {
  const usage = getUserUsage(userId);
  return {
    videoMinutesUsed: usage.videoMinutes,
    videoMinutesRemaining: Math.max(0, LIMITS.videoMinutesPerMonth - usage.videoMinutes),
    voiceMinutesUsed: usage.voiceMinutes,
    cooldownUntil: usage.cooldownUntil,
    limits: LIMITS,
  };
}

module.exports = {
  canStartVideo,
  recordVideoUsage,
  getWellbeingWarning,
  getUsageSummary,
};
