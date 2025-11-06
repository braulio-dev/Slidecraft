import React, { useState, useRef, useEffect } from 'react';
import './ChatInput.css';

function ChatInput({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), uploadedImages);
      setMessage('');
      setUploadedImages([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 200; // pixels
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImages(prev => [...prev, {
          name: file.name,
          data: e.target.result
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-input-form">
        {uploadedImages.length > 0 && (
          <div className="image-preview-container">
            {uploadedImages.map((img, index) => (
              <div key={index} className="image-preview">
                <img src={img.data} alt={img.name} />
                <button 
                  type="button"
                  className="remove-image-button"
                  onClick={() => removeImage(index)}
                  title="Eliminar imagen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="input-wrapper">
          <div className="input-controls">
            <input
              type="file"
              id="file-upload"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" className="file-upload-button">
              📎
            </label>
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="chat-textarea"
            rows={1}
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="send-button"
            title="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 21L23 12L2 3V10L17 12L2 14V21Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatInput;