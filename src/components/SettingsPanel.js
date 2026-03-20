import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useProviders } from '../context/ProvidersContext';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

const PROVIDER_LABELS = {
  ollama:     'Ollama (Local)',
  openrouter: 'OpenRouter',
  groq:       'Groq',
  gemini:     'Google Gemini',
  openai:     'OpenAI',
  anthropic:  'Anthropic'
};

// Providers that don't need API key or base URL inputs
const NO_API_KEY = new Set(['ollama']);
const NO_BASE_URL = new Set(['gemini', 'anthropic']);

function ProviderCard({ provider, local, onChange, onFetchModels, models, loadingModels }) {
  const [showKey, setShowKey] = useState(false);

  const label = PROVIDER_LABELS[provider.id] || provider.id;

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Switch
          checked={local.enabled}
          onCheckedChange={val => onChange({ ...local, enabled: val })}
        />
      </div>

      {local.enabled && (
        <div className="flex flex-col gap-2">
          {/* API Key */}
          {!NO_API_KEY.has(provider.id) && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">API Key</span>
              <div className="flex gap-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={local.apiKey}
                  placeholder={provider.hasApiKey ? '••••••••••••' : 'Enter API key'}
                  onChange={e => onChange({ ...local, apiKey: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent text-muted-foreground"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Base URL */}
          {!NO_BASE_URL.has(provider.id) && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Base URL</span>
              <input
                type="text"
                className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={local.baseUrl}
                onChange={e => onChange({ ...local, baseUrl: e.target.value })}
              />
            </div>
          )}

          {/* Fetch models */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onFetchModels(provider.id)}
              disabled={loadingModels}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loadingModels ? 'animate-spin' : ''}`} />
              Fetch Models
            </Button>
            {models.map(m => (
              <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel({ open, onClose }) {
  const { providers, saveProviders, fetchModelsForProvider, modelsCache, loadingModels } = useProviders();

  // Local copy of providers — edits are local until Save
  const [local, setLocal] = useState([]);

  useEffect(() => {
    if (open && providers.length > 0) {
      setLocal(providers.map(p => ({
        id: p.id,
        enabled: p.enabled,
        apiKey: '',      // empty = user hasn't typed anything yet
        baseUrl: p.baseUrl,
        hasApiKey: p.hasApiKey
      })));
    }
  }, [open, providers]);

  const handleChange = (id, updated) => {
    setLocal(prev => prev.map(p => p.id === id ? updated : p));
  };

  const handleFetchModels = async (id) => {
    await fetchModelsForProvider(id);
  };

  const handleSave = async () => {
    // Send __keep__ sentinel for unchanged keys
    const toSave = local.map(p => ({
      id: p.id,
      enabled: p.enabled,
      // If user typed a key, use it; otherwise keep existing
      apiKey: p.apiKey ? p.apiKey : '__keep__',
      baseUrl: p.baseUrl
    }));
    try {
      await saveProviders(toSave);
      onClose();
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>LLM Provider Settings</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 py-2 pr-1">
          {local.map(p => {
            const serverProvider = providers.find(sp => sp.id === p.id) || {};
            return (
              <ProviderCard
                key={p.id}
                provider={serverProvider}
                local={p}
                onChange={updated => handleChange(p.id, updated)}
                onFetchModels={handleFetchModels}
                models={modelsCache[p.id] || []}
                loadingModels={!!loadingModels[p.id]}
              />
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
