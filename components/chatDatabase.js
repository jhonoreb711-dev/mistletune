import AsyncStorage from '@react-native-async-storage/async-storage';

// ----------------------------------------------------
// Safe Native SQLite Detection
// ----------------------------------------------------
// Checks whether ExpoSQLite native module is compiled into the current
// client (e.g. custom dev build) or if running in an Expo Go environment
// that lacks the ExpoSQLite native binary.

function checkNativeSqlite() {
  try {
    if (globalThis?.expo?.modules?.ExpoSQLite) {
      return true;
    }
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (typeof requireOptionalNativeModule === 'function') {
      return Boolean(requireOptionalNativeModule('ExpoSQLite'));
    }
  } catch {
    // Native module detection failed; fallback to persistent AsyncStorage
  }
  return false;
}

const hasNativeSqlite = checkNativeSqlite();

// ----------------------------------------------------
// SQLite + Drizzle ORM Engine (Activated if native module exists)
// ----------------------------------------------------
let dbInstance = null;
let sessionsTable = null;
let messagesTable = null;
let drizzleEq = null;
let drizzleDesc = null;
let drizzleAsc = null;

function getSqliteDb() {
  if (!dbInstance && hasNativeSqlite) {
    try {
      const SQLite = require('expo-sqlite');
      const { drizzle } = require('drizzle-orm/expo-sqlite');
      const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');
      const { eq, desc, asc } = require('drizzle-orm');

      drizzleEq = eq;
      drizzleDesc = desc;
      drizzleAsc = asc;

      sessionsTable = sqliteTable('sessions', {
        id: text('id').primaryKey(),
        title: text('title').notNull(),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
      });

      messagesTable = sqliteTable('messages', {
        id: text('id').primaryKey(),
        sessionId: text('session_id').notNull(),
        role: text('role').notNull(),
        content: text('content').notNull(),
        createdAt: integer('created_at').notNull(),
      });

      const expoDb = SQLite.openDatabaseSync('mistletunes_chat.db');
      expoDb.execSync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      `);

      dbInstance = drizzle(expoDb, { schema: { sessions: sessionsTable, messages: messagesTable } });
    } catch (err) {
      console.warn('Failed to initialize SQLite/Drizzle:', err);
      dbInstance = null;
    }
  }
  return dbInstance;
}

// ----------------------------------------------------
// AsyncStorage Fallback Engine (100% supported in all Expo Go clients)
// ----------------------------------------------------
const STORAGE_SESSIONS_KEY = '@mistletunes_chat_sessions';
const STORAGE_MESSAGES_PREFIX = '@mistletunes_chat_msgs_';

async function asyncStorageGetAllSessions() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SESSIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
  } catch (err) {
    console.warn('Error reading sessions from storage:', err);
    return [];
  }
}

async function asyncStorageSaveSessions(sessionsList) {
  try {
    await AsyncStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessionsList));
  } catch (err) {
    console.warn('Error saving sessions to storage:', err);
  }
}

async function asyncStorageGetSessionMessages(sessionId) {
  if (!sessionId) return [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_MESSAGES_PREFIX + sessionId);
    const msgs = raw ? JSON.parse(raw) : [];
    return Array.isArray(msgs) ? msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) : [];
  } catch (err) {
    console.warn('Error reading messages from storage:', err);
    return [];
  }
}

async function asyncStorageSaveSessionMessages(sessionId, messagesList) {
  if (!sessionId) return;
  try {
    await AsyncStorage.setItem(STORAGE_MESSAGES_PREFIX + sessionId, JSON.stringify(messagesList));
  } catch (err) {
    console.warn('Error saving messages to storage:', err);
  }
}

function generateId(prefix = '') {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ----------------------------------------------------
// Public Session & Message API (Universal)
// ----------------------------------------------------

/**
 * Creates a new conversation session.
 */
export async function createSession(title = 'New Conversation') {
  const now = Date.now();
  const newSession = {
    id: generateId('sess_'),
    title: title.trim() || 'New Conversation',
    createdAt: now,
    updatedAt: now,
  };

  const db = getSqliteDb();
  if (db && sessionsTable) {
    try {
      await db.insert(sessionsTable).values(newSession);
      return newSession;
    } catch (err) {
      console.warn('SQLite insert session failed, saving to storage:', err);
    }
  }

  const all = await asyncStorageGetAllSessions();
  const updated = [newSession, ...all.filter((s) => s.id !== newSession.id)];
  await asyncStorageSaveSessions(updated);
  return newSession;
}

/**
 * Retrieves all conversation sessions ordered by most recently active.
 */
export async function getAllSessions() {
  const db = getSqliteDb();
  if (db && sessionsTable && drizzleDesc) {
    try {
      return await db.select().from(sessionsTable).orderBy(drizzleDesc(sessionsTable.updatedAt));
    } catch (err) {
      console.warn('SQLite getAllSessions failed, reading from storage:', err);
    }
  }
  return await asyncStorageGetAllSessions();
}

/**
 * Retrieves a single session by its ID.
 */
export async function getSession(sessionId) {
  if (!sessionId) return null;
  const db = getSqliteDb();
  if (db && sessionsTable && drizzleEq) {
    try {
      const res = await db.select().from(sessionsTable).where(drizzleEq(sessionsTable.id, sessionId));
      return res[0] || null;
    } catch (err) {
      console.warn('SQLite getSession failed, reading from storage:', err);
    }
  }
  const all = await asyncStorageGetAllSessions();
  return all.find((s) => s.id === sessionId) || null;
}

/**
 * Retrieves all messages for a specific session ordered chronologically.
 */
export async function getSessionMessages(sessionId) {
  if (!sessionId) return [];
  const db = getSqliteDb();
  if (db && messagesTable && drizzleAsc && drizzleEq) {
    try {
      return await db
        .select()
        .from(messagesTable)
        .where(drizzleEq(messagesTable.sessionId, sessionId))
        .orderBy(drizzleAsc(messagesTable.createdAt));
    } catch (err) {
      console.warn('SQLite getSessionMessages failed, reading from storage:', err);
    }
  }
  return await asyncStorageGetSessionMessages(sessionId);
}

/**
 * Adds a message to a session, updates updatedAt, and auto-names if 'New Conversation'.
 */
export async function addMessageToSession(sessionId, role, content) {
  if (!sessionId || !content) return null;
  const now = Date.now();
  const newMessage = {
    id: generateId('msg_'),
    sessionId,
    role,
    content,
    createdAt: now,
  };

  const currentSession = await getSession(sessionId);
  let newTitle = null;
  if (
    currentSession &&
    role === 'user' &&
    (currentSession.title === 'New Conversation' || !currentSession.title)
  ) {
    const cleanPrompt = content.replace(/[\r\n]+/g, ' ').trim();
    newTitle = cleanPrompt.length > 32
      ? `${cleanPrompt.slice(0, 32).trim()}...`
      : cleanPrompt || 'Conversation';
  }

  const db = getSqliteDb();
  if (db && messagesTable && sessionsTable && drizzleEq) {
    try {
      await db.insert(messagesTable).values(newMessage);
      if (currentSession) {
        const updateData = { updatedAt: now };
        if (newTitle) updateData.title = newTitle;
        await db.update(sessionsTable).set(updateData).where(drizzleEq(sessionsTable.id, sessionId));
      }
      return newMessage;
    } catch (err) {
      console.warn('SQLite addMessage failed, saving to storage:', err);
    }
  }

  const msgs = await asyncStorageGetSessionMessages(sessionId);
  msgs.push(newMessage);
  await asyncStorageSaveSessionMessages(sessionId, msgs);

  const allSessions = await asyncStorageGetAllSessions();
  const sessionIdx = allSessions.findIndex((s) => s.id === sessionId);
  if (sessionIdx !== -1) {
    allSessions[sessionIdx].updatedAt = now;
    if (newTitle) allSessions[sessionIdx].title = newTitle;
    await asyncStorageSaveSessions(allSessions);
  }

  return newMessage;
}

/**
 * Renames an existing session title.
 */
export async function updateSessionTitle(sessionId, newTitle) {
  if (!sessionId || !newTitle) return;
  const cleanTitle = newTitle.trim();
  const now = Date.now();

  const db = getSqliteDb();
  if (db && sessionsTable && drizzleEq) {
    try {
      await db
        .update(sessionsTable)
        .set({ title: cleanTitle, updatedAt: now })
        .where(drizzleEq(sessionsTable.id, sessionId));
      return;
    } catch (err) {
      console.warn('SQLite updateSessionTitle failed, updating in storage:', err);
    }
  }

  const allSessions = await asyncStorageGetAllSessions();
  const sessionIdx = allSessions.findIndex((s) => s.id === sessionId);
  if (sessionIdx !== -1) {
    allSessions[sessionIdx].title = cleanTitle;
    allSessions[sessionIdx].updatedAt = now;
    await asyncStorageSaveSessions(allSessions);
  }
}

/**
 * Deletes a session and all its messages.
 */
export async function deleteSession(sessionId) {
  if (!sessionId) return;

  const db = getSqliteDb();
  if (db && messagesTable && sessionsTable && drizzleEq) {
    try {
      await db.delete(messagesTable).where(drizzleEq(messagesTable.sessionId, sessionId));
      await db.delete(sessionsTable).where(drizzleEq(sessionsTable.id, sessionId));
      return;
    } catch (err) {
      console.warn('SQLite deleteSession failed, deleting from storage:', err);
    }
  }

  const allSessions = await asyncStorageGetAllSessions();
  const filtered = allSessions.filter((s) => s.id !== sessionId);
  await asyncStorageSaveSessions(filtered);
  await AsyncStorage.removeItem(STORAGE_MESSAGES_PREFIX + sessionId);
}

/**
 * Clears all conversation sessions and messages.
 */
export async function clearAllSessions() {
  const db = getSqliteDb();
  if (db && messagesTable && sessionsTable) {
    try {
      await db.delete(messagesTable);
      await db.delete(sessionsTable);
      return;
    } catch (err) {
      console.warn('SQLite clearAllSessions failed, clearing storage:', err);
    }
  }

  const allSessions = await asyncStorageGetAllSessions();
  for (const sess of allSessions) {
    await AsyncStorage.removeItem(STORAGE_MESSAGES_PREFIX + sess.id);
  }
  await AsyncStorage.removeItem(STORAGE_SESSIONS_KEY);
}
