import User from '../models/User.mjs';

const PROVIDER_DEFAULTS = {
  ollama:     { baseUrl: 'http://localhost:11434' },
  openrouter: { baseUrl: 'https://openrouter.ai' },
  groq:       { baseUrl: 'https://api.groq.com' },
  gemini:     { baseUrl: '' },
  openai:     { baseUrl: 'https://api.openai.com' },
  anthropic:  { baseUrl: '' }
};

function getProviderConfig(user, providerId) {
  const saved = (user.providerSettings || []).find(p => p.id === providerId);
  const def = PROVIDER_DEFAULTS[providerId] || {};
  return {
    apiKey: saved?.apiKey || '',
    baseUrl: saved?.baseUrl || def.baseUrl || ''
  };
}

// Write a single normalized NDJSON line to the response
function writeChunk(res, content) {
  res.write(JSON.stringify({ message: { content } }) + '\n');
}

// --- Stream helpers ---

async function streamOllama(upstreamRes, res) {
  const reader = upstreamRes.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value);
    // Pass through Ollama NDJSON as-is
    res.write(chunk);
  }
}

async function streamOpenAICompat(upstreamRes, res) {
  const reader = upstreamRes.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop(); // keep incomplete line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) writeChunk(res, content);
        } catch { /* ignore */ }
      }
    }
  }
}

async function streamAnthropic(upstreamRes, res) {
  const reader = upstreamRes.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === 'content_block_delta') {
          const text = json.delta?.text;
          if (text) writeChunk(res, text);
        }
      } catch { /* ignore */ }
    }
  }
}

async function streamGemini(upstreamRes, res) {
  const reader = upstreamRes.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // Gemini streams a JSON array incrementally; try to extract complete objects
    const matches = buf.matchAll(/\{[^{}]*"candidates"[^{}]*\}/gs);
    let lastEnd = 0;
    for (const m of matches) {
      try {
        const json = JSON.parse(m[0]);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) writeChunk(res, text);
      } catch { /* incomplete object, will retry */ }
      lastEnd = m.index + m[0].length;
    }
    // Keep only unparsed tail
    if (lastEnd > 0) buf = buf.slice(lastEnd);
  }
}

// --- Non-streaming (title generation) buffer helpers ---

async function bufferOllama(upstreamRes) {
  const text = await upstreamRes.text();
  for (const line of text.split('\n')) {
    try {
      const json = JSON.parse(line);
      const content = json.message?.content;
      if (content) return content;
    } catch { /* ignore */ }
  }
  return '';
}

async function bufferOpenAICompat(upstreamRes) {
  const data = await upstreamRes.json();
  return data.choices?.[0]?.message?.content || '';
}

async function bufferAnthropic(upstreamRes) {
  const data = await upstreamRes.json();
  return data.content?.[0]?.text || '';
}

async function bufferGemini(upstreamRes) {
  const data = await upstreamRes.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// --- Main proxy handler ---

export async function proxyChat(req, res) {
  const { provider, model, messages, stream = true } = req.body;

  if (!provider || !model || !messages) {
    return res.status(400).json({ error: 'provider, model, and messages are required' });
  }

  const cfg = getProviderConfig(req.user, provider);

  try {
    if (provider === 'ollama') {
      const baseUrl = cfg.baseUrl || 'http://localhost:11434';
      const upstream = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream })
      });
      if (!upstream.ok) throw new Error(`Ollama error: ${upstream.status}`);
      if (!stream) {
        const content = await bufferOllama(upstream);
        return res.json({ message: { content } });
      }
      res.setHeader('Content-Type', 'application/x-ndjson');
      await streamOllama(upstream, res);
      return res.end();
    }

    if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
      const baseUrl = cfg.baseUrl;
      const apiPath = provider === 'groq' ? '/openai/v1/chat/completions'
                    : provider === 'openrouter' ? '/api/v1/chat/completions'
                    : '/v1/chat/completions';
      const upstream = await fetch(`${baseUrl}${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({ model, messages, stream })
      });
      if (!upstream.ok) {
        const err = await upstream.text();
        throw new Error(`${provider} error ${upstream.status}: ${err}`);
      }
      if (!stream) {
        const content = await bufferOpenAICompat(upstream);
        return res.json({ message: { content } });
      }
      res.setHeader('Content-Type', 'application/x-ndjson');
      await streamOpenAICompat(upstream, res);
      return res.end();
    }

    if (provider === 'anthropic') {
      // Restructure: extract system messages, map rest
      const systemMsgs = messages.filter(m => m.role === 'system');
      const chatMsgs = messages.filter(m => m.role !== 'system');
      const systemText = systemMsgs.map(m => m.content).join('\n');

      const body = {
        model,
        max_tokens: 8192,
        messages: chatMsgs,
        stream,
        ...(systemText ? { system: systemText } : {})
      };
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });
      if (!upstream.ok) {
        const err = await upstream.text();
        throw new Error(`Anthropic error ${upstream.status}: ${err}`);
      }
      if (!stream) {
        const content = await bufferAnthropic(upstream);
        return res.json({ message: { content } });
      }
      res.setHeader('Content-Type', 'application/x-ndjson');
      await streamAnthropic(upstream, res);
      return res.end();
    }

    if (provider === 'gemini') {
      // Map message roles and prepend system content to first user message
      const systemMsgs = messages.filter(m => m.role === 'system');
      const chatMsgs = messages.filter(m => m.role !== 'system');
      const systemText = systemMsgs.map(m => m.content).join('\n');

      const geminiMessages = chatMsgs.map((m, i) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{
          text: (i === 0 && systemText)
            ? `${systemText}\n\n${m.content}`
            : m.content
        }]
      }));

      const endpoint = stream
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${cfg.apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;

      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: geminiMessages })
      });
      if (!upstream.ok) {
        const err = await upstream.text();
        throw new Error(`Gemini error ${upstream.status}: ${err}`);
      }
      if (!stream) {
        const content = await bufferGemini(upstream);
        return res.json({ message: { content } });
      }
      res.setHeader('Content-Type', 'application/x-ndjson');
      await streamGemini(upstream, res);
      return res.end();
    }

    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  } catch (error) {
    console.error('chatProxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Chat proxy failed' });
    } else {
      res.end();
    }
  }
}
