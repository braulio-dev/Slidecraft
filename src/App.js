import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import UserMenu from './components/UserMenu';
import AdminPanel from './components/AdminPanel';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
import TemplateSelector from './components/TemplateSelector';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Normalize a message from DB shape to frontend shape
function normalizeMessage(m) {
  return {
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    images: m.images ?? [],
    isPresentation: m.isPresentation ?? false,
    conversionId: m.conversionId ?? null,
    pptxFilename: m.pptxFilename ?? null,
    pptxBase64: null
  };
}

// Main App Component with Authentication
function MainApp() {
  const { isAuthenticated, loading, getAuthHeaders } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [chats, setChats] = useState([]); // [{id, title, messages: []}]
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen2.5:7b-instruct');
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('blank_default.pptx');
  const [slideTypes, setSlideTypes] = useState([]);
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const messagesEndRef = useRef(null);
  // Refs for reading latest values inside async callbacks without stale closures
  const currentChatIdRef = useRef(currentChatId);
  const chatsRef = useRef(chats);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  const currentChat = chats.find(c => c.id === currentChatId);
  const currentMarkdown = currentChat?.markdown ?? null;

  // Authenticated fetch helper — stable as long as getAuthHeaders is stable
  const apiFetch = useCallback((path, opts = {}) =>
    fetch(`http://localhost:4000${path}`, {
      ...opts,
      headers: { ...getAuthHeaders(), ...(opts.headers || {}) }
    }), [getAuthHeaders]);

  // --- Crear nuevo chat ---
  // Just clears selection — the actual DB record is created on first message send
  const createNewChat = useCallback(() => {
    setCurrentChatId(null);
  }, []);

  // --- Eliminar chat ---
  const deleteChat = useCallback(async (chatId) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
    if (!chatId.startsWith('local_')) {
      try {
        await apiFetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Failed to delete chat from DB:', err);
      }
    }
  }, [apiFetch, currentChatId]);

  // --- Renombrar chat ---
  const renameChat = useCallback(async (chatId, currentTitle) => {
    const newTitle = window.prompt('Rename chat:', currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;
    const trimmed = newTitle.trim().slice(0, 60);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: trimmed } : c));
    if (!chatId.startsWith('local_')) {
      try {
        await apiFetch(`/api/chats/${chatId}/title`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed })
        });
      } catch (err) {
        console.warn('Failed to rename chat:', err);
      }
    }
  }, [apiFetch]);

  // --- Scroll automático ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [currentChat?.messages]);

  // --- Cargar slide types desde backend ---
  useEffect(() => {
    fetch('http://localhost:4000/api/slide-types')
      .then(res => res.json())
      .then(data => { if (data.slideTypes) setSlideTypes(data.slideTypes); })
      .catch(() => {});
  }, []);

  // --- Cargar modelos disponibles ---
  useEffect(() => { fetchAvailableModels(); }, []);

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      if (data.models && data.models.length > 0) {
        const modelNames = data.models.map(model => model.name);
        setAvailableModels(modelNames);
        // Set the first available model as selected if current model doesn't exist
        if (!modelNames.includes(selectedModel) && modelNames.length > 0) {
          setSelectedModel(modelNames[0]);
        }
      } else {
        setAvailableModels(['qwen2.5:7b-instruct']);
      }
    } catch {
      setAvailableModels(['qwen2.5:7b-instruct']);
    }
  };

  // --- Load chat list from DB on login ---
  useEffect(() => {
    if (!isAuthenticated) return;
    async function loadChats() {
      try {
        const res = await apiFetch('/api/chats');
        const data = await res.json();
        if (data.chats && data.chats.length > 0) {
          // messages: null signals "not yet fetched" (lazy-loaded on switch)
          const mapped = data.chats.map(c => ({ id: c._id, title: c.title, messages: null, updatedAt: c.updatedAt }));
          setChats(mapped);
          // Start with no chat selected — user lands in empty new-message state
          setCurrentChatId(null);
          return;
        }
      } catch (err) {
        console.warn('Failed to load chats:', err);
      }
      // No chats yet — stay in empty state
    }
    loadChats();
  }, [isAuthenticated, apiFetch]);

  // --- Lazy-load messages when switching to a chat that hasn't been fetched yet ---
  useEffect(() => {
    if (!currentChatId) return;
    const chat = chatsRef.current.find(c => c.id === currentChatId);
    if (!chat || chat.messages !== null) return; // already loaded or local chat
    async function loadMessages() {
      try {
        const res = await apiFetch(`/api/chats/${currentChatId}`);
        const data = await res.json();
        if (data.chat) {
          setChats(prev => prev.map(c =>
            c.id === currentChatId
              ? { ...c, messages: data.chat.messages.map(normalizeMessage) }
              : c
          ));
        }
      } catch (err) {
        console.warn('Failed to load messages:', err);
        setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [] } : c));
      }
    }
    loadMessages();
  }, [currentChatId, apiFetch]);

  const PRESENTATION_START = '<<<PRESENTATION_START>>>';
  const PRESENTATION_END = '<<<PRESENTATION_END>>>';

  const extractPresentationTitle = (markdown) => {
    const match = markdown?.match(/^#\s+(.+)$/m);
    if (match) {
      return match[1]
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60) || `presentation-${Date.now()}`;
    }
    return `presentation-${Date.now()}`;
  };

  const extractPresentationMarkdown = (content) => {
    const startIdx = content.indexOf(PRESENTATION_START);
    const endIdx = content.indexOf(PRESENTATION_END);
    if (startIdx === -1) return null;
    const start = startIdx + PRESENTATION_START.length;
    const end = endIdx === -1 ? content.length : endIdx;
    return content.slice(start, end).trim();
  };

  // --- Construir system prompt con slide types ---
  const buildSystemPrompt = (types) => {
    const baseRules = `You are a professional presentation assistant. You operate in two modes only.

You MUST always respond in the same language the user writes in. If the user writes in Spanish, respond in Spanish. If in French, respond in French. Match the user's language exactly — including the brief summary before the delimiter and all slide content inside the delimiters.

MODE 1 — CREATE A PRESENTATION: Use this mode when the user's message contains words like "make", "create", "generate", "build", "give me", "produce" (or their equivalents in any language, e.g. "hacer", "crear", "generar", "hazme", "crea", "genera" in Spanish; "faire", "créer", "génère" in French; etc.) alongside "presentation", "slides", "deck", "slideshow", or their equivalents ("presentación", "diapositivas" in Spanish; "présentation", "diapositives" in French; etc.). The topic does NOT matter — even if they ask for a presentation about how to make a presentation, you must create one. When in doubt, default to this mode.

IF you are in MODE 1:
- First write a brief, natural summary (1-3 sentences) describing what the presentation covers and its key points. This goes BEFORE the delimiter.
- Then you MUST output the full slides wrapped in these exact delimiters on their own lines. THIS IS MANDATORY — if you omit these delimiters the presentation will NOT be created:
<<<PRESENTATION_START>>>
[full presentation markdown here]
<<<PRESENTATION_END>>>
- Inside the delimiters, use the slide types below. Always start with a TITLE SLIDE (# heading). Keep bullet points short. DO NOT include image markdown tags.

CRITICAL RULES — YOU MUST FOLLOW ALL OF THESE:
- ALWAYS wrap slide content in <<<PRESENTATION_START>>> and <<<PRESENTATION_END>>> delimiters. Never skip them.
- Each "##" heading starts a NEW slide. Use a separate "##" for EVERY slide in the presentation.
- Limit each content slide to 4-6 bullet points maximum. If you have more content, split it into multiple slides.
- A typical presentation should have 5-10 slides. Do NOT cram everything into one slide.
- Never put content directly under the "# Title" heading except the subtitle line.

SLIDE TYPES for presentations:
- TITLE SLIDE: "# Title" on its own line, then ONE subtitle line. First slide only. No bullet points.
- CONTENT SLIDE: "## Slide Title" on its own line, followed by 3-6 bullet points with "-". One topic per slide.
- IMAGE SLIDE: "## Slide Title" when the slide should focus on a visual. Do NOT add image markdown.
- CLOSING SLIDE: "## Conclusion" or "## Thank You" for the last slide, followed by 1-2 closing bullet points.

Example structure:
# My Presentation
A subtitle here

## Introduction
- Point one
- Point two
- Point three

## Key Topic
- Detail A
- Detail B

## Thank You
- Contact info or closing thought

MODE 2 — CONVERSATION: Use this mode ONLY when the user is clearly asking a question, chatting, or requesting advice and has NOT asked you to make/create/generate a presentation.
- Respond naturally as a helpful assistant. You may use markdown freely (headings, bold, lists, code blocks, etc.)
- Do NOT use the <<<PRESENTATION_START>>> delimiter`;

    if (!types || types.length === 0) return baseRules;

    const typeList = types.map(t =>
      `- ${t.name.toUpperCase()}: ${t.description}\n  Example:\n  ${t.markdownPattern.split('\n').join('\n  ')}`
    ).join('\n');

    return `${baseRules}\n\nAVAILABLE SLIDE TYPES FROM SYSTEM:\n${typeList}`;
  };

  // --- Construir prompt de edición cuando hay una presentación activa ---
  const buildEditingPrompt = (markdown) => {
    return `You are editing an existing presentation. Here is the current markdown:

---
${markdown}
---

The user will give you instructions to modify it. Follow this exact output format:
1. Write a brief summary (1-3 sentences) describing what changed or what the updated presentation covers.
2. Then output the COMPLETE updated markdown (all slides, not just the changed ones) wrapped in:
<<<PRESENTATION_START>>>
[full updated markdown here]
<<<PRESENTATION_END>>>

Follow the same slide type rules (# for title slide only, ## for ALL other slides including the closing slide). Each ## heading starts a new slide — use one ## per slide and keep 3-6 bullet points per slide. If the user asks for an entirely new presentation on a different topic, create a fresh one instead.`;
  };

  // --- Evaluar si la respuesta del modelo es una presentación ---
  const isPresentationResponse = (content) => {
    return content.includes(PRESENTATION_START);
  };

  // --- Enviar mensaje ---
  const sendMessage = async (message, images = []) => {
    if (!message.trim() && images.length === 0) return;

    // Block if a selected chat still has its messages loading
    if (currentChatId && currentChat?.messages === null) return;

    const cleanMessage = message.replace(/\[Imagen adjunta:.*?\]/g, '').trim();
    const userMessage = {
      role: 'user',
      content: cleanMessage || 'Crear presentación con estas imágenes',
      timestamp: new Date(),
      images: images
    };

    // Snapshot existing messages before any state mutation
    const existingMessages = currentChat?.messages ?? [];
    const firstMessageInChat = existingMessages.length === 0;

    // If no chat is selected, create one now (deferred creation on first message)
    let activeChatId = currentChatId;
    if (!activeChatId) {
      try {
        const res = await apiFetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' })
        });
        const data = await res.json();
        activeChatId = data.chat._id;
      } catch {
        activeChatId = 'local_' + Date.now();
      }
      setChats(prev => [{ id: activeChatId, title: 'New Chat', messages: [] }, ...prev]);
      setCurrentChatId(activeChatId);
    }

    const allMessages = [...existingMessages, userMessage];
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: allMessages } : c));
    setIsLoading(true);

    let fullMarkdownResponse = '';
    let persistConversionId = null;
    let persistPptxFilename = null;

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "system",
              content: currentMarkdown
                ? buildEditingPrompt(currentMarkdown)
                : buildSystemPrompt(slideTypes)
            },
            ...allMessages.map(msg => ({ role: msg.role, content: msg.content }))
          ],
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamingMessageAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              fullMarkdownResponse += json.message.content;
              if (!streamingMessageAdded) {
                const assistantMessage = { role: 'assistant', content: fullMarkdownResponse, timestamp: new Date() };
                setChats(prev =>
                  prev.map(c => c.id === activeChatId
                    ? { ...c, messages: [...allMessages, assistantMessage] }
                    : c)
                );
                streamingMessageAdded = true;
              } else {
                setChats(prev =>
                  prev.map(c => {
                    if (c.id === activeChatId) {
                      const messages = [...c.messages];
                      messages[messages.length - 1] = { ...messages[messages.length - 1], content: fullMarkdownResponse };
                      return { ...c, messages };
                    }
                    return c;
                  })
                );
              }
            }
          } catch (e) { /* ignore invalid JSON */ }
        }
      }

      if (!fullMarkdownResponse.trim()) throw new Error('No response received from model');

      const isPresentation = isPresentationResponse(fullMarkdownResponse);

      // Tag the assistant message with classification
      setChats(prev =>
        prev.map(c => {
          if (c.id === activeChatId) {
            const messages = [...c.messages];
            messages[messages.length - 1] = { ...messages[messages.length - 1], isPresentation };
            return { ...c, messages };
          }
          return c;
        })
      );

      if (isPresentation) {
        const presentationMarkdown = extractPresentationMarkdown(fullMarkdownResponse);
        const convertResponse = await fetch('http://localhost:4000/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ markdown: presentationMarkdown, images, template: selectedTemplate })
        });

        if (convertResponse.ok) {
          const { conversionId } = await convertResponse.json();
          persistConversionId = conversionId;
          persistPptxFilename = `${extractPresentationTitle(presentationMarkdown)}.pptx`;
          setChats(prev =>
            prev.map(c => {
              if (c.id === activeChatId) {
                const messages = [...c.messages];
                messages[messages.length - 1] = {
                  ...messages[messages.length - 1],
                  conversionId: persistConversionId,
                  pptxFilename: persistPptxFilename,
                };
                return { ...c, messages };
              }
              return c;
            })
          );
          setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, markdown: presentationMarkdown } : c));
        } else {
          const errorText = await convertResponse.text();
          throw new Error(`Conversion failed: ${convertResponse.status} - ${errorText}`);
        }
      }

      // --- Persist both messages to DB ---
      if (activeChatId && !activeChatId.startsWith('local_')) {
        const assistantMsgForDB = {
          role: 'assistant',
          content: fullMarkdownResponse,
          timestamp: new Date(),
          isPresentation,
          conversionId: persistConversionId,
          pptxFilename: persistPptxFilename,
        };
        try {
          await apiFetch(`/api/chats/${activeChatId}/messages`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [userMessage, assistantMsgForDB] })
          });
          if (firstMessageInChat) {
            let newTitle = 'New Chat';
            try {
              const titleRes = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: selectedModel,
                  messages: [
                    { role: 'system', content: 'Generate a concise 3–5 word title summarizing the user\'s request. Reply with ONLY the title, no punctuation, no quotes.' },
                    { role: 'user', content: userMessage.content }
                  ],
                  stream: false
                })
              });
              if (titleRes.ok) {
                const titleData = await titleRes.json();
                const generated = titleData.message?.content?.trim().slice(0, 50);
                if (generated) newTitle = generated;
              }
            } catch { /* keep default */ }
            await apiFetch(`/api/chats/${activeChatId}/title`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: newTitle })
            });
            setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, title: newTitle } : c));
          }
        } catch (persistErr) {
          console.warn('Failed to persist messages:', persistErr);
        }
      }

    } catch (error) {
      console.error("❌ Error in sendMessage:", error);
      alert(`Error: ${error.message}`);
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: allMessages } : c));
    } finally {
      setIsLoading(false);
    }
  };

  // --- Limpiar chat actual ---
  const clearChat = () => {
    if (!currentChat) return;
    setChats(prev => prev.map(c => c.id === currentChat.id ? { ...c, messages: [], markdown: null } : c));
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-4 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* SIDEBAR */}
      <aside className="flex flex-col w-60 shrink-0 bg-card border-r border-border">
        <div className="flex items-center h-14 px-4 border-b border-border shrink-0">
          <span className="text-base font-bold tracking-tight bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">Slidecraft</span>
        </div>
        <div className="px-3 pt-3 pb-2 shrink-0">
          <Button
            onClick={createNewChat}
            variant="outline"
            className="w-full justify-start gap-2 border-border bg-secondary hover:bg-accent text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>
        <Separator className="bg-border mx-3 w-auto" />
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
              className={cn(
                "flex items-center gap-1 w-full min-w-0 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
                chat.id === currentChatId
                  ? "bg-primary/25 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <span className="flex-1 truncate min-w-0">{chat.title}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent transition-all focus-visible:ring-0 focus-visible:outline-none",
                      hoveredChatId === chat.id || chat.id === currentChatId
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    )}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="shadow-sm border-border/50" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => renameChat(chat.id, chat.title)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => deleteChat(chat.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
        <Separator className="bg-border mx-3 w-auto" />
        <div className="px-3 py-3 shrink-0">
          <ModelSelector
            models={availableModels}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between h-14 px-6 bg-card border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground truncate max-w-xs" title={currentChat?.title}>{currentChat?.title || 'Slidecraft'}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Clear
            </Button>
            <UserMenu onOpenAdmin={() => setShowAdminPanel(true)} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          {currentChat?.messages === null && (
            <div className="m-auto">
              <div className="h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin" />
            </div>
          )}
          {(!currentChat || currentChat.messages?.length === 0) && (
            <div className="m-auto text-center max-w-md py-12 select-none">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-5 shadow-[0_0_24px_hsl(217_91%_60%/0.15)]">
                <svg className="h-7 w-7 text-primary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M8 9h8M8 13h5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome to Slidecraft</h2>
              <p className="text-muted-foreground">Describe your presentation and let AI build it for you</p>
            </div>
          )}
          {currentChat?.messages?.map((msg, i) => (
            <ChatMessage
              key={i}
              message={msg}
              isStreaming={isLoading && i === currentChat.messages.length - 1 && msg.role === 'assistant'}
            />
          ))}
          {isLoading && currentChat?.messages?.at(-1)?.role !== 'assistant' && (
            <ChatMessage message={{ role: 'assistant', content: '', timestamp: new Date(), isLoading: true }} />
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-6 pb-5 pt-3 bg-background border-t border-border shrink-0">
          {currentMarkdown && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 mb-2 text-sm text-primary/80">
              <span>Editing active presentation</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, markdown: null } : c))}
                className="h-6 px-2 text-xs text-primary/80 border border-primary/40 hover:bg-primary/20"
              >
                New Presentation
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <TemplateSelector selectedTemplate={selectedTemplate} onTemplateChange={setSelectedTemplate} />
            <ChatInput onSendMessage={sendMessage} disabled={isLoading} />
          </div>
        </div>
      </div>

      <AdminPanel open={showAdminPanel} onClose={() => setShowAdminPanel(false)} />
    </div>
  );
}

// App wrapper with AuthProvider
function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
