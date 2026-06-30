import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function initDatabase() {
  const db = await open({
    filename: "./database/hackathon.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}