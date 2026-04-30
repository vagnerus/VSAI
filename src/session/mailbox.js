import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEAMS_DIR = path.join(__dirname, '../../data/teams');

/**
 * AsyncMutex — Promise-based lock to replace busy-wait spin-lock (B9 Fix).
 */
class AsyncMutex {
  constructor() {
    this._locks = new Map();
  }

  async acquire(key) {
    while (this._locks.has(key)) {
      await this._locks.get(key);
    }
    let release;
    const promise = new Promise(resolve => { release = resolve; });
    this._locks.set(key, promise);
    return release;
  }

  release(key, releaseFn) {
    this._locks.delete(key);
    if (releaseFn) releaseFn();
  }
}

const mutex = new AsyncMutex();

/**
 * Write a message to an agent's inbox in a thread-safe manner.
 * B9 Fix: Uses AsyncMutex instead of busy-wait spin-lock.
 */
export async function writeMailbox(teamName, agentId, message) {
  const inboxDir = path.join(TEAMS_DIR, teamName, 'inboxes');
  const mailboxPath = path.join(inboxDir, `${agentId}.json`);
  
  const release = await mutex.acquire(mailboxPath);

  try {
    if (!fs.existsSync(inboxDir)) {
      fs.mkdirSync(inboxDir, { recursive: true });
    }

    let inbox = [];
    try {
      const raw = fs.readFileSync(mailboxPath, 'utf8');
      inbox = JSON.parse(raw);
      if (!Array.isArray(inbox)) inbox = [];
    } catch (err) {
      // File doesn't exist or is corrupt — start fresh
      inbox = [];
    }
    
    inbox.push({
      id: Math.random().toString(36).substring(2, 9),
      ...message,
      timestamp: Date.now()
    });
    
    fs.writeFileSync(mailboxPath, JSON.stringify(inbox, null, 2));
  } finally {
    mutex.release(mailboxPath, release);
  }
}

/**
 * Reads all messages currently in the mailbox and empties it securely.
 * B9 Fix: Uses AsyncMutex instead of busy-wait spin-lock.
 */
export async function readAndClearMailbox(teamName, agentId) {
  const mailboxPath = path.join(TEAMS_DIR, teamName, 'inboxes', `${agentId}.json`);
  
  const release = await mutex.acquire(mailboxPath);

  try {
    let inbox = [];
    try {
      const raw = fs.readFileSync(mailboxPath, 'utf8');
      inbox = JSON.parse(raw);
      if (!Array.isArray(inbox)) inbox = [];
    } catch (err) {
      return [];
    }
    
    // Clear mailbox to acknowledge read
    fs.writeFileSync(mailboxPath, JSON.stringify([], null, 2));
    return inbox;
  } catch (err) {
    return [];
  } finally {
    mutex.release(mailboxPath, release);
  }
}
