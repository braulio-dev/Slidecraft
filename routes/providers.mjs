import express from 'express';
import { authenticateToken } from '../middleware/auth.mjs';
import User from '../models/User.mjs';

const router = express.Router();
router.use(authenticateToken);

const PROVIDER_DEFAULTS = [
  { id: 'ollama',     enabled: true,  apiKey: '', baseUrl: 'http://localhost:11434' },
  { id: 'openrouter', enabled: false, apiKey: '', baseUrl: 'https://openrouter.ai' },
  { id: 'groq',       enabled: false, apiKey: '', baseUrl: 'https://api.groq.com' },
  { id: 'gemini',     enabled: false, apiKey: '', baseUrl: '' },
  { id: 'openai',     enabled: false, apiKey: '', baseUrl: 'https://api.openai.com' },
  { id: 'anthropic',  enabled: false, apiKey: '', baseUrl: '' }
];

// Merge saved user settings over defaults
function mergeProviders(saved) {
  const savedMap = new Map((saved || []).map(p => [p.id, p]));
  return PROVIDER_DEFAULTS.map(def => {
    const s = savedMap.get(def.id);
    if (!s) return def;
    return { id: def.id, enabled: s.enabled, apiKey: s.apiKey, baseUrl: s.baseUrl || def.baseUrl };
  });
}

// GET /api/providers — return settings without exposing key values
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('providerSettings');
    const providers = mergeProviders(user.providerSettings);
    const safe = providers.map(({ id, enabled, apiKey, baseUrl }) => ({
      id,
      enabled,
      hasApiKey: !!apiKey,
      baseUrl
    }));
    res.json({ providers: safe });
  } catch (error) {
    console.error('GET /api/providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// PUT /api/providers — save provider settings
router.put('/', async (req, res) => {
  try {
    const { providers } = req.body;
    if (!Array.isArray(providers)) return res.status(400).json({ error: 'providers must be an array' });

    const validIds = new Set(PROVIDER_DEFAULTS.map(p => p.id));
    for (const p of providers) {
      if (!validIds.has(p.id)) return res.status(400).json({ error: `Unknown provider: ${p.id}` });
    }

    // Load existing to handle __keep__ sentinel
    const user = await User.findById(req.user._id).select('providerSettings');
    const existingMap = new Map((user.providerSettings || []).map(p => [p.id, p]));

    const toSave = providers.map(p => {
      const existing = existingMap.get(p.id);
      const apiKey = p.apiKey === '__keep__' ? (existing?.apiKey || '') : (p.apiKey || '');
      return { id: p.id, enabled: !!p.enabled, apiKey, baseUrl: p.baseUrl || '' };
    });

    await User.findByIdAndUpdate(req.user._id, { $set: { providerSettings: toSave } });
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/providers error:', error);
    res.status(500).json({ error: 'Failed to save providers' });
  }
});

// GET /api/providers/:id/models — proxy model list fetch per provider
router.get('/:id/models', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id).select('providerSettings');
    const providers = mergeProviders(user.providerSettings);
    const provider = providers.find(p => p.id === id);

    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    if (id === 'anthropic') {
      return res.json({ models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] });
    }

    if (id === 'ollama') {
      const baseUrl = provider.baseUrl || 'http://localhost:11434';
      const r = await fetch(`${baseUrl}/api/tags`);
      if (!r.ok) throw new Error(`Ollama returned ${r.status}`);
      const data = await r.json();
      return res.json({ models: (data.models || []).map(m => m.name) });
    }

    if (id === 'gemini') {
      if (!provider.apiKey) return res.status(400).json({ error: 'API key required for Gemini' });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey}`);
      if (!r.ok) throw new Error(`Gemini returned ${r.status}`);
      const data = await r.json();
      const models = (data.models || [])
        .map(m => m.name.replace('models/', ''))
        .filter(n => n.startsWith('gemini'));
      return res.json({ models });
    }

    // OpenAI-compatible: openai, groq, openrouter
    if (!provider.apiKey) return res.status(400).json({ error: 'API key required' });
    let modelsUrl;
    if (id === 'groq') modelsUrl = `${provider.baseUrl}/openai/v1/models`;
    else if (id === 'openrouter') modelsUrl = `${provider.baseUrl}/api/v1/models`;
    else modelsUrl = `${provider.baseUrl}/v1/models`;

    const r = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${provider.apiKey}` }
    });
    if (!r.ok) throw new Error(`${id} API returned ${r.status}`);
    const data = await r.json();
    const models = (data.data || []).map(m => m.id);
    res.json({ models });
  } catch (error) {
    console.error(`GET /api/providers/${req.params.id}/models error:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch models' });
  }
});

export default router;
