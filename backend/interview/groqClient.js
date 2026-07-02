const DEFAULT_PARSING_MODEL = process.env.GROQ_PARSING_MODEL || 'llama-3.3-70b-versatile';
const DEFAULT_QUESTION_MODEL = process.env.GROQ_QUESTION_MODEL || 'llama-3.3-70b-versatile';
const DEFAULT_FOLLOWUP_MODEL = process.env.GROQ_FOLLOWUP_MODEL || 'llama-3.3-70b-versatile';

async function callGroqModel({ prompt, model = DEFAULT_QUESTION_MODEL, temperature = 0.4, isJsonMode = false }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY');
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature,
    max_tokens: 2048,
  };

  // Add JSON mode if needed
  if (isJsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty response');
  return text;
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw new Error('Unable to parse Groq JSON response');
    }
    return JSON.parse(match[0]);
  }
}

export {
  DEFAULT_PARSING_MODEL,
  DEFAULT_QUESTION_MODEL,
  DEFAULT_FOLLOWUP_MODEL,
  callGroqModel,
  parseJsonResponse,
};
