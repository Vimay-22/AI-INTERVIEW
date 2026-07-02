const DEFAULT_PARSING_MODEL = process.env.GEMINI_PARSING_MODEL || 'gemini-1.5-flash';
const DEFAULT_QUESTION_MODEL = process.env.GEMINI_QUESTION_MODEL || 'gemini-1.5-flash';
const DEFAULT_FOLLOWUP_MODEL = process.env.GEMINI_FOLLOWUP_MODEL || 'gemini-1.5-pro';

async function callGeminiModel({ prompt, model = DEFAULT_QUESTION_MODEL, temperature = 0.4, responseMimeType = 'application/json' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        responseMimeType,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw new Error('Unable to parse Gemini JSON response');
    }
    return JSON.parse(match[0]);
  }
}

export {
  DEFAULT_PARSING_MODEL,
  DEFAULT_QUESTION_MODEL,
  DEFAULT_FOLLOWUP_MODEL,
  callGeminiModel,
  parseJsonResponse,
};
