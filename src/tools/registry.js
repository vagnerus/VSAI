/**
 * Tool System — Inspired by Claude Code's 42-module tool architecture (doc 02).
 * 
 * Every tool implements the same interface via buildTool() factory.
 * Defaults are fail-closed: isConcurrencySafe=false, isReadOnly=false.
 */

import { TeamCreateTool } from './TeamCreateTool.js';
import { SendMessageTool } from './SendMessageTool.js';
import { AgentTool } from './AgentTool.js';
import { TaskStopTool } from './TaskStopTool.js';
import { WindowsServiceTool } from './WindowsServiceTool.js';
import { buildTool } from './factory.js';

// ─── Tool Definitions ────────────────────────────────────────────

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
  description: 'Fetch content from a URL via HTTP request.',
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

export const BashTool = buildTool({
  name: 'bash',
  description: 'Execute shell commands in the system.',
  isReadOnly: (input) => {
    const readOnlyCmds = ['ls', 'cat', 'head', 'tail', 'find', 'grep', 'wc', 'echo', 'pwd', 'whoami', 'date'];
    const cmd = (input?.command || '').trim().split(/\s+/)[0];
    return readOnlyCmds.includes(cmd);
  },
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  async call(input) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    try {
      const { stdout, stderr } = await execAsync(input.command, {
        timeout: input.timeout || 30000,
        maxBuffer: 1024 * 1024,
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
  description: 'Surgically edit a file by replacing a specific block of text with another. This is safer and generates cleaner Diffs.',
  isReadOnly: () => false,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file' },
      search: { type: 'string', description: 'The exact block of text to find' },
      replace: { type: 'string', description: 'The text to replace it with' },
      mode: { type: 'string', enum: ['propose', 'direct'], description: 'Default is propose for human review' },
    },
    required: ['path', 'search', 'replace'],
  },
  async call(input) {
    const { readFile, writeFile, mkdir } = await import('fs/promises');
    const { dirname } = await import('path');
    try {
      const content = await readFile(input.path, 'utf-8');
      if (!content.includes(input.search)) {
        return { error: 'Search block not found in file. Ensure exact match including whitespace.' };
      }
      
      const newContent = content.replace(input.search, input.replace);
      const mode = input.mode || 'propose';
      
      if (mode === 'propose') {
        return { path: input.path, proposal: newContent, original: content, status: 'proposed' };
      }

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
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path for the file' },
      content: { type: 'string', description: 'Content to write' },
      mode: { type: 'string', enum: ['propose', 'direct'], description: 'Default is propose for human review' },
    },
    required: ['path', 'content'],
  },
  async call(input) {
    const { writeFile, mkdir, readFile } = await import('fs/promises');
    const { dirname } = await import('path');
    try {
      const mode = input.mode || 'propose';
      
      if (mode === 'propose') {
        let original = '';
        try { original = await readFile(input.path, 'utf-8'); } catch (e) { /* new file */ }
        return { path: input.path, proposal: input.content, original, status: 'proposed' };
      }

      await mkdir(dirname(input.path), { recursive: true });
      await writeFile(input.path, input.content, 'utf-8');
      return { path: input.path, bytesWritten: Buffer.byteLength(input.content), status: 'written' };
    } catch (e) {
      return { error: e.message };
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
    const model = input.model || 'claude-sonnet-4-20250514';
    const rates = { 'claude-sonnet-4-20250514': 3, 'claude-3-opus-20240229': 15, 'claude-3-5-haiku-20241022': 0.25 };
    const costPer1M = rates[model] || 3;
    const estimatedCost = (estimatedTokens / 1_000_000) * costPer1M;

    return {
      text_length: input.text.length,
      estimated_tokens: estimatedTokens,
      model,
      estimated_cost_usd: estimatedCost.toFixed(6),
    };
  },
});

// ─── Tool Registry ────────────────────────────────────────────

export function getAllTools() {
  return [
    AgentTool,
    SendMessageTool,
    TaskStopTool,
    TeamCreateTool,
    BashTool,
    FileReadTool,
    FileWriteTool,
    FilePatchTool,
    WebSearchTool,
    WebFetchTool,
    TokenCalculatorTool,
    WindowsServiceTool,
  ];
}

export function getToolByName(name) {
  return getAllTools().find(t => t.name === name);
}
