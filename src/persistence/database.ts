import "dotenv/config";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import { encrypt, decrypt } from "../utils/crypto";

let db: Database | null = null;
let schemaEnsured = false;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  
  db = await open({
    filename: "./debate.db",
    driver: sqlite3.Database,
  });
  
  // Debates table - full debate history
  await db.exec(`
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      protocol TEXT NOT NULL,
      result TEXT,
      status TEXT DEFAULT 'pending',
      agents TEXT,
      canvas_content TEXT,
      metrics TEXT,
      created_at INTEGER,
      completed_at INTEGER,
      duration INTEGER
    )
  `);
  
  // Debate messages/turns
  await db.exec(`
    CREATE TABLE IF NOT EXISTS debate_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'argument',
      reasoning TEXT,
      round_number INTEGER,
      created_at INTEGER,
      FOREIGN KEY(debate_id) REFERENCES debates(id)
    )
  `);
  
  // Settings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT DEFAULT 'string',
      updated_at INTEGER
    )
  `);
  
  // API Keys table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      provider TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      updated_at INTEGER
    )
  `);

  // Roles table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL,
      preferred_provider TEXT,
      preferred_model TEXT,
      is_custom INTEGER DEFAULT 0,
      updated_at INTEGER
    )
  `);

  // Seed default roles if empty
  const roleCount = await db.get("SELECT COUNT(*) as count FROM roles");
  if (roleCount.count === 0) {
    const defaultRoles = [
      ["builder", "Builder", "Constructs robust solutions and implementation plans", "You are the Builder. Your goal is to construct a practical, robust, and scalable implementation plan based on the query. Focus on technical details, architecture, and efficiency.", "google", "gemini-1.5-flash"],
      ["critic", "Critic", "Identifies vulnerabilities and potential flaws", "You are the Critic. Your goal is to find flaws, vulnerabilities, and weaknesses in the proposed solutions. Be rigorous and focus on data integrity and security.", "openrouter", "anthropic/claude-3.5-sonnet"],
      ["skeptic", "Skeptic", "Questions underlying assumptions and data", "You are the Skeptic. Your goal is to question the underlying assumptions and suggest alternative perspectives. Focus on empirical data and user behavior.", "google", "gemini-1.5-flash"],
      ["scientist", "Scientist", "Researches thoroughly and ensures standards", "You are the Scientist. Your goal is to ensure the proposed methodology aligns with established industry standards and scientific research.", "groq", "llama-3.3-70b-versatile"],
      ["verifier", "Verifier", "Verifies facts and cross-references claims", "You are the Verifier. Your goal is to cross-reference all claims against available documentation and verify the accuracy of the information provided.", "google", "gemini-1.5-flash"]
    ];
    for (const role of defaultRoles) {
      await db.run(
        "INSERT INTO roles (id, name, description, system_prompt, preferred_provider, preferred_model, is_custom, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
        [...role, Date.now()]
      );
    }
  }
  
  // Migrate keys from settings to api_keys if they exist
  await migrateKeysToDedicatedTable(db);
  
  // Legacy sessions table (kept for compatibility)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      query TEXT,
      result TEXT,
      status TEXT,
      created_at INTEGER,
      completed_at INTEGER
    )
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      role TEXT,
      content TEXT,
      created_at INTEGER,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    )
  `);

  // Run migrations
  await ensureSchema(db);
  
  return db;
}

async function ensureSchema(database: Database): Promise<void> {
  if (schemaEnsured) return;
  schemaEnsured = true;
  
  // Ensure canvas_content exists in debates
  try {
    await database.exec("ALTER TABLE debates ADD COLUMN canvas_content TEXT");
  } catch (e) {
    // Column likely already exists
  }

  // Ensure reasoning exists in debate_messages
  try {
    await database.exec("ALTER TABLE debate_messages ADD COLUMN reasoning TEXT");
  } catch (e) {
    // Column likely already exists
  }
}

export async function saveSession(
  sessionId: string,
  query: string,
  result: object,
  status: string
): Promise<void> {
  const database = await initDatabase();
  await database.run(
    "INSERT OR REPLACE INTO sessions (id, query, result, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
    [sessionId, query, JSON.stringify(result), status, Date.now(), status === "completed" ? Date.now() : null]
  );
}

export async function getSession(sessionId: string): Promise<{ id: string; query: string; result: object; status: string } | null> {
  const database = await initDatabase();
  const row = await database.get("SELECT * FROM sessions WHERE id = ?", [sessionId]);
  if (!row) return null;
  return {
    id: row.id,
    query: row.query,
    result: JSON.parse(row.result || "{}"),
    status: row.status,
  };
}

export async function getRecentSessions(limit = 10): Promise<{ id: string; query: string; status: string }[]> {
  const database = await initDatabase();
  const rows = await database.all("SELECT id, query, status FROM sessions ORDER BY created_at DESC LIMIT ?", [limit]);
  return rows.map((row: any) => ({
    id: row.id,
    query: row.query,
    status: row.status,
  }));
}

// ============ Settings Management ============

