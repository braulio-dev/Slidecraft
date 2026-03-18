import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutTemplate, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

function TemplateSelector({ selectedTemplate, onTemplateChange }) {
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const getTemplateName = (filename) => {
    return filename
      .replace('.pptx', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleSelect = (filename) => {
    onTemplateChange(filename);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 border-border bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground"
        >
          <LayoutTemplate className="h-4 w-4" />
          <span className="hidden sm:inline">{selectedTemplate ? getTemplateName(selectedTemplate) : 'Template'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>Select a Template</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {templates.map((template) => {
            const isSelected = selectedTemplate === template.filename;
            return (
              <button
                key={template.filename}
                onClick={() => handleSelect(template.filename)}
                className={cn(
                  'relative flex flex-col rounded-lg border p-1 text-left transition-all hover:bg-accent',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-[0_4px_12px_hsl(var(--primary)/0.25)]'
                    : 'border-border'
                )}
              >
                <div
                  className="aspect-video w-full rounded overflow-hidden flex items-center justify-center text-4xl"
                  style={{ backgroundColor: template.color || 'hsl(var(--secondary))' }}
                >
                  {template.thumbnail ? (
                    <img
                      src={`http://localhost:4000${template.thumbnail}`}
                      alt={template.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{template.icon || '📄'}</span>
                  )}
                </div>
                <div className="px-1 py-1.5">
                  <p className="text-xs font-medium text-foreground truncate">
                    {getTemplateName(template.filename)}
                  </p>
                  {template.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateSelector;
