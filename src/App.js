import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
import TemplateSelector from './components/TemplateSelector';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3.1:latest');
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('blank_default.pptx');
  const messagesEndRef = useRef(null);

   const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [chats, setChats] = useState([
    { id: 1, title: "Chat 1" },
    { id: 2, title: "Chat 2" },
    { id: 3, title: "Chat 3" }
  ]);
  const dropdownRef = useRef(null);

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


const sendMessage = async (message, images = []) => {
  if (!message.trim() && images.length === 0) return;

  // Limpiar el mensaje de referencias base64
  const cleanMessage = message.replace(/\[Imagen adjunta:.*?\]/g, '').trim();

  const userMessage = { 
    role: 'user', 
    content: cleanMessage || 'Crear presentación con estas imágenes', 
    timestamp: new Date(),
    images: images // Guardar las imágenes en el mensaje
  };
  setMessages(prev => [...prev, userMessage]);
  setIsLoading(true);

  // Mostrar mensaje informativo con streaming
  const infoMessageId = Date.now();
  const infoText = '🎨 **Generando presentación...**\n\nSe mostrará el contenido en formato Markdown y se creará automáticamente una presentación PowerPoint que se descargará cuando esté lista.';
  
  // Agregar mensaje vacío inicial
  const infoMessage = {
    id: infoMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    isInfo: true
  };
  setMessages(prev => [...prev, infoMessage]);

  // Streaming del mensaje informativo (más lento)
  const words = infoText.split(' ');
  for (let i = 0; i < words.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 40)); // 40ms entre palabras (más lento)
    const partialInfo = words.slice(0, i + 1).join(' ');
    setMessages(prev => prev.map(msg => 
      msg.id === infoMessageId 
        ? { ...msg, content: partialInfo }
        : msg
    ));
  }

  // Esperar menos después de completar el mensaje informativo
  await new Promise(resolve => setTimeout(resolve, 100));

  let fullMarkdownResponse = '';
  let assistantMessageCreated = false;

  try {
    // --- Enviar mensaje a Ollama con streaming ---
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
          {
            role: "user",
            content: `Create a presentation about: ${cleanMessage}${images.length > 0 ? `. Include ${images.length} image placeholder(s).` : ''}`
          }
        ],
        stream: true
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

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
            
            // Crear el mensaje del asistente solo una vez con el primer contenido
            if (!assistantMessageCreated) {
              // Reemplazar el mensaje informativo con el contenido real
              setMessages(prev => {
                return prev.map(msg => 
                  msg.id === infoMessageId 
                    ? { ...msg, content: fullMarkdownResponse, isInfo: false }
                    : msg
                );
              });
              assistantMessageCreated = true;
            } else {
              // Actualizar el último mensaje (el del asistente)
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  ...newMessages[newMessages.length - 1],
                  content: fullMarkdownResponse
                };
                return newMessages;
              });
            }
          }
        } catch (e) {
          // Ignorar líneas que no sean JSON válido
        }
      }
    }

    setIsLoading(false);

    // Verificar que se recibió una respuesta
    if (!fullMarkdownResponse.trim()) {
      throw new Error('No response received from model');
    }

    // --- Enviar el Markdown al servidor Pandoc ---
    const convertResponse = await fetch('http://localhost:4000/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        markdown: fullMarkdownResponse,
        images: images,
        template: selectedTemplate
      })
    });

    if (!convertResponse.ok) {
      throw new Error(`Conversion failed: ${convertResponse.statusText}`);
    }

    // --- Descargar el archivo PPTX generado ---
    const blob = await convertResponse.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presentation_${Date.now()}.pptx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    console.log("✅ Presentation created and downloaded automatically.");

  } catch (error) {
    console.error('Error sending message:', error);
    console.error('Error details:', error.message);
    const errorMessage = {
      role: 'assistant',
      content: `⚠️ Error: ${error.message}\n\nPlease check:\n1. Ollama is running (http://localhost:11434)\n2. Server is running (http://localhost:4000)\n3. Console for more details`,
      timestamp: new Date(),
      isError: true
    };
    setMessages(prev => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};

 // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

     document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNewChat = () => {
    const newId = chats.length + 1;
    setChats([...chats, { id: newId, title: `Chat ${newId}` }]);
  };



  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-content">
          <div className="header-left">
            <div className="chat-dropdown" ref={dropdownRef}>
              <button
                className="new-chat-button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                + New Chat
              </button>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <button className="dropdown-item" onClick={handleNewChat}>
                    ➕ Start new chat
                  </button>
                  <div className="dropdown-divider" />
                  {chats.map((chat) => (
                    <button key={chat.id} className="dropdown-item">
                      {chat.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <h1>Ollama Chat</h1>
          </div>

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
  );

}



export default App;