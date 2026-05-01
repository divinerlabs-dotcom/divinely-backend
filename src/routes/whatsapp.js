// Divinely — WhatsApp Parse Route (Phase 3)
// POST /api/whatsapp/parse
// Accepts raw WhatsApp .txt export, returns behavioral profile

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parseWhatsAppChat } = require('../parsers/whatsappParser');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max for chat export
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt WhatsApp export files are accepted'));
    }
  },
});

// POST /api/whatsapp/parse
// Body: multipart with file (.txt) + deceasedName (string)
router.post('/parse', upload.single('chatFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No WhatsApp .txt file provided' });
    }

    const deceasedName = req.body.deceasedName;
    if (!deceasedName) {
      return res.status(400).json({ error: 'deceasedName is required' });
    }

    const rawText = req.file.buffer.toString('utf-8');

    if (rawText.length < 100) {
      return res.status(400).json({ error: 'Chat file appears to be empty or too small' });
    }

    const result = parseWhatsAppChat(rawText, deceasedName);

    if (result.error) {
      return res.status(422).json({
        error: result.error,
        availableSenders: result.availableSenders,
        hint: 'Use the exact name as it appears in the WhatsApp chat',
      });
    }

    console.log(`[WhatsApp] Parsed ${result.deceasedMessageCount} messages for "${deceasedName}"`);

    res.json({
      success: true,
      summary: {
        deceasedName: result.deceasedName,
        totalMessages: result.totalMessages,
        deceasedMessages: result.deceasedMessageCount,
        meetsMinimum: result.deceasedMessageCount >= 500,
        qualityNote: result.deceasedMessageCount >= 1000
          ? 'Excellent — high fidelity clone possible'
          : result.deceasedMessageCount >= 500
          ? 'Good — minimum met for fine-tuning'
          : `Need ${500 - result.deceasedMessageCount} more messages for fine-tuning`,
      },
      metadata: result.metadata,
      // Only return first 100 messages in response (full set saved separately)
      sampleMessages: result.messages.slice(0, 100),
      fullMessageCount: result.messages.length,
    });

  } catch (err) {
    console.error('[WhatsApp Parse Error]', err);
    res.status(500).json({ error: 'Failed to parse WhatsApp file' });
  }
});

// POST /api/whatsapp/parse-text
// Accepts raw text directly (for testing)
router.post('/parse-text', express.json(), async (req, res) => {
  const { rawText, deceasedName } = req.body;

  if (!rawText || !deceasedName) {
    return res.status(400).json({ error: 'rawText and deceasedName required' });
  }

  const result = parseWhatsAppChat(rawText, deceasedName);
  res.json(result);
});

module.exports = router;
