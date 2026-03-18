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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [currentMarkdown, setCurrentMarkdown] = useState(null);
  const messagesEndRef = useRef(null);

  const currentChat = chats.find(c => c.id === currentChatId);

  // --- Crear nuevo chat ---
  const createNewChat = useCallback(() => {
    const newChat = {
      id: Date.now(),
      title: `Chat ${chats.length + 1}`,
      messages: []
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setCurrentMarkdown(null);
  }, [chats.length]);

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

  // --- Cargar historial del usuario desde MongoDB ---
  useEffect(() => {
    async function loadUserHistory() {
      try {
        const res = await fetch("http://localhost:4000/history", {
          headers: getAuthHeaders()
        });
        const data = await res.json();

        if (data.conversions && data.conversions.length > 0) {
          const formattedChats = data.conversions.map((c, index) => ({
            id: c._id,
            title: `Presentation ${data.conversions.length - index}`,
            messages: [
              { role: 'system', content: `Created: ${new Date(c.timestamp).toLocaleString()}`, timestamp: new Date(c.timestamp) },
              { role: 'assistant', content: `Slide Count: ${c.metadata?.slideCount || 'N/A'}\nCharacters: ${c.metadata?.characterCount || 'N/A'}`, timestamp: new Date(c.timestamp) }
            ]
          }));

          // Create a new empty chat for the user to start a conversation
          const newChat = {
            id: Date.now(),
            title: `New Chat`,
            messages: []
          };

          setChats([newChat, ...formattedChats]);
          setCurrentChatId(newChat.id);
          console.log("✅ Loaded user history from MongoDB and created new chat");
          return;
        }
      } catch (err) {
        console.warn("⚠️ Failed to load history:", err);
      }

      // Si falla o está vacío, cargar localStorage o crear uno nuevo
      const saved = localStorage.getItem("ollama_chats");
      if (saved) {
        const parsed = JSON.parse(saved);
        setChats(parsed);
        if (parsed.length > 0) setCurrentChatId(parsed[0].id);
      } else {
        createNewChat();
      }
    }

    if (isAuthenticated) {
      loadUserHistory();
    }
  }, [isAuthenticated, createNewChat, getAuthHeaders]);

  // --- Guardar chats en localStorage también ---
  useEffect(() => {
    localStorage.setItem("ollama_chats", JSON.stringify(chats));
  }, [chats]);

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
    const baseRules = `You are a professional presentation assistant. Your job is to determine whether the user is asking you to CREATE a presentation, or simply asking a question or having a conversation.

IF the user is asking to create a presentation (e.g. "make a presentation about X", "create slides on Y", "generate a deck for Z"):
- First write a brief, natural summary (1-3 sentences) describing what the presentation covers and its key points. This goes BEFORE the delimiter.
- Then output the full slides wrapped in these exact delimiters on their own lines:
<<<PRESENTATION_START>>>
[full presentation markdown here]
<<<PRESENTATION_END>>>
- Inside the delimiters, use the slide types below. Always start with a TITLE SLIDE (# heading). Keep bullet points short. DO NOT include image markdown tags.

SLIDE TYPES for presentations:
- TITLE SLIDE: Start with "# Title" on its own line, then a subtitle or short description on the next line. Use this for the FIRST slide only.
- CONTENT SLIDE: Use "## Slide Title" followed by bullet points with "-". Use this for most slides.
- IMAGE SLIDE: Use "## " (empty heading) when the slide should show an image. Do NOT add image markdown, images are added separately.
- CLOSING SLIDE: Use "# Conclusion" or "# Thank You" for the last slide, followed by a closing line.

IF the user is asking a question, chatting, or asking for advice (NOT requesting a presentation):
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

Follow the same slide type rules (# for title slide, ## for content slides). If the user asks for an entirely new presentation on a different topic, create a fresh one instead.`;
  };

  // --- Evaluar si la respuesta del modelo es una presentación ---
  const isPresentationResponse = (content) => {
    return content.includes(PRESENTATION_START);
  };

  // --- Enviar mensaje ---
  const sendMessage = async (message, images = []) => {
    if (!message.trim() && images.length === 0) {
      console.log("Empty message, ignoring");
      return;
    }

    if (!currentChat) {
      console.error("No current chat selected!");
      return;
    }

    console.log("Sending message:", message);
    console.log("Current chat:", currentChat);

    // Limpiar el mensaje de referencias base64
    const cleanMessage = message.replace(/\[Imagen adjunta:.*?\]/g, '').trim();

    const userMessage = {
      role: 'user',
      content: cleanMessage || 'Crear presentación con estas imágenes',
      timestamp: new Date(),
      images: images // Guardar las imágenes en el mensaje
    };

    const updatedChat = {
      ...currentChat,
      messages: [...currentChat.messages, userMessage]
    };

    setChats(prev =>
      prev.map(c => c.id === currentChat.id ? updatedChat : c)
    );
    setIsLoading(true);

    let fullMarkdownResponse = '';

    try {
      console.log("Fetching from Ollama with streaming...");
      console.log("Messages to send:", updatedChat.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
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
            // Only send role and content to Ollama, strip out other properties
            ...updatedChat.messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          stream: true
        })
      });

      console.log("Response received:", response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      console.log("Starting to read stream...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Create assistant message for streaming
      let streamingMessageAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("Stream reading complete");
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              fullMarkdownResponse += json.message.content;

              if (!streamingMessageAdded) {
                const assistantMessage = {
                  role: 'assistant',
                  content: fullMarkdownResponse,
                  timestamp: new Date()
                };
                const chatWithResponse = {
                  ...updatedChat,
                  messages: [...updatedChat.messages, assistantMessage]
                };
                setChats(prev =>
                  prev.map(c => c.id === currentChat.id ? chatWithResponse : c)
                );
                streamingMessageAdded = true;
              } else {
                setChats(prev =>
                  prev.map(c => {
                    if (c.id === currentChat.id) {
                      const messages = [...c.messages];
                      messages[messages.length - 1] = {
                        ...messages[messages.length - 1],
                        content: fullMarkdownResponse
                      };
                      return { ...c, messages };
                    }
                    return c;
                  })
                );
              }
            }
          } catch (e) {
            // Ignore invalid JSON lines
          }
        }
      }

      console.log("Ollama response complete");

      // Verificar que se recibió una respuesta
      if (!fullMarkdownResponse.trim()) {
        throw new Error('No response received from model');
      }

      // --- Evaluar si la respuesta es una presentación ---
      const isPresentation = isPresentationResponse(fullMarkdownResponse);
      console.log("Is presentation:", isPresentation);

      // Tag the assistant message with the classification result
      setChats(prev =>
        prev.map(c => {
          if (c.id === currentChat.id) {
            const messages = [...c.messages];
            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              isPresentation
            };
            return { ...c, messages };
          }
          return c;
        })
      );

      if (!isPresentation) {
        console.log("Response is not a presentation, skipping PPTX conversion.");
      } else {
        // --- Enviar Markdown al backend Pandoc ---
        const presentationMarkdown = extractPresentationMarkdown(fullMarkdownResponse);
        console.log("Converting to PPTX...");
        console.log("Extracted markdown length:", presentationMarkdown?.length);
        console.log("Images count:", images.length);
        console.log("Selected template:", selectedTemplate);

        const convertResponse = await fetch('http://localhost:4000/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            markdown: presentationMarkdown,
            images: images,
            template: selectedTemplate
          })
        });

        console.log("Convert response status:", convertResponse.status, convertResponse.statusText);

        if (convertResponse.ok) {
          const blob = await convertResponse.blob();
          const filename = `${extractPresentationTitle(presentationMarkdown)}.pptx`;
          // Convert blob to base64 so it persists as a snapshot in the message
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          // Attach the PPTX snapshot to the assistant message
          setChats(prev =>
            prev.map(c => {
              if (c.id === currentChat.id) {
                const messages = [...c.messages];
                messages[messages.length - 1] = {
                  ...messages[messages.length - 1],
                  pptxBase64: base64,
                  pptxFilename: filename,
                };
                return { ...c, messages };
              }
              return c;
            })
          );
          setCurrentMarkdown(presentationMarkdown);
          console.log("PPTX stored as attachment snapshot");
        } else {
          const errorText = await convertResponse.text();
          console.error("Convert API error:", convertResponse.status, errorText);
          throw new Error(`Conversion failed: ${convertResponse.status} - ${errorText}`);
        }
      }

    } catch (error) {
      console.error("❌ Error in sendMessage:", error);
      alert(`Error: ${error.message}`);

      // Keep the user message visible even if there's an error
      setChats(prev =>
        prev.map(c => c.id === currentChat.id ? updatedChat : c)
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --- Limpiar chat actual ---
  const clearChat = () => {
    if (!currentChat) return;
    const cleared = { ...currentChat, messages: [] };
    setChats(prev => prev.map(c => c.id === currentChat.id ? cleared : c));
    setCurrentMarkdown(null);
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
        <ScrollArea className="flex-1 px-2 py-2">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors border-l-2",
                chat.id === currentChatId
                  ? "bg-primary/10 text-foreground font-medium border-l-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground border-l-transparent"
              )}
            >
              {chat.title}
            </button>
          ))}
        </ScrollArea>
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
          <span className="text-sm font-semibold text-foreground">{currentChat?.title || 'Slidecraft'}</span>
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
          {(!currentChat || currentChat.messages.length === 0) && (
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
          {currentChat?.messages.map((msg, i) => (
            <ChatMessage
              key={i}
              message={msg}
              isStreaming={isLoading && i === currentChat.messages.length - 1 && msg.role === 'assistant'}
            />
          ))}
          {isLoading && currentChat?.messages.at(-1)?.role !== 'assistant' && (
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
                onClick={() => setCurrentMarkdown(null)}
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
