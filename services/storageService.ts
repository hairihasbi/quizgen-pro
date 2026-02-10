
import { createClient } from "@libsql/client";
import { Quiz, User, ApiKey, QuizLog, EmailNotification, UserRole, Transaction, PaymentSettings, PaymentPackage, Question, LogCategory, UserStatus, EmailSettings, GoogleSettings } from '../types';

let _client: any = null;
let _isLocal = true;

const CONFIG_KEY = 'quizgen_db_config';
const JWT_SECRET = 'qzgen_secure_2024_#!_supersecret';

export const StorageService = {
  isLocal: () => _isLocal,

  base64UrlEncode: (str: string): string => {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },

  base64UrlDecode: (str: string): string => {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
  },

  generateSignature: async (header: string, payload: string, secret: string): Promise<string> => {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const data = encoder.encode(`${header}.${payload}`);

    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, data);
    return StorageService.base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  },

  createToken: async (user: User): Promise<string> => {
    const header = StorageService.base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = StorageService.base64UrlEncode(JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    }));

    const signature = await StorageService.generateSignature(header, payload, JWT_SECRET);
    return `${header}.${payload}.${signature}`;
  },

  verifyToken: async (token: string): Promise<any | null> => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, payload, signature] = parts;
      const expectedSignature = await StorageService.generateSignature(header, payload, JWT_SECRET);

      if (signature !== expectedSignature) return null;

      const decodedPayload = JSON.parse(StorageService.base64UrlDecode(payload));
      if (decodedPayload.exp < Math.floor(Date.now() / 1000)) return null;

      return decodedPayload;
    } catch (e) {
      return null;
    }
  },

  hashPassword: async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iterations = 100000;
    
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    const hash = await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as any, iterations: iterations, hash: "SHA-256" },
      keyMaterial,
      256
    );

    const saltHex = StorageService.bufferToHex(salt.buffer);
    const hashHex = StorageService.bufferToHex(hash);
    return `v1$${saltHex}$${iterations}$${hashHex}`;
  },

  verifyPassword: async (password: string, storedHash: string): Promise<boolean> => {
    try {
      if (!storedHash || !storedHash.startsWith('v1$')) {
        return btoa(password) === storedHash;
      }

      const [version, saltHex, iterationsStr, hashHex] = storedHash.split('$');
      const salt = StorageService.hexToBuffer(saltHex);
      const iterations = parseInt(iterationsStr);
      const encoder = new TextEncoder();

      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt as any, iterations: iterations, hash: "SHA-256" },
        keyMaterial,
        256
      );

      return StorageService.bufferToHex(derivedBits) === hashHex;
    } catch (e) {
      return false;
    }
  },

  bufferToHex: (buffer: ArrayBuffer): string => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''),
  hexToBuffer: (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    return bytes;
  },

  localGet: (key: string): any => {
    const data = localStorage.getItem(`quizgen_${key}`);
    try {
      return data ? JSON.parse(data) : (['api_keys', 'users', 'emails', 'quizzes', 'transactions', 'logs'].includes(key) ? [] : null);
    } catch (e) {
      return data;
    }
  },

  localSet: (key: string, value: any) => {
    localStorage.setItem(`quizgen_${key}`, JSON.stringify(value));
  },

  sanitizeInput: (str: string): string => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  maskKey: (key: string): string => {
    if (!key || key.length < 8) return '********';
    const prefix = key.includes('_') ? key.split('_')[0] + '_' : '';
    const suffix = key.substring(key.length - 4);
    return `${prefix}••••••••••••${suffix}`;
  },

  getStoredConfig: () => {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return JSON.parse(stored);
    return { url: process.env.TURSO_DB_URL || '', token: process.env.TURSO_AUTH_TOKEN || '' };
  },

  setCloudConfig: (url: string, token: string) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, token }));
    _client = null; 
  },

  getClient: () => {
    if (_client) return _client;
    const config = StorageService.getStoredConfig();
    if (!config.url) return null;
    try {
      _client = createClient({ url: config.url, authToken: config.token });
      _isLocal = false;
      return _client;
    } catch (e) {
      _isLocal = true;
      return null;
    }
  },

  init: async () => {
    const client = StorageService.getClient();
    
    // Konfigurasi Default Users
    const createDefaultUsers = async () => {
      const adminHash = await StorageService.hashPassword('Midorima88@@');
      const teacherHash = await StorageService.hashPassword('guru123');
      return [
        { id: '1', username: 'hairi', fullName: 'Admin Hairi', role: UserRole.ADMIN, credits: 999999, isActive: true, email: 'hairi@quizgen.pro', status: 'approved', password: adminHash, createdAt: new Date().toISOString() },
        { id: '2', username: 'guru123', fullName: 'Guru Demo', role: UserRole.TEACHER, credits: 10, isActive: true, email: 'guru@sekolah.sch.id', status: 'approved', password: teacherHash, createdAt: new Date().toISOString() }
      ];
    };

    if (!client) {
      _isLocal = true;
      if (StorageService.localGet('users').length === 0) {
        const defaults = await createDefaultUsers();
        StorageService.localSet('users', defaults);
      }
      return true;
    }

    try {
      // 1. Pastikan tabel ada
      await client.batch([
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, fullName TEXT, role TEXT, credits INTEGER, isActive INTEGER, email TEXT, status TEXT, password TEXT, createdAt TEXT)`,
        `CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, title TEXT, subject TEXT, level TEXT, grade TEXT, topic TEXT, subTopic TEXT, difficulty TEXT, questions TEXT, grid TEXT, tags TEXT, authorId TEXT, authorName TEXT, isPublished INTEGER, createdAt TEXT, status TEXT)`,
        `CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, timestamp TEXT, category TEXT, action TEXT, details TEXT, status TEXT, userId TEXT, metadata TEXT)`,
        `CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, key TEXT, usage_count INTEGER, last_used TEXT, isActive INTEGER, error_count INTEGER DEFAULT 0, last_error_at TEXT)`,
        `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, userId TEXT, amount INTEGER, credits INTEGER, status TEXT, externalId TEXT, createdAt TEXT)`,
        `CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, to_addr TEXT, subject TEXT, body TEXT, type TEXT, timestamp TEXT, isRead INTEGER)`,
        `CREATE TABLE IF NOT EXISTS payment_settings (id TEXT PRIMARY KEY, data TEXT)`,
        `CREATE TABLE IF NOT EXISTS email_settings (id TEXT PRIMARY KEY, data TEXT)`,
        `CREATE TABLE IF NOT EXISTS google_settings (id TEXT PRIMARY KEY, data TEXT)`
      ], "write");

      // 2. Cek apakah tabel user kosong (Seeding Cloud)
      const userCheck = await client.execute("SELECT COUNT(*) as count FROM users");
      const userCount = Number(userCheck.rows[0].count);

      if (userCount === 0) {
        console.log("[STORAGE] Cloud Database is empty. Seeding initial admin users...");
        const defaults = await createDefaultUsers();
        const statements = defaults.map(u => ({
          sql: "INSERT INTO users (id, username, fullName, role, credits, isActive, email, status, password, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          args: [u.id, u.username, u.fullName, u.role, u.credits, 1, u.email, u.status, u.password, u.createdAt]
        }));
        await client.batch(statements, "write");
      }

      await StorageService.syncFull();
      return true;
    } catch (e) {
      console.error("[STORAGE_INIT_ERROR]", e);
      _isLocal = true;
      return true;
    }
  },

  syncFull: async () => {
    const client = StorageService.getClient();
    if (!client || _isLocal) return;
    try {
      const [resKeys, resUsers, resPayment, resEmails, resQuizzes, resTrx, resEmailSettings, resGoogle] = await Promise.all([
        client.execute("SELECT * FROM api_keys"),
        client.execute("SELECT id, username, fullName, role, credits, isActive, email, status, password, createdAt FROM users"),
        client.execute("SELECT * FROM payment_settings WHERE id = 'global'"),
        client.execute("SELECT * FROM emails ORDER BY timestamp DESC LIMIT 50"),
        client.execute("SELECT * FROM quizzes ORDER BY createdAt DESC"),
        client.execute("SELECT * FROM transactions ORDER BY createdAt DESC LIMIT 50"),
        client.execute("SELECT * FROM email_settings WHERE id = 'global'"),
        client.execute("SELECT * FROM google_settings WHERE id = 'global'")
      ]);

      StorageService.localSet('api_keys', resKeys.rows.map((row: any) => ({
        id: row.id, key: row.key, usageCount: Number(row.usage_count), lastUsed: row.last_used, isActive: Boolean(row.isActive),
        errorCount: Number(row.error_count || 0), lastErrorAt: row.last_error_at
      })));

      StorageService.localSet('users', resUsers.rows.map((row: any) => ({
        id: row.id, username: row.username, fullName: row.fullName, role: row.role as UserRole,
        credits: Number(row.credits), isActive: Boolean(row.isActive), email: row.email, status: row.status as UserStatus, password: row.password, createdAt: row.createdAt
      })));

      if (resPayment.rows.length > 0) localStorage.setItem('quizgen_payment_settings', resPayment.rows[0].data as string);
      if (resEmailSettings.rows.length > 0) localStorage.setItem('quizgen_email_settings', resEmailSettings.rows[0].data as string);
      if (resGoogle.rows.length > 0) localStorage.setItem('quizgen_google_settings', resGoogle.rows[0].data as string);

      StorageService.localSet('emails', resEmails.rows.map((row: any) => ({
        id: row.id, to: row.to_addr, subject: row.subject, body: row.body, type: row.type, timestamp: row.timestamp, isRead: Boolean(row.isRead)
      })));

      StorageService.localSet('quizzes', resQuizzes.rows.map((row: any) => ({
        id: row.id, title: row.title, subject: row.subject, level: row.level, grade: row.grade, topic: row.topic,
        subTopic: row.subTopic, difficulty: row.difficulty, questions: JSON.parse(row.questions), grid: row.grid,
        tags: row.tags ? JSON.parse(row.tags) : [],
        authorId: row.authorId, authorName: row.authorName, isPublished: Boolean(row.isPublished), createdAt: row.createdAt, status: row.status
      })));

      StorageService.localSet('transactions', resTrx.rows.map((row: any) => ({
        id: row.id, userId: row.userId, amount: Number(row.amount), credits: Number(row.credits), status: row.status, externalId: row.externalId, createdAt: row.createdAt
      })));

      localStorage.setItem('quizgen_last_sync', new Date().toISOString());
    } catch(e) {
      console.warn("Sync failed, using local cache");
    }
  },

  getGoogleSettings: async (): Promise<GoogleSettings> => {
    const local = localStorage.getItem('quizgen_google_settings');
    if (local) return JSON.parse(local);
    return { clientId: '' };
  },

  saveGoogleSettings: async (settings: GoogleSettings) => {
    localStorage.setItem('quizgen_google_settings', JSON.stringify(settings));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try {
        await client.execute({
          sql: "INSERT OR REPLACE INTO google_settings (id, data) VALUES ('global', ?)",
          args: [JSON.stringify(settings)]
        });
      } catch (e) {}
    }
  },

  getApiKeys: async (): Promise<ApiKey[]> => {
    const client = StorageService.getClient();
    if (!client || _isLocal) return StorageService.localGet('api_keys');
    try {
      const res = await client.execute("SELECT * FROM api_keys");
      return res.rows.map((row: any) => ({ 
        id: row.id, key: row.key, usageCount: Number(row.usage_count), lastUsed: row.last_used, isActive: Boolean(row.isActive),
        errorCount: Number(row.error_count || 0), lastErrorAt: row.last_error_at
      }));
    } catch(e) { return StorageService.localGet('api_keys'); }
  },

  getEmailSettings: async (): Promise<EmailSettings> => {
    const local = localStorage.getItem('quizgen_email_settings');
    if (!local) return {
      provider: 'none',
      apiKey: '',
      fromEmail: 'notifications@quizgen.pro',
      senderName: 'GenZ QuizGen System'
    };
    const settings = JSON.parse(local);
    if (settings.apiKey && !settings.apiKey.includes('•')) {
      settings.apiKey = StorageService.maskKey(settings.apiKey);
    }
    return settings;
  },

  saveEmailSettings: async (settings: EmailSettings) => {
    const client = StorageService.getClient();
    if (settings.apiKey.includes('•')) {
      const currentRes = await client?.execute("SELECT data FROM email_settings WHERE id = 'global'");
      if (currentRes && currentRes.rows.length > 0) {
        const oldData = JSON.parse(currentRes.rows[0].data as string);
        settings.apiKey = oldData.apiKey;
      }
    }
    localStorage.setItem('quizgen_email_settings', JSON.stringify(settings));
    if (client && !_isLocal) {
      try {
        await client.execute({
          sql: "INSERT OR REPLACE INTO email_settings (id, data) VALUES ('global', ?)",
          args: [JSON.stringify(settings)]
        });
      } catch (e) {}
    }
  },

  findRelatedQuestions: async (subject: string, topic: string): Promise<Question[]> => {
    const client = StorageService.getClient();
    if (!client || _isLocal) {
      const all: Quiz[] = StorageService.localGet('quizzes');
      const relevant = all.filter(q => q.subject === subject || q.topic.toLowerCase().includes(topic.toLowerCase()));
      const questions: Question[] = [];
      relevant.forEach(rz => { if (rz.questions) questions.push(...rz.questions); });
      return questions.sort(() => 0.5 - Math.random()).slice(0, 5);
    }
    return [];
  },

  addApiKeys: async (keys: string[]) => {
    const local = StorageService.localGet('api_keys');
    const newEntries = keys.map(key => ({
      id: crypto.randomUUID(), key, usageCount: 0, lastUsed: '-', isActive: true, errorCount: 0, lastErrorAt: '-'
    }));
    StorageService.localSet('api_keys', [...local, ...newEntries]);
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try {
        const statements = newEntries.map(entry => ({
          sql: "INSERT INTO api_keys (id, key, usage_count, last_used, isActive, error_count, last_error_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [entry.id, entry.key, 0, entry.lastUsed, 1, 0, entry.lastErrorAt]
        }));
        await client.batch(statements, "write");
      } catch (e) {}
    }
  },

  incrementApiKeyUsage: async (key: string) => {
    const local = StorageService.localGet('api_keys');
    const idx = local.findIndex((k: any) => k.key === key);
    if (idx > -1) {
      local[idx].usageCount += 1;
      local[idx].lastUsed = new Date().toISOString();
      StorageService.localSet('api_keys', local);
    }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try {
        await client.execute({
          sql: "UPDATE api_keys SET usage_count = usage_count + 1, last_used = ? WHERE key = ?",
          args: [new Date().toISOString(), key]
        });
      } catch (e) {}
    }
  },

  reportApiKeyError: async (id: string) => {
    const local = StorageService.localGet('api_keys');
    const idx = local.findIndex((k: any) => k.id === id);
    if (idx > -1) {
      local[idx].errorCount += 1;
      local[idx].lastErrorAt = new Date().toISOString();
      StorageService.localSet('api_keys', local);
    }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try {
        await client.execute({
          sql: "UPDATE api_keys SET error_count = error_count + 1, last_error_at = ? WHERE id = ?",
          args: [new Date().toISOString(), id]
        });
      } catch (e) {}
    }
  },

  resetApiKeyUsage: async (id: string) => {
    const local = StorageService.localGet('api_keys');
    const idx = local.findIndex((k: any) => k.id === id);
    if (idx > -1) {
      local[idx].usageCount = 0;
      local[idx].errorCount = 0;
      StorageService.localSet('api_keys', local);
    }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "UPDATE api_keys SET usage_count = 0, error_count = 0 WHERE id = ?", args: [id] }); } catch (e) {}
    }
  },

  toggleApiKeyStatus: async (id: string, status: boolean) => {
    const local = StorageService.localGet('api_keys');
    const idx = local.findIndex((k: any) => k.id === id);
    if (idx > -1) {
      local[idx].isActive = status;
      StorageService.localSet('api_keys', local);
    }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "UPDATE api_keys SET isActive = ? WHERE id = ?", args: [status ? 1 : 0, id] }); } catch (e) {}
    }
  },

  deleteApiKey: async (id: string) => {
    const local = StorageService.localGet('api_keys');
    StorageService.localSet('api_keys', local.filter((k: any) => k.id !== id));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "DELETE FROM api_keys WHERE id = ?", args: [id] }); } catch(e){}
    }
  },

  getQuizzes: async (user?: User): Promise<Quiz[]> => {
    const client = StorageService.getClient();
    let quizzes: Quiz[] = [];
    if (!client || _isLocal) {
      quizzes = StorageService.localGet('quizzes');
    } else {
      try {
        const res = await client.execute("SELECT * FROM quizzes ORDER BY createdAt DESC");
        quizzes = res.rows.map((row: any) => ({
          id: row.id, title: row.title, subject: row.subject, level: row.level, grade: row.grade, topic: row.topic,
          subTopic: row.subTopic, difficulty: row.difficulty, questions: JSON.parse(row.questions), grid: row.grid,
          tags: row.tags ? JSON.parse(row.tags) : [],
          authorId: row.authorId, authorName: row.authorName, isPublished: Boolean(row.isPublished), createdAt: row.createdAt, status: row.status
        }));
      } catch(e) { quizzes = StorageService.localGet('quizzes'); }
    }
    if (user && user.role === UserRole.TEACHER) return quizzes.filter(q => q.authorId === user.id);
    return quizzes;
  },

  saveQuizzes: async (quizzes: Quiz[]) => {
    const local = StorageService.localGet('quizzes');
    const quizMap = new Map(local.map((q: any) => [q.id, q]));
    quizzes.forEach(q => quizMap.set(q.id, q));
    StorageService.localSet('quizzes', Array.from(quizMap.values()));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try {
        const statements = quizzes.map(q => ({
          sql: `INSERT OR REPLACE INTO quizzes (id, title, subject, level, grade, topic, subTopic, difficulty, questions, grid, tags, authorId, authorName, isPublished, createdAt, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [q.id, q.title, q.subject, q.level, q.grade, q.topic, q.subTopic || '', q.difficulty, JSON.stringify(q.questions), q.grid, JSON.stringify(q.tags || []), q.authorId, q.authorName || '', q.isPublished ? 1 : 0, q.createdAt, q.status]
        }));
        await client.batch(statements, "write");
      } catch (e) {}
    }
  },

  deleteQuiz: async (id: string) => {
    const local = StorageService.localGet('quizzes');
    StorageService.localSet('quizzes', local.filter((q: any) => q.id !== id));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "DELETE FROM quizzes WHERE id = ?", args: [id] }); } catch(e){}
    }
  },

  getUsers: async (): Promise<User[]> => {
    const client = StorageService.getClient();
    if (!client || _isLocal) return StorageService.localGet('users');
    try {
      const res = await client.execute("SELECT id, username, fullName, role, credits, isActive, email, status, password, createdAt FROM users ORDER BY createdAt DESC");
      return res.rows.map((row: any) => ({
        id: row.id, username: row.username, fullName: row.fullName, role: row.role as UserRole, credits: Number(row.credits), isActive: Boolean(row.isActive), email: row.email, status: row.status as UserStatus, password: row.password, createdAt: row.createdAt
      }));
    } catch(e) { return StorageService.localGet('users'); }
  },

  updateUser: async (userId: string, data: Partial<User>) => {
    const users = StorageService.localGet('users');
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...data };
      StorageService.localSet('users', users);
    }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      const sets: string[] = [];
      const args: any[] = [];
      Object.entries(data).forEach(([key, val]) => {
        sets.push(`${key} = ?`);
        args.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
      });
      args.push(userId);
      try { await client.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args: args }); } catch (e) {}
    }
  },

  saveUsers: async (users: User[]) => {
    StorageService.localSet('users', users);
    const client = StorageService.getClient();
    if (!client || _isLocal) return;
    try {
      const statements = users.map(u => ({
        sql: "INSERT OR REPLACE INTO users (id, username, fullName, role, credits, isActive, email, status, password, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        args: [u.id, u.username, u.fullName || '', u.role, Number(u.credits), u.isActive ? 1 : 0, u.email || '', u.status || 'approved', u.password || '', u.createdAt || new Date().toISOString()]
      }));
      await client.batch(statements, "write");
    } catch(e){}
  },

  deleteUser: async (id: string) => {
    const local = StorageService.localGet('users');
    StorageService.localSet('users', local.filter((u: any) => u.id !== id));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] }); } catch(e) { }
    }
  },

  getPaymentSettings: async (): Promise<PaymentSettings> => {
    const local = localStorage.getItem('quizgen_payment_settings');
    if (local) return JSON.parse(local);
    return {
      mode: 'sandbox', clientId: '', secretKey: '', merchantName: 'GenZ QuizGen Store', callbackUrl: '',
      packages: [
        { id: '1', name: 'Lite Pack', credits: 30, price: 30000, isActive: true },
        { id: '2', name: 'Standard Pro', credits: 50, price: 50000, isActive: true },
        { id: '3', name: 'Premium Guru', credits: 100, price: 100000, isActive: true }
      ]
    };
  },

  savePaymentSettings: async (settings: PaymentSettings) => {
    localStorage.setItem('quizgen_payment_settings', JSON.stringify(settings));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "INSERT OR REPLACE INTO payment_settings (id, data) VALUES ('global', ?)", args: [JSON.stringify(settings)] }); } catch(e){}
    }
  },

  addLog: async (log: QuizLog) => {
    const local = StorageService.localGet('logs');
    StorageService.localSet('logs', [log, ...local].slice(0, 150));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "INSERT INTO logs (id, timestamp, category, action, details, status, userId, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [log.id, log.timestamp, log.category, log.action, log.details, log.status, log.userId, log.metadata || ''] }); } catch(e){}
    }
  },

  getLogs: async (): Promise<QuizLog[]> => {
    const client = StorageService.getClient();
    if (!client || _isLocal) return StorageService.localGet('logs');
    try {
      const res = await client.execute("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200");
      return res.rows.map((row: any) => ({ 
        id: row.id, timestamp: row.timestamp, category: row.category as LogCategory, action: row.action, details: row.details, status: row.status as any, userId: row.userId, metadata: row.metadata
      }));
    } catch(e) { return StorageService.localGet('logs'); }
  },

  getTransactions: async (userId?: string): Promise<Transaction[]> => {
    const client = StorageService.getClient();
    if (!client || _isLocal) return StorageService.localGet('transactions').filter((t: any) => !userId || t.userId === userId);
    try {
      const sql = userId ? "SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC" : "SELECT * FROM transactions ORDER BY createdAt DESC";
      const res = await client.execute({ sql, args: userId ? [userId] : [] });
      return res.rows.map((row: any) => ({ 
        id: row.id, userId: row.userId, amount: Number(row.amount), credits: Number(row.credits), status: row.status as any, externalId: row.externalId, createdAt: row.createdAt 
      }));
    } catch(e) { return StorageService.localGet('transactions'); }
  },

  updateUserCredits: async (userId: string, amount: number) => {
    const users = StorageService.localGet('users');
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx > -1) { users[idx].credits += amount; StorageService.localSet('users', users); }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "UPDATE users SET credits = credits + ? WHERE id = ?", args: [amount, userId] }); } catch(e){}
    }
  },

  toggleQuizPublication: async (quizId: string, status: boolean) => {
    const local = StorageService.localGet('quizzes');
    const idx = local.findIndex((q: any) => q.id === quizId);
    if (idx > -1) { local[idx].isPublished = status; StorageService.localSet('quizzes', local); }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "UPDATE quizzes SET isPublished = ? WHERE id = ?", args: [status ? 1 : 0, quizId] }); } catch(e){}
    }
  },

  getEmails: async (email?: string): Promise<EmailNotification[]> => {
    const client = StorageService.getClient();
    let emails: EmailNotification[] = [];
    if (!client || _isLocal) {
      emails = StorageService.localGet('emails');
    } else {
      try {
        const res = await client.execute("SELECT * FROM emails ORDER BY timestamp DESC LIMIT 50");
        emails = res.rows.map((row: any) => ({ 
          id: row.id, to: row.to_addr, subject: row.subject, body: row.body, type: row.type as any, timestamp: row.timestamp, isRead: Boolean(row.isRead) 
        }));
      } catch(e) { emails = StorageService.localGet('emails'); }
    }
    return email ? emails.filter(e => e.to === email) : emails;
  },

  getEmailsPaged: async (email: string, page: number = 1, limit: number = 10): Promise<{ emails: EmailNotification[], hasMore: boolean }> => {
    const client = StorageService.getClient();
    const offset = (page - 1) * limit;
    if (!client || _isLocal) {
      const all = StorageService.localGet('emails').filter((e: any) => e.to === email);
      const slice = all.slice(offset, offset + limit);
      return { emails: slice, hasMore: all.length > offset + limit };
    }
    try {
      const res = await client.execute({
        sql: "SELECT * FROM emails WHERE to_addr = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
        args: [email, limit + 1, offset]
      });
      const rows = res.rows.map((row: any) => ({
        id: row.id, to: row.to_addr, subject: row.subject, body: row.body, type: row.type as any, timestamp: row.timestamp, isRead: Boolean(row.isRead)
      }));
      const hasMore = rows.length > limit;
      return { emails: hasMore ? rows.slice(0, limit) : rows, hasMore };
    } catch(e) {
      return { emails: [], hasMore: false };
    }
  },

  addEmail: async (email: EmailNotification) => {
    const local = StorageService.localGet('emails');
    StorageService.localSet('emails', [email, ...local].slice(0, 500));
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try {
        await client.execute({ sql: "INSERT INTO emails (id, to_addr, subject, body, type, timestamp, isRead) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [email.id, email.to, email.subject, email.body, email.type, email.timestamp, email.isRead ? 1 : 0] });
      } catch(e){}
    }
  },

  markEmailAsRead: async (id: string) => {
    const local = StorageService.localGet('emails');
    const idx = local.findIndex((e: any) => e.id === id);
    if (idx > -1) { local[idx].isRead = true; StorageService.localSet('emails', local); }
    const client = StorageService.getClient();
    if (client && !_isLocal) {
      try { await client.execute({ sql: "UPDATE emails SET isRead = 1 WHERE id = ?", args: [id] }); } catch(e){}
    }
  },

  exportFullBackup: async () => {
    const backup: Record<string, any> = {};
    const keys = ['api_keys', 'users', 'emails', 'quizzes', 'transactions', 'logs', 'payment_settings', 'google_settings'];
    keys.forEach(key => backup[key] = StorageService.localGet(key));
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quizgen_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  },

  importFullBackup: async (jsonContent: string) => {
    const data = JSON.parse(jsonContent);
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(`quizgen_${key}`, JSON.stringify(value)));
  }
};
