import { readFile, writeFile, mkdir, appendFile, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * SessionStorage — Persistência de sessões.
 *
 * Suporta dois backends:
 *   - JSONL (padrão): Append-only, crash-safe, sem dependências extras
 *   - SQLite: Quando USE_DATABASE=true no .env (requer NexusDB inicializado)
 *
 * A interface pública é idêntica em ambos os modos.
 */
export class SessionStorage {
  constructor(storagePath, db = null) {
    this.storagePath = storagePath || './data/sessions';
    this.db = db; // instância NexusDB (opcional)
    this.useDatabase = !!db || process.env.USE_DATABASE === 'true';

    // JSONL write queue (usado apenas no modo JSONL)
    this.writeQueues = new Map();
    this.drainTimer = null;
    this.DRAIN_INTERVAL = 100; // 100ms coalescing
  }

  async init() {
    if (this.useDatabase && !this.db) {
      // Carregar NexusDB dinamicamente se USE_DATABASE=true mas db não injetado
      try {
        const { getDatabase } = await import('../db/database.js');
        this.db = getDatabase(process.env.DATABASE_PATH);
        console.log('[SessionStorage] Backend: SQLite');
      } catch (e) {
        console.warn('[SessionStorage] SQLite falhou, usando JSONL:', e.message);
        this.useDatabase = false;
      }
    } else if (!this.useDatabase) {
      console.log('[SessionStorage] Backend: JSONL');
    }

    // Sempre garante que o diretório de sessões existe (usado também para backups)
    await mkdir(this.storagePath, { recursive: true });
  }

  // ─── Interface pública ─────────────────────────────────────

  async appendEntry(sessionId, entry) {
    const jsonlEntry = {
      ...entry,
      uuid: entry.uuid || uuidv4(),
      timestamp: entry.timestamp || Date.now(),
    };

    if (this.useDatabase && this.db) {
      this.db.appendMessage(sessionId, jsonlEntry);
    } else {
      await this._jsonlAppend(sessionId, jsonlEntry);
    }
  }

  async loadSession(sessionId) {
    if (this.useDatabase && this.db) {
      return this.db.loadSession(sessionId);
    }
    return this._jsonlLoad(sessionId);
  }

  async listSessions(limit = 20) {
    if (this.useDatabase && this.db) {
      return this.db.listSessions(limit);
    }
    return this._jsonlListSessions(limit);
  }

  async deleteSession(sessionId) {
    if (this.useDatabase && this.db) {
      return this.db.deleteSession(sessionId);
    }
    return this._jsonlDeleteSession(sessionId);
  }

  // ─── JSONL Backend ─────────────────────────────────────────

  async _jsonlAppend(sessionId, entry) {
    const filePath = this._getSessionPath(sessionId);

    if (!this.writeQueues.has(filePath)) {
      this.writeQueues.set(filePath, []);
    }
    this.writeQueues.get(filePath).push(entry);
    this._scheduleDrain();
  }

  _scheduleDrain() {
    if (this.drainTimer) return;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this._drainWriteQueue();
    }, this.DRAIN_INTERVAL);
  }

  async _drainWriteQueue() {
    for (const [filePath, entries] of this.writeQueues) {
      if (entries.length === 0) continue;

      const batch = entries.splice(0, entries.length);
      const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n';

      try {
        await mkdir(dirname(filePath), { recursive: true });
        await appendFile(filePath, lines, { mode: 0o600 });
      } catch (err) {
        console.error(`[SessionStorage] Write error: ${err.message}`);
      }
    }
  }

  async flush() {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
    await this._drainWriteQueue();
  }

  async _jsonlLoad(sessionId) {
    const filePath = this._getSessionPath(sessionId);

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const messages = new Map();

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.uuid) messages.set(entry.uuid, entry);
        } catch {
          // Skip malformed lines
        }
      }

      return this._buildConversationChain(messages);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  _buildConversationChain(messages) {
    if (messages.size === 0) return [];

    let latestLeaf = null;
    let latestTimestamp = 0;

    for (const [, msg] of messages) {
      if ((msg.type === 'user' || msg.type === 'assistant') && msg.timestamp > latestTimestamp) {
        let isLeaf = true;
        for (const [, child] of messages) {
          if (child.parentUuid === msg.uuid) { isLeaf = false; break; }
        }
        if (isLeaf) { latestLeaf = msg; latestTimestamp = msg.timestamp; }
      }
    }

    if (!latestLeaf) {
      return Array.from(messages.values())
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }

    const chain = [];
    const seen = new Set();
    let current = latestLeaf;

    while (current) {
      if (seen.has(current.uuid)) break;
      seen.add(current.uuid);
      chain.push(current);
      current = current.parentUuid ? messages.get(current.parentUuid) : null;
    }

    chain.reverse();
    return chain;
  }

  async _jsonlListSessions(limit = 20) {
    try {
      const files = await readdir(this.storagePath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      const stats = await Promise.all(
        jsonlFiles.map(async f => {
          const filePath = join(this.storagePath, f);
          const s = await stat(filePath);
          return { file: f, path: filePath, mtime: s.mtime, size: s.size };
        })
      );

      stats.sort((a, b) => b.mtime - a.mtime);
      const top = stats.slice(0, limit);

      const sessions = [];
      for (const entry of top) {
        try {
          const info = await this._readSessionLite(entry.path, entry.size);
          sessions.push({ sessionId: entry.file.replace('.jsonl', ''), ...info, size: entry.size, lastModified: entry.mtime });
        } catch {
          sessions.push({ sessionId: entry.file.replace('.jsonl', ''), firstPrompt: '(Unable to read)', lastModified: entry.mtime, size: entry.size });
        }
      }

      return sessions;
    } catch {
      return [];
    }
  }

  async _readSessionLite(filePath, fileSize) {
    const LITE_BUF_SIZE = 65536;
    const content = await readFile(filePath, 'utf-8');
    const head = content.substring(0, LITE_BUF_SIZE);

    let firstPrompt = '';
    let createdAt = null;
    let messageCount = 0;

    const headLines = head.split('\n').filter(Boolean);
    for (const line of headLines) {
      try {
        const entry = JSON.parse(line);
        messageCount++;
        if (!firstPrompt && entry.role === 'user' && typeof entry.content === 'string') {
          firstPrompt = entry.content.substring(0, 200);
        }
        if (!createdAt && entry.timestamp) createdAt = entry.timestamp;
      } catch { /* skip */ }
    }

    const totalLines = content.split('\n').filter(Boolean).length;

    return {
      firstPrompt: firstPrompt || '(Empty session)',
      createdAt: createdAt ? new Date(createdAt).toISOString() : null,
      messageCount: totalLines,
    };
  }

  async _jsonlDeleteSession(sessionId) {
    const { unlink } = await import('fs/promises');
    const filePath = this._getSessionPath(sessionId);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  _getSessionPath(sessionId) {
    return join(this.storagePath, `${sessionId}.jsonl`);
  }
}
