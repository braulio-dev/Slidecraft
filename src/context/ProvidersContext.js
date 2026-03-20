import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ProvidersContext = createContext(null);

export function ProvidersProvider({ children }) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [providers, setProviders] = useState([]);
  const [modelsCache, setModelsCache] = useState({});  // { providerId: string[] }
  const [loadingModels, setLoadingModels] = useState({}); // { providerId: boolean }
  const [loadingProviders, setLoadingProviders] = useState(false);

  const apiFetch = useCallback((path, opts = {}) =>
    fetch(`http://localhost:4000${path}`, {
      ...opts,
      headers: { ...getAuthHeaders(), ...(opts.headers || {}) }
    }), [getAuthHeaders]);

  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const res = await apiFetch('/api/providers');
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
    } catch (err) {
      console.warn('Failed to load providers:', err);
    } finally {
      setLoadingProviders(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (isAuthenticated) fetchProviders();
  }, [isAuthenticated, fetchProviders]);

  const saveProviders = useCallback(async (updated) => {
    // Detect which providers changed key or URL to invalidate model cache
    const changedIds = new Set();
    for (const p of updated) {
      const old = providers.find(o => o.id === p.id);
      if (old && (p.apiKey !== '__keep__' || p.baseUrl !== old.baseUrl)) {
        changedIds.add(p.id);
      }
    }

    await apiFetch('/api/providers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers: updated })
    });

    // Invalidate cache for changed providers
    if (changedIds.size > 0) {
      setModelsCache(prev => {
        const next = { ...prev };
        for (const id of changedIds) delete next[id];
        return next;
      });
    }

    await fetchProviders();
  }, [apiFetch, fetchProviders, providers]);

  const fetchModelsForProvider = useCallback(async (id) => {
    if (modelsCache[id]) return modelsCache[id];
    setLoadingModels(prev => ({ ...prev, [id]: true }));
    try {
      const res = await apiFetch(`/api/providers/${id}/models`);
      const data = await res.json();
      const models = data.models || [];
      setModelsCache(prev => ({ ...prev, [id]: models }));
      return models;
    } catch (err) {
      console.warn(`Failed to fetch models for ${id}:`, err);
      return [];
    } finally {
      setLoadingModels(prev => ({ ...prev, [id]: false }));
    }
  }, [apiFetch, modelsCache]);

  // Returns flat list of {value: 'provider::model', label, provider} for enabled providers
  const getEnabledModels = useCallback(() => {
    const result = [];
    for (const p of providers) {
      if (!p.enabled) continue;
      const cached = modelsCache[p.id] || [];
      for (const m of cached) {
        result.push({ value: `${p.id}::${m}`, label: m, provider: p.id });
      }
    }
    return result;
  }, [providers, modelsCache]);

  return (
    <ProvidersContext.Provider value={{
      providers,
      modelsCache,
      loadingModels,
      loadingProviders,
      fetchProviders,
      saveProviders,
      fetchModelsForProvider,
      getEnabledModels
    }}>
      {children}
    </ProvidersContext.Provider>
  );
}

export function useProviders() {
  const ctx = useContext(ProvidersContext);
  if (!ctx) throw new Error('useProviders must be used within ProvidersProvider');
  return ctx;
}
