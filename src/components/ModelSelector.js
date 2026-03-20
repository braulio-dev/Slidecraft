import React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const PROVIDER_LABELS = {
  ollama:     'Ollama',
  openrouter: 'OpenRouter',
  groq:       'Groq',
  gemini:     'Gemini',
  openai:     'OpenAI',
  anthropic:  'Anthropic'
};

function ModelSelector({ options, selectedModel, onModelChange }) {
  if (!options || options.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Model</span>
        <Select disabled>
          <SelectTrigger className="w-full bg-secondary border-border text-sm">
            <SelectValue placeholder="No models available" />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  // Group options by provider
  const groups = {};
  for (const opt of options) {
    if (!groups[opt.provider]) groups[opt.provider] = [];
    groups[opt.provider].push(opt);
  }

  const providerIds = Object.keys(groups);
  const multiProvider = providerIds.length > 1;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">Model</span>
      <Select value={selectedModel} onValueChange={onModelChange}>
        <SelectTrigger className="w-full bg-secondary border-border text-sm">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {providerIds.map(pid => (
            <SelectGroup key={pid}>
              {multiProvider && (
                <SelectLabel className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {PROVIDER_LABELS[pid] || pid}
                  </Badge>
                </SelectLabel>
              )}
              {groups[pid].map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-1.5">
                    {!multiProvider && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {PROVIDER_LABELS[opt.provider] || opt.provider}
                      </Badge>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default ModelSelector;
