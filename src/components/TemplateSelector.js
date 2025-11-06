import React, { useState, useEffect } from 'react';
import './TemplateSelector.css';

function TemplateSelector({ selectedTemplate, onTemplateChange }) {
  const [templates, setTemplates] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

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

  const handleTemplateSelect = (template) => {
    onTemplateChange(template);
    setIsOpen(false);
  };

  const getTemplateName = (filename) => {
    return filename
      .replace('.pptx', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="template-selector">
      <button 
        className="template-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Seleccionar plantilla"
      >
        🎨 {selectedTemplate ? getTemplateName(selectedTemplate) : 'Plantilla'}
      </button>

      {isOpen && (
        <div className="template-dropdown">
          <div className="template-dropdown-header">
            <h3>Selecciona una plantilla</h3>
            <button 
              className="close-button"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="template-grid">
            {templates.map((template) => (
              <div
                key={template.filename}
                className={`template-card ${selectedTemplate === template.filename ? 'selected' : ''}`}
                onClick={() => handleTemplateSelect(template.filename)}
              >
                <div className="template-preview" style={{ backgroundColor: template.color || '#2a2b32' }}>
                  {template.thumbnail ? (
                    <img 
                      src={`http://localhost:4000${template.thumbnail}`} 
                      alt={template.filename}
                    />
                  ) : (
                    <div className="template-placeholder" style={{ fontSize: '64px' }}>
                      {template.icon || '📄'}
                    </div>
                  )}
                </div>
                <div className="template-name">
                  {getTemplateName(template.filename)}
                </div>
                {template.description && (
                  <div className="template-description">
                    {template.description}
                  </div>
                )}
                {selectedTemplate === template.filename && (
                  <div className="selected-badge">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateSelector;
