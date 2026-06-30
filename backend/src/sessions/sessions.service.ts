import { Injectable, NotFoundException } from '@nestjs/common'
import { initDatabase } from '../../database/database'

@Injectable()
export class SessionsService {
  async create(body: {
    title: string
    description?: string
    videoName?: string
    videoPath?: string
    createdBy?: number
  }) {
    const db = await initDatabase()

    const code = 'TS-' + Math.floor(1000 + Math.random() * 9000)

    await db.run(
      `
      INSERT INTO sessions (title, description, videoName, videoPath, code, createdBy)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      body.title,
      body.description ?? '',
      body.videoName ?? '',
      body.videoPath ?? '',
      code,
      body.createdBy ?? null,
    )

    return this.findByCode(code)
  }

  async findByCode(code: string) {
    const db = await initDatabase()

    const session = await db.get(
      `SELECT * FROM sessions WHERE code = ?`,
      code,
    )

    if (!session) {
      throw new NotFoundException('Session introuvable')
    }

    return session
  }

  async findAll() {
    const db = await initDatabase()

    return db.all(`SELECT * FROM sessions ORDER BY createdAt DESC`)
  }
  async deleteAll() {
  const db = await initDatabase()

  await db.run('DELETE FROM sessions')
  await db.run("DELETE FROM sqlite_sequence WHERE name = 'sessions'")

  return { message: 'Sessions supprimées' }
}
}