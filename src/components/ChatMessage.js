import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessage.css';

function ChatMessage({ message }) {
  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === 'user' ? (
          <div className="user-avatar">You</div>
        ) : (
          <div className="assistant-avatar">AI</div>
        )}
      </div>
      
      <div className="message-content">
        <div className="message-header">
          <span className="message-role">
            {message.role === 'user' ? 'You' : 'Assistant'}
          </span>
          <span className="message-time">
            {formatTime(message.timestamp)}
          </span>
        </div>
        
        <div className={`message-text ${message.isError ? 'error' : ''} ${message.isLoading ? 'loading' : ''} ${message.isInfo ? 'info' : ''}`}>
          {message.isLoading ? (
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : (
            <>
              <ReactMarkdown components={components}>
                {message.content}
              </ReactMarkdown>
              
              {/* Mostrar imágenes si existen */}
              {message.images && message.images.length > 0 && (
                <div className="message-images">
                  {message.images.map((img, index) => (
                    <div key={index} className="message-image-preview">
                      <img src={img.data} alt={img.name} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;