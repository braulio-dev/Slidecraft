import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, FileText, Presentation } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PRESENTATION_START = '<<<PRESENTATION_START>>>';
const PRESENTATION_END = '<<<PRESENTATION_END>>>';

function PresentationCard({ base64, filename, conversionId }) {
  const { getAuthHeaders } = useAuth();
  const [pdfLoading, setPdfLoading] = useState(false);

  const displayName = filename ? filename.replace(/\.[^.]+$/, '') : 'presentation';

  const fetchPptxBlob = async () => {
    if (base64) {
      // Legacy in-memory base64: convert back to blob
      const res = await fetch(base64);
      return res.blob();
    }
    const res = await fetch(`http://localhost:4000/download/${conversionId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch presentation from server');
    return res.blob();
  };

  const handleDownloadPPTX = async () => {
    try {
      const blob = await fetchPptxBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const blob = await fetchPptxBlob();
      const pptxBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      const response = await fetch('http://localhost:4000/convert-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ pptxBase64, filename }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.details || 'PDF conversion failed');
      }
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/\.pptx$/i, '.pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF conversion failed: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Card className="mt-3 border-primary/20 bg-primary/5 shadow-none w-full max-w-sm">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
          <Presentation className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium text-foreground truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground">Presentation</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={pdfLoading}
              className="shrink-0 h-8 gap-1 border-primary/40 text-primary hover:bg-primary/10 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <Download className="h-3.5 w-3.5" />
              {pdfLoading ? 'Converting…' : 'Download'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="shadow-sm border-border/50">
            <DropdownMenuItem onClick={handleDownloadPPTX}>
              <Download className="h-3.5 w-3.5 mr-2" />
              PowerPoint (.pptx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPDF}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              PDF (.pdf)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function PresentationMessage({ content, pptxBase64, pptxFilename, conversionId, isStreaming }) {
  const startIdx = content.indexOf(PRESENTATION_START);
  const endIdx = content.indexOf(PRESENTATION_END);

  // Summary is everything before the start delimiter
  const summary = startIdx !== -1 ? content.slice(0, startIdx).trim() : content;
  const presentationStreaming = startIdx !== -1 && endIdx === -1; // delimiters open but not closed
  const presentationDone = endIdx !== -1;
  const hasFile = pptxBase64 || conversionId;

  return (
    <div className="flex flex-col gap-2">
      {summary && (
        <div className="text-sm leading-relaxed">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}
      {(presentationStreaming || presentationDone) && !hasFile && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span className="flex gap-[3px] items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </span>
          Generating presentation…
        </div>
      )}
      {hasFile && (
        <PresentationCard base64={pptxBase64} filename={pptxFilename} conversionId={conversionId} />
      )}
    </div>
  );
}

function ChatMessage({ message, isStreaming }) {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const codeComponents = {
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

  const isUser = message.role === 'user';
  const isPresentation = !isUser && message.content?.includes(PRESENTATION_START);

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-muted-foreground'
      }`}>
        {isUser ? 'You' : 'AI'}
      </div>

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {!isUser && (message.isLoading || isStreaming) && (
            <span className="flex gap-[3px] items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {!message.isLoading && (
          <div className={`rounded-xl px-5 py-4 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600/90 text-white shadow-[0_2px_12px_hsl(217_91%_60%/0.25)]'
              : 'bg-secondary border border-border text-foreground'
          }`}>
            {isPresentation ? (
              <PresentationMessage
                content={message.content}
                pptxBase64={message.pptxBase64}
                pptxFilename={message.pptxFilename}
                conversionId={message.conversionId}
                isStreaming={isStreaming}
              />
            ) : (
              <ReactMarkdown components={codeComponents}>
                {message.content}
              </ReactMarkdown>
            )}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {message.images.map((img, index) => (
                  <img
                    key={index}
                    src={img.data}
                    alt={img.name}
                    className="h-24 w-auto rounded-lg object-cover border border-border"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