export async function saveSetting(key: string, value: unknown, type = "json"): Promise<void> {
  const database = await initDatabase();
  const valueStr = typeof value === "string" ? value : JSON.stringify(value);
  await database.run(
    "INSERT OR REPLACE INTO settings (key, value, type, updated_at) VALUES (?, ?, ?, ?)",
    [key, valueStr, type, Date.now()]
  );
}

export async function getSetting(key: string): Promise<unknown | null> {
  const database = await initDatabase();
  const row = await database.get("SELECT value, type FROM settings WHERE key = ?", [key]);
  if (!row) return null;
  
  try {
    return row.type === "json" ? JSON.parse(row.value) : row.value;
  } catch {
    return row.value;
  }
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const database = await initDatabase();
  const rows = await database.all("SELECT key, value, type FROM settings");
  const result: Record<string, unknown> = {};
  
  for (const row of rows) {
    try {
      result[row.key] = row.type === "json" ? JSON.parse(row.value) : row.value;
    } catch {
      result[row.key] = row.value;
    }
  }
  
  return result;
}

export async function deleteSetting(key: string): Promise<void> {
  const database = await initDatabase();
  await database.run("DELETE FROM settings WHERE key = ?", [key]);
}

// ============ API Key Management ============

export async function saveApiKey(provider: string, key: string): Promise<void> {
  const database = await initDatabase();
  const encryptedKey = encrypt(key);
  await database.run(
    "INSERT OR REPLACE INTO api_keys (provider, key, updated_at) VALUES (?, ?, ?)",
    [provider, encryptedKey, Date.now()]
  );
}

export async function getApiKey(provider: string): Promise<string | null> {
  const database = await initDatabase();
  const row = await database.get("SELECT key FROM api_keys WHERE provider = ?", [provider]);
  return row ? decrypt(row.key) : null;
}

export async function getAllApiKeys(): Promise<Record<string, { key: string; status: string; updatedAt: number }>> {
  const database = await initDatabase();
  const rows = await database.all("SELECT provider, key, status, updated_at FROM api_keys");
  const result: Record<string, { key: string; status: string; updatedAt: number }> = {};
  
  // 1. Fill from DB
  for (const row of rows) {
    result[row.provider] = {
      key: decrypt(row.key),
      status: row.status,
      updatedAt: row.updated_at,
    };
  }
  
  // 2. Overlay from ENV for missing providers
  const envMapping: Record<string, string | undefined> = {
    google: process.env.GOOGLE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    cohere: process.env.COHERE_API_KEY,
    together: process.env.TOGETHER_API_KEY,
  };
  
  for (const [provider, key] of Object.entries(envMapping)) {
    if (key && key.trim() !== "" && !result[provider]) {
      result[provider] = {
        key: key,
        status: "active",
        updatedAt: Date.now(),
      };
    }
  }
  
  return result;
}

export async function deleteApiKey(provider: string): Promise<void> {
  const database = await initDatabase();
  await database.run("DELETE FROM api_keys WHERE provider = ?", [provider]);
}

async function migrateKeysToDedicatedTable(database: Database): Promise<void> {
  try {
    const row = await database.get("SELECT value FROM settings WHERE key = 'apiKeys'");
    if (row) {
      const keys = JSON.parse(row.value);
      for (const [provider, key] of Object.entries(keys)) {
        if (key && typeof key === "string") {
          await database.run(
            "INSERT OR IGNORE INTO api_keys (provider, key, updated_at) VALUES (?, ?, ?)",
            [provider, key, Date.now()]
          );
        }
      }
      // Note: We keep the old setting for now to avoid breaking existing frontend if it's not updated yet,
      // but the backend will prefer the new table.
    }
  } catch (error) {
    console.error("[Database] Migration failed:", error);
  }
}

// ============ Debate Management ============

export async function saveDebate(id: string, query: string, protocol: string, agents: string[]): Promise<void> {
  const database = await initDatabase();
  await database.run(
    "INSERT INTO debates (id, query, protocol, agents, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, query, protocol, JSON.stringify(agents), "running", Date.now()]
  );
}

export async function updateDebateCanvas(id: string, content: string): Promise<void> {
  const database = await initDatabase();
  await database.run("UPDATE debates SET canvas_content = ? WHERE id = ?", [content, id]);
}

export async function getDebate(id: string): Promise<any> {
  const database = await initDatabase();
  const row = await database.get(`
    SELECT d.*,
           (
             SELECT COUNT(*)
             FROM debate_messages dm
             WHERE dm.debate_id = d.id
           ) AS message_count
    FROM debates d
    WHERE d.id = ?
  `, [id]);
  if (!row) return null;
  
  return {
    id: row.id,
    query: row.query,
    protocol: row.protocol,
    status: row.status,
    agents: JSON.parse(row.agents || "[]"),
    canvasContent: row.canvas_content,
    result: row.result ? JSON.parse(row.result) : null,
    startedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    createdAt: row.created_at,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    duration: row.duration,
    messageCount: row.message_count ?? 0,
    usedFallback: row.result ? JSON.stringify(JSON.parse(row.result)?.metrics?.providersUsed || []).includes("fallback-mock") : false,
  };
}

