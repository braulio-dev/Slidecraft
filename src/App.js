import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3.1:latest');
  const [availableModels, setAvailableModels] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchAvailableModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models.map(model => model.name));
        if (!selectedModel && data.models.length > 0) {
          setSelectedModel(data.models[0].name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      // Fallback to default model
      setAvailableModels(['mistral:latest'], ['llama3.1:latest']);
    }
  };

  const sendMessage = async (message) => {
  if (!message.trim()) return;

  const userMessage = { role: 'user', content: message, timestamp: new Date() };
  const updatedMessages = [...messages, userMessage];
  setMessages(updatedMessages);
  setIsLoading(true);

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [ 
    {
      role: "system",
      content: `You are an AI that generates professional presentations using Markdown.
Each slide should start with "##", and use bullet points "-" for content.
Respond only in Markdown syntax suitable for conversion by Pandoc.`
    },
    ...updatedMessages.map(m => ({
          role: m.role,
          content: m.content
        })),
      ],
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = { 
      role: 'assistant', 
      content: data.message?.content || data.response || '(No response)', 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, assistantMessage]);
  } catch (error) {
    console.error('Error sending message:', error);
    const errorMessage = { 
      role: 'assistant', 
      content: 'Sorry, I encountered an error. Please make sure Ollama is running and the model is available.', 
      timestamp: new Date(),
      isError: true
    };
    setMessages(prev => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};


  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-content">
          <h1>Ollama Chat</h1>
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
          {messages.length === 0 && (
            <div className="welcome-message">
              <h2>Welcome to Ollama Chat</h2>
              <p>Start a conversation with your AI assistant</p>
              <div className="model-info">
                Current model: <strong>{selectedModel}</strong>
              </div>
            </div>
          )}
          
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          
          {isLoading && (
            <ChatMessage 
              message={{ 
                role: 'assistant', 
                content: 'Thinking...', 
                timestamp: new Date(),
                isLoading: true 
              }} 
            />
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <ChatInput onSendMessage={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}

export default App;