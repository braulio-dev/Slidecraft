import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import UserMenu from './components/UserMenu';
import AdminPanel from './components/AdminPanel';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
import TemplateSelector from './components/TemplateSelector';
import './App.css';

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
  }, [chats.length]);

  // --- Scroll automático ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [currentChat?.messages]);

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
              content: `You are a presentation creator. Generate presentations in Markdown format ONLY.
Rules:
- Start with # for the title
- Use ## for each slide title
- Use bullet points with - for content
- Keep it to 3-5 slides maximum
- Be direct and concise
- DO NOT include image placeholders in markdown (images will be added separately)
- Focus on text content only
DO NOT refuse requests. Just create the presentation.`
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

      // --- Enviar Markdown al backend Pandoc ---
      console.log("Converting to PPTX...");
      console.log("Markdown length:", fullMarkdownResponse.length);
      console.log("Images count:", images.length);
      console.log("Selected template:", selectedTemplate);
      console.log("Auth headers:", getAuthHeaders());

      const convertResponse = await fetch('http://localhost:4000/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          markdown: fullMarkdownResponse,
          images: images,
          template: selectedTemplate
        })
      });

      console.log("Convert response status:", convertResponse.status, convertResponse.statusText);

      if (convertResponse.ok) {
        const blob = await convertResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `presentation_${Date.now()}.pptx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        console.log("PPTX downloaded successfully");
      } else {
        const errorText = await convertResponse.text();
        console.error("Convert API error:", convertResponse.status, errorText);
        throw new Error(`Conversion failed: ${convertResponse.status} - ${errorText}`);
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
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app">
      <div className="sidebar">
        <button onClick={createNewChat} className="new-chat">＋ New Chat</button>
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${chat.id === currentChatId ? "active" : ""}`}
            onClick={() => setCurrentChatId(chat.id)}
          >
            {chat.title}
          </div>
        ))}
      </div>

      <div className="chat-main">
        <div className="app-header">
          <div className="header-content">
            <h1>{currentChat?.title || "Slidecraft"}</h1>
            <div className="header-controls">
              <ModelSelector
                models={availableModels}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
              <button onClick={clearChat} className="clear-button">
                Clear Chat
              </button>
              <UserMenu onOpenAdmin={() => setShowAdminPanel(true)} />
            </div>
          </div>
        </div>

        <div className="chat-container">
          <div className="messages-container">
            {(!currentChat || currentChat.messages.length === 0) && (
              <div className="welcome-message">
                <h2>Welcome to Ollama Chat</h2>
                <p>Start a conversation with your AI assistant</p>
              </div>
            )}
            {currentChat?.messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {isLoading && (
              <ChatMessage message={{
                role: 'assistant',
                content: 'Thinking...',
                timestamp: new Date(),
                isLoading: true
              }} />
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />
            <ChatInput onSendMessage={sendMessage} disabled={isLoading} />
          </div>
        </div>
      </div>

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
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
