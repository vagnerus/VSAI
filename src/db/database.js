/**
 * NexusAI — SQLite Database Layer
 * Usa better-sqlite3 para persistência síncrona e confiável.
 * 
 * Tabelas:
 *   sessions  — Metadados de sessões
 *   messages  — Mensagens (user/assistant/tool_result)
 *   projects  — Projetos com configurações
 *   hooks     — Hooks registrados persistentes
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class NexusDB {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../data/nexus.db');
    this.db = null;
  }

  /**
   * Inicializa o banco e executa as migrations.
   */
  init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');   // Write-Ahead Logging — melhor concorrência
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL'); // Equilíbrio velocidade/segurança

    this._migrate();
    console.log(`[NexusDB] SQLite initialized: ${this.dbPath}`);
    return this;
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          TEXT PRIMARY KEY,
        first_prompt TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        project_id  TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        uuid        TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        parent_uuid TEXT,
        role        TEXT NOT NULL,
        type        TEXT NOT NULL,
        content     TEXT,
        tool_calls  TEXT,       -- JSON array
        tool_use_id TEXT,
        tool_name   TEXT,
        is_error    INTEGER DEFAULT 0,
        timestamp   INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT,
        workspace_path TEXT,
        language    TEXT DEFAULT 'Agnóstico',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hooks (
        id          TEXT PRIMARY KEY,
        event       TEXT NOT NULL,
        name        TEXT,
        enabled     INTEGER DEFAULT 1,
        config      TEXT,  -- JSON
        created_at  INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
    `);
  }

  // ─── Sessions ─────────────────────────────────────────────

  upsertSession(sessionId, { firstPrompt, projectId } = {}) {
    const now = Date.now();
    const existing = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);

    if (!existing) {
      this.db.prepare(`
        INSERT INTO sessions (id, first_prompt, created_at, updated_at, project_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, firstPrompt || null, now, now, projectId || null);
    } else {
      this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
    }
  }

  listSessions(limit = 20) {
    return this.db.prepare(`
      SELECT id as sessionId, first_prompt as firstPrompt, created_at as createdAt,
             updated_at as lastModified, message_count as messageCount, project_id as projectId
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit);
  }

  deleteSession(sessionId) {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return result.changes > 0;
  }

  // ─── Messages ─────────────────────────────────────────────

  appendMessage(sessionId, message) {
    this.upsertSession(sessionId, {
      firstPrompt: message.role === 'user' && typeof message.content === 'string'
        ? message.content.substring(0, 200)
        : undefined,
    });

    this.db.prepare(`
      INSERT OR REPLACE INTO messages
        (uuid, session_id, parent_uuid, role, type, content, tool_calls, tool_use_id, tool_name, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.uuid,
      sessionId,
      message.parentUuid || null,
      message.role || 'user',
      message.type || message.role,
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.toolUseId || null,
      message.toolName || null,
      message.isError ? 1 : 0,
      message.timestamp || Date.now(),
    );

    // Update message count
    this.db.prepare('UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?')
      .run(Date.now(), sessionId);
  }

  loadSession(sessionId) {
    const rows = this.db.prepare(`
      SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC
    `).all(sessionId);

    return rows.map(row => ({
      uuid: row.uuid,
      parentUuid: row.parent_uuid,
      role: row.role,
      type: row.type,
      content: (() => { try { return JSON.parse(row.content); } catch { return row.content; } })(),
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolUseId: row.tool_use_id,
      toolName: row.tool_name,
      isError: !!row.is_error,
      timestamp: row.timestamp,
    }));
  }

  // ─── Hooks ────────────────────────────────────────────────

  saveHook(hook) {
    this.db.prepare(`
      INSERT OR REPLACE INTO hooks (id, event, name, enabled, config, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(hook.id, hook.event, hook.name || '', hook.enabled ? 1 : 0, JSON.stringify(hook), Date.now());
  }

  loadHooks() {
    return this.db.prepare('SELECT config FROM hooks WHERE enabled = 1').all()
      .map(row => { try { return JSON.parse(row.config); } catch { return null; } })
      .filter(Boolean);
  }

  deleteHook(id) {
    const result = this.db.prepare('DELETE FROM hooks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Fecha a conexão com o banco.
   */
  close() {
    if (this.db) this.db.close();
  }
}

// Singleton exportado
let _instance = null;

export function getDatabase(dbPath) {
  if (!_instance) {
    _instance = new NexusDB(dbPath);
    _instance.init();
  }
  return _instance;
}
