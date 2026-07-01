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
    presenterName?: string
  }) {
    const db = await initDatabase()

    const code = 'TS-' + Math.floor(1000 + Math.random() * 9000)

    await db.run(
      `
      INSERT INTO sessions (title, description, videoName, videoPath, code, createdBy, presenterName)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      body.title,
      body.description ?? '',
      body.videoName ?? '',
      body.videoPath ?? '',
      code,
      body.createdBy ?? null,
      body.presenterName ?? '',
    )

    return this.findByCode(code)
  }

  async findByCode(code: string) {
    const db = await initDatabase()

    const session = await db.get(
      `
      SELECT sessions.*, COALESCE(NULLIF(sessions.presenterName, ''), users.fullName) AS presenterName
      FROM sessions
      LEFT JOIN users ON users.id = sessions.createdBy
      WHERE sessions.code = ?
      `,
      code,
    )

    if (!session) {
      throw new NotFoundException('Session introuvable')
    }

    return session
  }

  async findAll() {
    const db = await initDatabase()

    return db.all(`
      SELECT sessions.*, COALESCE(NULLIF(sessions.presenterName, ''), users.fullName) AS presenterName
      FROM sessions
      LEFT JOIN users ON users.id = sessions.createdBy
      ORDER BY sessions.createdAt DESC
    `)
  }

  async deleteByCode(code: string) {
    const db = await initDatabase()
    const result = await db.run('DELETE FROM sessions WHERE code = ?', code)

    if (!result.changes) {
      throw new NotFoundException('Session introuvable')
    }

    return { message: 'Session supprimée', code }
  }

  async updateEngineAnalysis(code: string, metadata: any) {
    const db = await initDatabase()

    await db.run(
      `
      UPDATE sessions
      SET engineStatus = ?, engineVideoId = ?, engineMetadata = ?
      WHERE code = ?
      `,
      'ready',
      metadata?.id ?? '',
      JSON.stringify(metadata),
      code,
    )

    return this.findByCode(code)
  }

  async markEngineAnalysisFailed(code: string) {
    const db = await initDatabase()

    await db.run(
      `
      UPDATE sessions
      SET engineStatus = ?
      WHERE code = ?
      `,
      'failed',
      code,
    )
  }

  async deleteAll() {
  const db = await initDatabase()

  await db.run('DELETE FROM sessions')
  await db.run("DELETE FROM sqlite_sequence WHERE name = 'sessions'")

  return { message: 'Sessions supprimées' }
}
}
