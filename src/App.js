import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
import './App.css';

function App() {
  const [chats, setChats] = useState([]); // [{id, title, messages: []}]
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3.1:latest');
  const [availableModels, setAvailableModels] = useState([]);
  const messagesEndRef = useRef(null);

  const currentChat = chats.find(c => c.id === currentChatId);

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
        setAvailableModels(data.models.map(model => model.name));
      } else {
        setAvailableModels(['llama3.1:latest']);
      }
    } catch {
      setAvailableModels(['llama3.1:latest']);
    }
  };

  // --- Cargar historial desde db.json al iniciar ---
  useEffect(() => {
    async function loadServerData() {
      try {
        const res = await fetch("http://localhost:4000/load");
        const data = await res.json();

        if (data.conversions && data.conversions.length > 0) {
          const formattedChats = data.conversions.map((c, index) => ({
            id: c.id,
            title: `Chat ${index + 1}`,
            messages: [
              { role: 'system', content: 'Imported from db.json', timestamp: new Date() },
              { role: 'assistant', content: c.markdown || "(empty)", timestamp: new Date() }
            ]
          }));

          setChats(formattedChats);
          setCurrentChatId(formattedChats[formattedChats.length - 1].id);
          console.log("✅ Loaded chats from db.json");
          return;
        }
      } catch (err) {
        console.warn("⚠️ No db.json found or load failed:", err);
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

    loadServerData();
  }, []);

  // --- Guardar chats en localStorage también ---
  useEffect(() => {
    localStorage.setItem("ollama_chats", JSON.stringify(chats));
  }, [chats]);

  // --- Crear nuevo chat ---
  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: `Chat ${chats.length + 1}`,
      messages: []
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
  };

  // --- Enviar mensaje ---
  const sendMessage = async (message) => {
    if (!message.trim() || !currentChat) return;

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

      const data = await response.json();
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
      const convertResponse = await fetch('http://localhost:4000/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      }

    } catch (error) {
      console.error("❌ Error:", error);
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
            <h1>{currentChat?.title || "Ollama Chat"}</h1>
            <div className="header-controls">
              <ModelSelector
                models={availableModels}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
              <button onClick={clearChat} className="clear-button">
                Clear Chat
              </button>
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
    </div>
  );
}

export default App;
