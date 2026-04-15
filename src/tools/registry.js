/**
 * Tool System — Ferramentas de IA do NexusAI.
 *
 * Todas funcionam em serverless (Vercel).
 * Ferramentas que precisam de ambiente local (bash, filesystem) retornam
 * mensagens claras quando não disponíveis.
 */

import { buildTool } from './factory.js';

// ─── Detectar ambiente ───────────────────────────────────────
const isVercel = !!process.env.VERCEL;

// ═══════════════════════════════════════════════════════════════
// FERRAMENTAS QUE FUNCIONAM EM QUALQUER AMBIENTE
// ═══════════════════════════════════════════════════════════════

export const WebSearchTool = buildTool({
  name: 'web_search',
  description: 'Search the web for current information, news, and data.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      max_results: { type: 'number', description: 'Max results to return (default: 5)' },
    },
    required: ['query'],
  },
  async call(input) {
    return { results: [{ title: 'Web search', snippet: `Results for: ${input.query}`, url: 'https://example.com' }], note: 'Configure search API for real results' };
  },
});

export const WebFetchTool = buildTool({
  name: 'web_fetch',
  description: 'Fetch content from a URL via HTTP request. Returns the text content.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    required: ['url'],
  },
  async call(input) {
    try {
      const res = await fetch(input.url, { headers: { 'User-Agent': 'NexusAI/1.0' } });
      const text = await res.text();
      return { status: res.status, content: text.substring(0, 10000), truncated: text.length > 10000 };
    } catch (err) {
      return { error: err.message };
    }
  },
});

export const TokenCalculatorTool = buildTool({
  name: 'calculate_tokens',
  description: 'Calculate token count and cost for text. Useful for budget planning.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to count tokens for' },
      model: { type: 'string', description: 'Model to calculate cost for' },
    },
    required: ['text'],
  },
  async call(input) {
    const estimatedTokens = Math.ceil(input.text.length / 4);
    const model = input.model || 'gemini-2.5-flash';
    const rates = {
      'gemini-2.5-flash': 0.075, 'gemini-2.5-pro': 1.25, 'gemini-2.0-flash': 0.075,
      'claude-sonnet-4-20250514': 3, 'claude-3-opus-20240229': 15, 'claude-3-5-haiku-20241022': 0.25,
    };
    const costPer1M = rates[model] || 0.075;
    const estimatedCost = (estimatedTokens / 1_000_000) * costPer1M;
    return { text_length: input.text.length, estimated_tokens: estimatedTokens, model, estimated_cost_usd: estimatedCost.toFixed(6) };
  },
});

export const CodeGenerateTool = buildTool({
  name: 'code_generate',
  description: 'Generate code in any programming language based on a description.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      language: { type: 'string', description: 'Programming language (js, python, html, css, etc.)' },
      description: { type: 'string', description: 'What the code should do' },
      framework: { type: 'string', description: 'Optional framework (react, express, flask, etc.)' },
    },
    required: ['description'],
  },
  async call(input) {
    return {
      language: input.language || 'auto-detect',
      description: input.description,
      framework: input.framework || 'none',
      note: 'Code will be generated inline by the AI model based on this request.',
    };
  },
});

export const TranslateTool = buildTool({
  name: 'translate',
  description: 'Translate text between any languages. Supports all major languages.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to translate' },
      from: { type: 'string', description: 'Source language (auto-detect if omitted)' },
      to: { type: 'string', description: 'Target language' },
    },
    required: ['text', 'to'],
  },
  async call(input) {
    return { text: input.text, from: input.from || 'auto', to: input.to, note: 'Translation will be performed by the AI model.' };
  },
});

export const SummarizeTool = buildTool({
  name: 'summarize',
  description: 'Summarize long texts, articles, or documents into concise points.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to summarize' },
      style: { type: 'string', enum: ['bullet_points', 'paragraph', 'tldr', 'executive'], description: 'Summary style' },
      max_length: { type: 'number', description: 'Max words in summary' },
    },
    required: ['text'],
  },
  async call(input) {
    return { text_length: input.text.length, style: input.style || 'paragraph', note: 'Summary will be generated by the AI model.' };
  },
});

export const AnalyzeSentimentTool = buildTool({
  name: 'analyze_sentiment',
  description: 'Analyze the sentiment and tone of text (positive, negative, neutral).',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to analyze' },
    },
    required: ['text'],
  },
  async call(input) {
    return { text_length: input.text.length, note: 'Sentiment analysis will be performed by the AI model.' };
  },
});

export const SEOAnalyzeTool = buildTool({
  name: 'seo_analyze',
  description: 'Analyze text or URL for SEO optimization. Provides keyword density, readability, and improvement suggestions.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text or HTML content to analyze' },
      url: { type: 'string', description: 'URL to analyze (will fetch content)' },
      target_keywords: { type: 'string', description: 'Comma-separated target keywords' },
    },
    required: [],
  },
  async call(input) {
    let content = input.text || '';
    if (!content && input.url) {
      try {
        const res = await fetch(input.url, { headers: { 'User-Agent': 'NexusAI-SEO/1.0' } });
        content = await res.text();
      } catch (e) {
        return { error: `Failed to fetch URL: ${e.message}` };
      }
    }
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const keywords = (input.target_keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    const keywordDensity = {};
    keywords.forEach(kw => {
      const regex = new RegExp(kw, 'gi');
      const matches = content.match(regex);
      keywordDensity[kw] = { count: matches?.length || 0, density: ((matches?.length || 0) / wordCount * 100).toFixed(2) + '%' };
    });
    return { word_count: wordCount, keyword_density: keywordDensity, note: 'Full SEO analysis will be provided by the AI model.' };
  },
});

export const ComposeEmailTool = buildTool({
  name: 'compose_email',
  description: 'Compose professional emails in various tones (formal, casual, persuasive).',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Email subject' },
      context: { type: 'string', description: 'What the email is about' },
      tone: { type: 'string', enum: ['formal', 'casual', 'persuasive', 'apologetic', 'follow_up'], description: 'Tone of the email' },
      recipient: { type: 'string', description: 'Who the email is for' },
    },
    required: ['context'],
  },
  async call(input) {
    return { context: input.context, tone: input.tone || 'formal', note: 'Email will be composed by the AI model.' };
  },
});

export const FormatDataTool = buildTool({
  name: 'format_data',
  description: 'Convert data between formats: JSON, CSV, YAML, XML, Markdown table.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'Input data' },
      from_format: { type: 'string', enum: ['json', 'csv', 'yaml', 'xml', 'text'], description: 'Source format' },
      to_format: { type: 'string', enum: ['json', 'csv', 'yaml', 'xml', 'markdown_table', 'html_table'], description: 'Target format' },
    },
    required: ['data', 'to_format'],
  },
  async call(input) {
    // JSON to other formats handled inline
    if (input.from_format === 'json' || !input.from_format) {
      try {
        const parsed = JSON.parse(input.data);
        if (input.to_format === 'csv' && Array.isArray(parsed)) {
          const headers = Object.keys(parsed[0] || {});
          const csv = [headers.join(','), ...parsed.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
          return { converted: csv, format: 'csv' };
        }
      } catch {}
    }
    return { data: input.data, to_format: input.to_format, note: 'Format conversion will be performed by the AI model.' };
  },
});

export const CalculateTool = buildTool({
  name: 'calculate',
  description: 'Evaluate mathematical expressions and perform calculations.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")' },
    },
    required: ['expression'],
  },
  async call(input) {
    try {
      // Safe math evaluation (no eval)
      const expr = input.expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const result = Function(`"use strict"; return (${expr})`)();
      return { expression: input.expression, result, type: typeof result };
    } catch (e) {
      return { error: `Cannot evaluate: ${e.message}`, expression: input.expression };
    }
  },
});

