import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import UserMenu from './components/UserMenu';
import AdminPanel from './components/AdminPanel';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
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
  const sendMessage = async (message) => {
    if (!message.trim()) {
      console.log("Empty message, ignoring");
      return;
    }

    if (!currentChat) {
      console.error("No current chat selected!");
      return;
    }

    console.log("Sending message:", message);
    console.log("Current chat:", currentChat);

    const userMessage = { role: 'user', content: message, timestamp: new Date() };
    const updatedChat = {
      ...currentChat,
      messages: [...currentChat.messages, userMessage]
    };

    setChats(prev =>
      prev.map(c => c.id === currentChat.id ? updatedChat : c)
    );
    setIsLoading(true);

    try {
      console.log("Fetching from Ollama...");
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "system",
              content: `You are an AI that generates professional presentations using Markdown.
Each slide starts with "##", use "-" for bullet points.
Output Markdown only.`
            },
            ...updatedChat.messages
          ],
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Ollama response:", data);
      const markdownResponse = data.message?.content || data.response || "(No response)";

      const assistantMessage = {
        role: 'assistant',
        content: markdownResponse,
        timestamp: new Date()
      };

      const chatWithResponse = {
        ...updatedChat,
        messages: [...updatedChat.messages, assistantMessage]
      };
      setChats(prev =>
        prev.map(c => c.id === currentChat.id ? chatWithResponse : c)
      );

      // --- Enviar Markdown al backend Pandoc ---
      console.log("Converting to PPTX...");
      const convertResponse = await fetch('http://localhost:4000/convert', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ markdown: markdownResponse })
      });

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
        console.error("Convert API error:", convertResponse.status);
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

          <ChatInput onSendMessage={sendMessage} disabled={isLoading} />
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
