'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

let activePool = null;
let dbType = null;

async function initDatabase() {
  if (activePool) return { type: dbType, pool: activePool };

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seed2serve'
  };

  // 1. Check if MySQL is available
  try {
    const conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 1000
    });
    await conn.query('SELECT 1');
    await conn.end();

    activePool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
    dbType = 'mysql';
    console.log('[database] Connected to MySQL on ' + dbConfig.host + ':' + dbConfig.port);
    return { type: dbType, pool: activePool };
  } catch (err) {
    console.log('[database] MySQL connection not available (' + (err.code || err.message) + ').');
    console.log('[database] Falling back to built-in SQLite database (db/seed2serve.sqlite) for local development.');
  }

  // 2. Built-in SQLite Fallback
  const { DatabaseSync } = require('node:sqlite');
  const dbDir = path.join(__dirname, 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'seed2serve.sqlite');
  const sqlite = new DatabaseSync(dbPath);

  // Auto-create schema in SQLite
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name VARCHAR(120) NOT NULL,
      username VARCHAR(60) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(40) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(128) NOT NULL PRIMARY KEY,
      expires INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  activePool = {
    query: async (sql, params = []) => {
      let cleanSql = sql.trim();

      // Convert ON DUPLICATE KEY UPDATE to SQLite ON CONFLICT
      if (/ON DUPLICATE KEY UPDATE/i.test(cleanSql)) {
        cleanSql = cleanSql.replace(
          /ON DUPLICATE KEY UPDATE.*$/is,
          'ON CONFLICT(session_id) DO UPDATE SET expires = excluded.expires, data = excluded.data'
        );
      }

      // Strip MySQL engine/charset options if present in dynamic query
      cleanSql = cleanSql.replace(/ENGINE=InnoDB.*$/im, '');

      // SQLite schema is already initialized on startup
      if (/^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(cleanSql)) {
        return [[]];
      }

      try {
        const isSelect = /^\s*(SELECT|PRAGMA)/i.test(cleanSql);
        const stmt = sqlite.prepare(cleanSql);

        if (isSelect) {
          const rows = stmt.all(...params);
          return [rows];
        } else {
          const info = stmt.run(...params);
          return [{
            insertId: Number(info.lastInsertRowid),
            affectedRows: info.changes
          }];
        }
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE constraint failed')) {
          const dupErr = new Error(e.message);
          dupErr.code = 'ER_DUP_ENTRY';
          throw dupErr;
        }
        throw e;
      }
    }
  };

  dbType = 'sqlite';
  return { type: dbType, pool: activePool };
}

const pool = {
  query: async (sql, params) => {
    if (!activePool) {
      await initDatabase();
    }
    return activePool.query(sql, params);
  }
};

module.exports = { initDatabase, pool };