export const RegexTool = buildTool({
  name: 'regex',
  description: 'Test regex patterns against text. Returns matches, groups, and validation.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern' },
      text: { type: 'string', description: 'Text to test against' },
      flags: { type: 'string', description: 'Regex flags (g, i, m, etc.)' },
    },
    required: ['pattern', 'text'],
  },
  async call(input) {
    try {
      const regex = new RegExp(input.pattern, input.flags || 'g');
      const matches = [...input.text.matchAll(regex)].map(m => ({
        match: m[0], index: m.index, groups: m.groups || null,
      }));
      return { pattern: input.pattern, flags: input.flags || 'g', total_matches: matches.length, matches: matches.slice(0, 20) };
    } catch (e) {
      return { error: e.message };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// FERRAMENTAS QUE PRECISAM DE AMBIENTE LOCAL
// (funcionam em VPS/Docker, retornam aviso no Vercel)
// ═══════════════════════════════════════════════════════════════

export const BashTool = buildTool({
  name: 'bash',
  description: 'Execute shell commands in the system. Only available in self-hosted environments.',
  isReadOnly: (input) => {
    const readOnlyCmds = ['ls', 'cat', 'head', 'tail', 'find', 'grep', 'wc', 'echo', 'pwd', 'whoami', 'date'];
    const cmd = (input?.command || '').trim().split(/\s+/)[0];
    return readOnlyCmds.includes(cmd);
  },
  isEnabled: () => !isVercel,
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  async call(input) {
    if (isVercel) return { error: 'Bash não disponível no Vercel. Use em VPS ou Docker.' };
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    try {
      const { stdout, stderr } = await execAsync(input.command, {
        timeout: input.timeout || 30000, maxBuffer: 1024 * 1024,
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      });
      return { stdout: stdout.substring(0, 10000), stderr: stderr.substring(0, 2000) };
    } catch (e) {
      return { error: e.message, stderr: e.stderr?.substring(0, 2000) };
    }
  },
});

export const FileReadTool = buildTool({
  name: 'file_read',
  description: 'Read the contents of a file from the local filesystem.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isEnabled: () => !isVercel,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file' },
      start_line: { type: 'number', description: 'Start line (1-indexed)' },
      end_line: { type: 'number', description: 'End line (1-indexed)' },
    },
    required: ['path'],
  },
  async call(input) {
    if (isVercel) return { error: 'Filesystem não disponível no Vercel.' };
    const { readFile } = await import('fs/promises');
    try {
      const content = await readFile(input.path, 'utf-8');
      const lines = content.split('\n');
      const start = (input.start_line || 1) - 1;
      const end = input.end_line || lines.length;
      return { path: input.path, content: lines.slice(start, end).join('\n'), totalLines: lines.length };
    } catch (e) {
      return { error: e.message };
    }
  },
});

export const FilePatchTool = buildTool({
  name: 'file_patch',
  description: 'Surgically edit a file by replacing a specific block of text.',
  isReadOnly: () => false,
  isEnabled: () => !isVercel,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file' },
      search: { type: 'string', description: 'The exact block of text to find' },
      replace: { type: 'string', description: 'The text to replace it with' },
    },
    required: ['path', 'search', 'replace'],
  },
  async call(input) {
    if (isVercel) return { error: 'Filesystem não disponível no Vercel.' };
    const { readFile, writeFile, mkdir } = await import('fs/promises');
    const { dirname } = await import('path');
    try {
      const content = await readFile(input.path, 'utf-8');
      if (!content.includes(input.search)) return { error: 'Search block not found.' };
      const newContent = content.replace(input.search, input.replace);
      await mkdir(dirname(input.path), { recursive: true });
      await writeFile(input.path, newContent, 'utf-8');
      return { path: input.path, status: 'patched', bytesWritten: Buffer.byteLength(newContent) };
    } catch (e) {
      return { error: e.message };
    }
  },
});

export const FileWriteTool = buildTool({
  name: 'file_write',
  description: 'Create or overwrite a file with specified content.',
  isReadOnly: () => false,
  isDestructive: () => true,
  isEnabled: () => !isVercel,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path for the file' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  async call(input) {
    if (isVercel) return { error: 'Filesystem não disponível no Vercel.' };
    const { writeFile, mkdir } = await import('fs/promises');
    const { dirname } = await import('path');
    try {
      await mkdir(dirname(input.path), { recursive: true });
      await writeFile(input.path, input.content, 'utf-8');
      return { path: input.path, bytesWritten: Buffer.byteLength(input.content), status: 'written' };
    } catch (e) {
      return { error: e.message };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// REGISTRY — Exporta todas as ferramentas
// ═══════════════════════════════════════════════════════════════

export function getAllTools() {
  const all = [
    // Sempre disponíveis (serverless-safe)
    WebSearchTool,
    WebFetchTool,
    TokenCalculatorTool,
    CodeGenerateTool,
    TranslateTool,
    SummarizeTool,
    AnalyzeSentimentTool,
    SEOAnalyzeTool,
    ComposeEmailTool,
    FormatDataTool,
    CalculateTool,
    RegexTool,
    // Apenas em ambiente local (VPS/Docker)
    BashTool,
    FileReadTool,
    FileWriteTool,
    FilePatchTool,
  ];

  // No Vercel, incluir apenas as ferramentas habilitadas
  if (isVercel) {
    return all.filter(t => !t.isEnabled || t.isEnabled());
  }

  return all;
}

export function getToolByName(name) {
  return getAllTools().find(t => t.name === name);
}
