// Divinely — WhatsApp Chat Parser (Phase 3)
// Parses exported WhatsApp .txt files
// Extracts: messages, timing patterns, emoji usage, response latency

/**
 * Parse a WhatsApp exported .txt file
 * Returns structured data about the deceased person's messaging behavior
 *
 * @param {string} rawText - Raw content of WhatsApp export file
 * @param {string} deceasedName - Name of the deceased as it appears in the chat
 * @returns {object} Parsed profile with messages and behavioral metadata
 */
function parseWhatsAppChat(rawText, deceasedName) {
  const lines = rawText.split('\n').filter(line => line.trim());
  const messages = [];

  // WhatsApp export formats:
  // [DD/MM/YYYY, HH:MM:SS] Name: Message
  // MM/DD/YY, HH:MM - Name: Message
  const patterns = [
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*([^:]+):\s*(.+)$/i,
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.+)$/i,
  ];

  let currentMessage = null;

  for (const line of lines) {
    let matched = false;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        if (currentMessage) messages.push(currentMessage);

        const [, date, time, sender, text] = match;
        currentMessage = {
          date: date.trim(),
          time: time.trim(),
          sender: sender.trim(),
          text: text.trim(),
          timestamp: parseTimestamp(date.trim(), time.trim()),
        };
        matched = true;
        break;
      }
    }

    // Multi-line message continuation
    if (!matched && currentMessage) {
      currentMessage.text += '\n' + line.trim();
    }
  }

  if (currentMessage) messages.push(currentMessage);

  // Filter only deceased person's messages
  const deceasedMessages = messages.filter(msg =>
    msg.sender.toLowerCase().includes(deceasedName.toLowerCase())
  );

  if (deceasedMessages.length === 0) {
    return {
      error: `No messages found for "${deceasedName}". Check spelling matches the chat exactly.`,
      availableSenders: [...new Set(messages.map(m => m.sender))],
    };
  }

  // Build behavioral metadata
  const metadata = extractBehavioralMetadata(messages, deceasedMessages, deceasedName);

  return {
    success: true,
    deceasedName,
    totalMessages: messages.length,
    deceasedMessageCount: deceasedMessages.length,
    messages: deceasedMessages.map(m => ({
      text: m.text,
      time: m.time,
      date: m.date,
      timestamp: m.timestamp,
    })),
    metadata,
  };
}

/**
 * Extract behavioral patterns from the deceased's messages
 * Used for LLM fine-tuning context in Phase 4
 */
function extractBehavioralMetadata(allMessages, deceasedMessages, deceasedName) {
  // ── Message Length Analysis ──────────────────────────────
  const lengths = deceasedMessages.map(m => m.text.length);
  const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const shortMessages = deceasedMessages.filter(m => m.text.length < 20).length;
  const longMessages = deceasedMessages.filter(m => m.text.length > 100).length;

  // ── Emoji Extraction ─────────────────────────────────────
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
  const allEmojis = deceasedMessages.flatMap(m => m.text.match(emojiRegex) || []);
  const emojiFrequency = {};
  allEmojis.forEach(e => { emojiFrequency[e] = (emojiFrequency[e] || 0) + 1; });
  const topEmojis = Object.entries(emojiFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([emoji, count]) => ({ emoji, count }));

  // ── Favourite Phrases ────────────────────────────────────
  const words = deceasedMessages
    .flatMap(m => m.text.toLowerCase().split(/\s+/))
    .filter(w => w.length > 4 && !STOP_WORDS.includes(w));
  const wordFreq = {};
  words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const topPhrases = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  // ── Active Hours ─────────────────────────────────────────
  const hourCounts = new Array(24).fill(0);
  deceasedMessages.forEach(m => {
    if (m.timestamp) {
      const hour = new Date(m.timestamp).getHours();
      hourCounts[hour]++;
    }
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const activeHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Response Latency ─────────────────────────────────────
  const latencies = [];
  for (let i = 1; i < allMessages.length; i++) {
    const prev = allMessages[i - 1];
    const curr = allMessages[i];
    if (
      curr.sender.toLowerCase().includes(deceasedName.toLowerCase()) &&
      !prev.sender.toLowerCase().includes(deceasedName.toLowerCase()) &&
      prev.timestamp && curr.timestamp
    ) {
      const diff = (curr.timestamp - prev.timestamp) / 1000 / 60; // minutes
      if (diff > 0 && diff < 1440) latencies.push(Math.round(diff));
    }
  }
  const avgLatencyMinutes = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  // ── Tone Indicators ──────────────────────────────────────
  const questionMessages = deceasedMessages.filter(m => m.text.includes('?')).length;
  const exclamationMessages = deceasedMessages.filter(m => m.text.includes('!')).length;
  const mediaMessages = deceasedMessages.filter(m =>
    m.text.includes('<Media omitted>') || m.text.includes('image omitted')
  ).length;

  return {
    messageStats: {
      total: deceasedMessages.length,
      averageLength: avgLength,
      shortMessages,
      longMessages,
      mediaMessages,
    },
    timing: {
      peakHour,
      peakHourLabel: `${peakHour}:00 - ${peakHour + 1}:00`,
      activeHours,
      avgResponseMinutes: avgLatencyMinutes,
    },
    language: {
      topEmojis,
      topPhrases,
      questionFrequency: Math.round((questionMessages / deceasedMessages.length) * 100),
      exclamationFrequency: Math.round((exclamationMessages / deceasedMessages.length) * 100),
    },
  };
}

function parseTimestamp(date, time) {
  try {
    const [d, m, y] = date.split('/').map(Number);
    const year = y < 100 ? 2000 + y : y;
    const cleanTime = time.replace(/\s*(AM|PM)/i, '').trim();
    const [h, min, sec = 0] = cleanTime.split(':').map(Number);
    let hours = h;
    if (/PM/i.test(time) && h !== 12) hours += 12;
    if (/AM/i.test(time) && h === 12) hours = 0;
    return new Date(year, m - 1, d, hours, min, sec).getTime();
  } catch {
    return null;
  }
}

const STOP_WORDS = [
  'the', 'and', 'for', 'that', 'this', 'with', 'have', 'from',
  'they', 'will', 'been', 'were', 'said', 'your', 'their', 'what',
  'about', 'which', 'when', 'there', 'then', 'just', 'okay', 'yeah',
];

module.exports = { parseWhatsAppChat };
