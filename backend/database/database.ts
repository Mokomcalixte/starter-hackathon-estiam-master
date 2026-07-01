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

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      videoName TEXT,
      videoPath TEXT,
      code TEXT NOT NULL UNIQUE,
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const sessionColumns = await db.all(`PRAGMA table_info(sessions)`);
  const hasPresenterName = sessionColumns.some(
    (column: { name: string }) => column.name === "presenterName",
  );

  if (!hasPresenterName) {
    await db.exec(`ALTER TABLE sessions ADD COLUMN presenterName TEXT`);
  }

  const refreshedSessionColumns = await db.all(`PRAGMA table_info(sessions)`);
  const hasEngineStatus = refreshedSessionColumns.some(
    (column: { name: string }) => column.name === "engineStatus",
  );
  const hasEngineVideoId = refreshedSessionColumns.some(
    (column: { name: string }) => column.name === "engineVideoId",
  );
  const hasEngineMetadata = refreshedSessionColumns.some(
    (column: { name: string }) => column.name === "engineMetadata",
  );

  if (!hasEngineStatus) {
    await db.exec(`ALTER TABLE sessions ADD COLUMN engineStatus TEXT`);
  }

  if (!hasEngineVideoId) {
    await db.exec(`ALTER TABLE sessions ADD COLUMN engineVideoId TEXT`);
  }

  if (!hasEngineMetadata) {
    await db.exec(`ALTER TABLE sessions ADD COLUMN engineMetadata TEXT`);
  }

  return db;
}
