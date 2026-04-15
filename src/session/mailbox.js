import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEAMS_DIR = path.join(__dirname, '../../data/teams');

// Memory locks for safe cross-async intra-process file writes
const locks = new Map();

/**
 * Write a message to an agent's inbox in a thread-safe manner.
 */
export async function writeMailbox(teamName, agentId, message) {
  const inboxDir = path.join(TEAMS_DIR, teamName, 'inboxes');
  const mailboxPath = path.join(inboxDir, `${agentId}.json`);
  
  // Wait for lock
  while (locks.get(mailboxPath)) {
    await new Promise(r => setTimeout(r, 20));
  }
  locks.set(mailboxPath, true);

  try {
    if (!fs.existsSync(inboxDir)) {
      fs.mkdirSync(inboxDir, { recursive: true });
    }

    let inbox = [];
    if (fs.existsSync(mailboxPath)) {
      try {
        inbox = JSON.parse(fs.readFileSync(mailboxPath, 'utf8'));
      } catch (err) {
        console.warn(`[Mailbox] Corrupt inbox at ${mailboxPath}, resetting.`);
      }
    }
    
    inbox.push({
      id: Math.random().toString(36).substring(2, 9),
      ...message,
      timestamp: Date.now()
    });
    
    fs.writeFileSync(mailboxPath, JSON.stringify(inbox, null, 2));
  } finally {
    locks.set(mailboxPath, false);
  }
}

/**
 * Reads all messages currently in the mailbox and empties it securely.
 */
export async function readAndClearMailbox(teamName, agentId) {
  const mailboxPath = path.join(TEAMS_DIR, teamName, 'inboxes', `${agentId}.json`);
  
  while (locks.get(mailboxPath)) {
    await new Promise(r => setTimeout(r, 20));
  }
  locks.set(mailboxPath, true);

  try {
    if (!fs.existsSync(mailboxPath)) return [];
    
    let inbox = [];
    try {
      inbox = JSON.parse(fs.readFileSync(mailboxPath, 'utf8'));
    } catch (err) {
      return [];
    }
    
    // Clear mailbox to acknowledge read
    fs.writeFileSync(mailboxPath, JSON.stringify([], null, 2));
    return inbox;
  } catch (err) {
    return [];
  } finally {
    locks.set(mailboxPath, false);
  }
}