export async function getAllDebates(limit = 50, offset = 0): Promise<any[]> {
  const database = await initDatabase();
  const rows = await database.all(
    `SELECT d.id,
            d.query,
            d.protocol,
            d.status,
            d.agents,
            d.result,
            d.created_at,
            d.completed_at,
            d.duration,
            (
              SELECT COUNT(*)
              FROM debate_messages dm
              WHERE dm.debate_id = d.id
            ) AS message_count
     FROM debates d
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  
  return rows.map((row: any) => ({
    id: row.id,
    query: row.query,
    protocol: row.protocol,
    status: row.status,
    agents: JSON.parse(row.agents || "[]"),
    result: row.result ? JSON.parse(row.result) : null,
    startedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    createdAt: row.created_at,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    duration: row.duration,
    messageCount: row.message_count ?? 0,
    usedFallback: row.result ? JSON.stringify(JSON.parse(row.result)?.metrics?.providersUsed || []).includes("fallback-mock") : false,
  }));
}

export async function updateDebateStatus(id: string, status: string, result?: object): Promise<void> {
  const database = await initDatabase();
  const now = Date.now();
  const startRow = await database.get("SELECT created_at FROM debates WHERE id = ?", [id]);
  const duration = startRow ? now - startRow.created_at : 0;
  
  await database.run(
    "UPDATE debates SET status = ?, completed_at = ?, duration = ?, result = ? WHERE id = ?",
    [status, now, duration, result ? JSON.stringify(result) : null, id]
  );
}

export async function markStaleDebates(maxAgeMs: number): Promise<number> {
  const database = await initDatabase();
  const now = Date.now();
  const threshold = now - maxAgeMs;
  const staleRows = await database.all(
    "SELECT id, created_at FROM debates WHERE status = 'running' AND created_at < ?",
    [threshold]
  );

  for (const row of staleRows) {
    const duration = row.created_at ? now - row.created_at : maxAgeMs;
    await database.run(
      "UPDATE debates SET status = ?, completed_at = ?, duration = ? WHERE id = ?",
      ["failed", now, duration, row.id]
    );

    const existingMessage = await database.get(
      "SELECT id FROM debate_messages WHERE debate_id = ? AND agent_name = ? AND content = ? LIMIT 1",
      [row.id, "System", "Debate marked as stale after exceeding the runtime timeout window."]
    );

    if (!existingMessage) {
      await database.run(
        "INSERT INTO debate_messages (debate_id, agent_name, content, message_type, round_number, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          row.id,
          "System",
          "Debate marked as stale after exceeding the runtime timeout window.",
          "response",
          0,
          now,
        ]
      );
    }
  }

  return staleRows.length;
}

export async function addDebateMessage(
  debateId: string,
  agentName: string,
  content: string,
  type: string = "argument",
  reasoning?: string,
  roundNumber?: number
): Promise<void> {
  const database = await initDatabase();
  await database.run(
    "INSERT INTO debate_messages (debate_id, agent_name, content, message_type, reasoning, round_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [debateId, agentName, content, type, reasoning || null, roundNumber || 0, Date.now()]
  );
}

export async function getDebateMessages(debateId: string): Promise<any[]> {
  const database = await initDatabase();
  const rows = await database.all(
    "SELECT id, agent_name, content, message_type, reasoning, round_number, created_at FROM debate_messages WHERE debate_id = ? ORDER BY created_at ASC",
    [debateId]
  );
  
  return rows.map((row: any) => ({
    id: row.id,
    agent: row.agent_name,
    content: row.content,
    reasoning: row.reasoning,
    type: row.message_type,
    round: row.round_number,
    timestamp: new Date(row.created_at).toISOString(),
  }));
}

// ============ Role Management ============

export async function saveRole(role: {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  preferredProvider?: string;
  preferredModel?: string;
  isCustom?: boolean;
}): Promise<void> {
  const database = await initDatabase();
  await database.run(
    `INSERT OR REPLACE INTO roles (
      id, name, description, system_prompt, preferred_provider, preferred_model, is_custom, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      role.id,
      role.name,
      role.description,
      role.systemPrompt,
      role.preferredProvider,
      role.preferredModel,
      role.isCustom ? 1 : 0,
      Date.now()
    ]
  );
}

export async function getRole(id: string): Promise<any | null> {
  const database = await initDatabase();
  const row = await database.get("SELECT * FROM roles WHERE id = ?", [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    preferredProvider: row.preferred_provider,
    preferredModel: row.preferred_model,
    isCustom: row.is_custom === 1,
    updatedAt: row.updated_at
  };
}

export async function getAllRoles(): Promise<any[]> {
  const database = await initDatabase();
  const rows = await database.all("SELECT * FROM roles ORDER BY is_custom ASC, id ASC");
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    preferredProvider: row.preferred_provider,
    preferredModel: row.preferred_model,
    isCustom: row.is_custom === 1,
    updatedAt: row.updated_at
  }));
}

export async function deleteRole(id: string): Promise<void> {
  const database = await initDatabase();
  // Don't allow deleting core system roles
  await database.run("DELETE FROM roles WHERE id = ? AND is_custom = 1", [id]);
}
