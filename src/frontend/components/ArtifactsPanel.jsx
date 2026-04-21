import React, { useState, useMemo } from 'react';

/**
 * ArtifactsPanel — Claude-like side panel for code, HTML previews, and documents
 * Opens automatically when code blocks or artifacts are detected in the chat
 */
export default function ArtifactsPanel({ artifacts, activeIndex, onSelect, onClose }) {
  const [viewMode, setViewMode] = useState('code'); // 'code' | 'preview'

  if (!artifacts || artifacts.length === 0) return null;

  const active = artifacts[activeIndex] || artifacts[0];
  const isHtml = active.language === 'html' || active.content?.includes('<!DOCTYPE') || active.content?.includes('<html');
  const isCss = active.language === 'css';
  const isPreviewable = isHtml || isCss;

  return (
    <div className="artifacts-panel">
      {/* Header */}
      <div className="artifacts-header">
        <div className="artifacts-header-left">
          <span className="artifacts-icon">📄</span>
          <span className="artifacts-title">{active.title || `Artifact ${activeIndex + 1}`}</span>
          <span className="artifacts-lang">{active.language || 'text'}</span>
        </div>
        <div className="artifacts-header-actions">
          {isPreviewable && (
            <div className="artifacts-view-toggle">
              <button
                className={`artifacts-view-btn ${viewMode === 'code' ? 'active' : ''}`}
                onClick={() => setViewMode('code')}
              >
                {'</>'}
              </button>
              <button
                className={`artifacts-view-btn ${viewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setViewMode('preview')}
              >
                👁
              </button>
            </div>
          )}
          <button className="artifacts-copy-btn" onClick={() => {
            navigator.clipboard.writeText(active.content);
          }} title="Copiar">
            📋
          </button>
          <button className="artifacts-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Tabs (if multiple artifacts) */}
      {artifacts.length > 1 && (
        <div className="artifacts-tabs">
          {artifacts.map((art, i) => (
            <button
              key={i}
              className={`artifacts-tab ${i === activeIndex ? 'active' : ''}`}
              onClick={() => onSelect(i)}
            >
              <span className="artifacts-tab-icon">
                {art.language === 'html' ? '🌐' : art.language === 'css' ? '🎨' : art.language === 'python' ? '🐍' : '📄'}
              </span>
              {art.title || `${art.language || 'code'} #${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="artifacts-content">
        {viewMode === 'preview' && isPreviewable ? (
          <iframe
            className="artifacts-preview-iframe"
            srcDoc={isHtml ? active.content : `<style>${active.content}</style><p>CSS Preview</p>`}
            sandbox="allow-scripts"
            title="Preview"
          />
        ) : (
          <pre className="artifacts-code">
            <code>{active.content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

/**
 * Extract artifacts (code blocks) from markdown text
 */
export function extractArtifacts(text) {
  if (!text) return [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  const artifacts = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const language = match[1] || 'text';
    const content = match[2].trim();

    // Only create artifacts for substantial code blocks (>3 lines)
    if (content.split('\n').length >= 3) {
      // Try to extract filename from first comment line
      const firstLine = content.split('\n')[0];
      let title = `${language} snippet`;
      if (firstLine.match(/\/\/\s*(.+\.\w+)/) || firstLine.match(/#\s*(.+\.\w+)/)) {
        title = firstLine.replace(/^\/\/\s*|^#\s*/, '').trim();
      }

      artifacts.push({ language, content, title });
    }
  }

  return artifacts;
}
