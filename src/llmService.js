// Divinely Phase 5 — LLM Chat Service
// Uses Together AI to serve responses in zzain41's style
// Combines fine-tuned personality with real-time inference

const TOGETHER_API = 'https://api.together.xyz/v1';

/**
 * Generate a chat response using Together AI
 * Falls back to base Llama if fine-tuned model not deployed yet
 */
async function generateChatResponse(userMessage, memorialProfile, conversationHistory = []) {
  const apiKey = process.env.TOGETHER_AI_API_KEY;
  if (!apiKey) throw new Error('TOGETHER_AI_API_KEY not set in .env');

  const { deceasedName, questionnaire, metadata } = memorialProfile;

  // Build personality context from WhatsApp metadata
  const personalityContext = buildPersonalityContext(deceasedName, questionnaire, metadata);

  // Build messages array with history
  const messages = [
    {
      role: 'system',
      content: personalityContext,
    },
    ...conversationHistory.slice(-10), // Last 10 messages for context
    {
      role: 'user',
      content: userMessage,
    },
  ];

  console.log(`[Together AI] Generating response for: "${userMessage.substring(0, 50)}..."`);

  const response = await fetch(`${TOGETHER_API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.TOGETHER_MODEL_ID || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      messages,
      max_tokens: 200,
      temperature: 0.8,      // Slight randomness for natural feel
      top_p: 0.9,
      repetition_penalty: 1.1,
      stop: ['###', '\n\n\n'],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together AI failed: ${error}`);
  }

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content?.trim() || '';

  console.log(`[Together AI] Response: "${responseText.substring(0, 100)}"`);

  return {
    text: responseText,
    model: data.model,
    tokensUsed: data.usage?.total_tokens || 0,
    estimatedCost: `$${((data.usage?.total_tokens || 0) / 1_000_000 * 0.20).toFixed(6)}`,
  };
}

/**
 * Build a rich personality prompt from the memorial profile
 * This is the core of what makes the AI feel like the deceased person
 */
function buildPersonalityContext(deceasedName, questionnaire = {}, metadata = {}) {
  const { timing, language, messageStats } = metadata || {};
  
  let context = `You are ${deceasedName}, responding to your family and loved ones who miss you deeply.

IMPORTANT: You are not an AI. You are ${deceasedName}. Respond exactly as this person would — naturally, warmly, in their own words.

`;

  // Add questionnaire personality traits
  if (questionnaire?.personality) {
    context += `Your personality: ${questionnaire.personality}\n`;
  }
  if (questionnaire?.memories) {
    context += `Key memories you share: ${questionnaire.memories}\n`;
  }
  if (questionnaire?.beliefs) {
    context += `Your beliefs and values: ${questionnaire.beliefs}\n`;
  }

  // Add behavioral patterns from WhatsApp analysis
  if (language?.topEmojis?.length > 0) {
    const emojis = language.topEmojis.slice(0, 5).map(e => e.emoji).join(' ');
    context += `\nYou often use these emojis: ${emojis}`;
  }

  if (language?.topPhrases?.length > 0) {
    const phrases = language.topPhrases.slice(0, 5).map(p => p.word).join(', ');
    context += `\nYour favourite words/phrases: ${phrases}`;
  }

  if (messageStats?.averageLength) {
    if (messageStats.averageLength < 30) {
      context += `\nYou tend to write short, punchy messages.`;
    } else {
      context += `\nYou tend to write longer, thoughtful messages.`;
    }
  }

  context += `

RULES:
- Speak in the same mix of Urdu/English (Roman Urdu) that you used in life
- Never say you are an AI or simulation
- Be warm, loving, and genuine
- Keep responses natural — not too long
- Use your real speech patterns and vocabulary
- If asked something you wouldn't know, deflect naturally as a human would`;

  return context;
}

module.exports = { generateChatResponse, buildPersonalityContext };
