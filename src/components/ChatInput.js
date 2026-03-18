import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, SendHorizonal } from 'lucide-react';

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
      const maxHeight = 200;
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
        setUploadedImages(prev => [...prev, { name: file.name, data: e.target.result }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 bg-secondary border border-border rounded-xl focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/20 focus-within:shadow-[0_0_16px_hsl(217_91%_60%/0.12)] transition-all">
      {uploadedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {uploadedImages.map((img, index) => (
            <div key={index} className="relative group">
              <img src={img.data} alt={img.name} className="h-16 w-auto rounded-lg object-cover border border-border" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1 px-2 py-2">
        <input
          type="file"
          id="file-upload"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label htmlFor="file-upload">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            asChild
          >
            <span><Paperclip className="h-4 w-4" /></span>
          </Button>
        </label>

        <textarea
          ref={textareaRef}
          value={message}
          maxLength={4096}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-1.5 min-h-[36px] max-h-[200px]"
          rows={1}
          disabled={disabled}
        />

        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={!message.trim() || disabled}
          className="h-8 w-8 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default ChatInput;
