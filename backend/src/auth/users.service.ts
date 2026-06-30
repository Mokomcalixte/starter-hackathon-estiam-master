import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common'
import * as argon2 from 'argon2'
import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

export type Role = 'admin' | 'member'

export interface User {
  id: number
  fullName: string
  email: string
  role: Role
  passwordHash: string
}

@Injectable()
export class UsersService implements OnModuleInit {
  private db: Database | null = null

  async onModuleInit(): Promise<void> {
    this.db = await open({
      filename: './database/hackathon.db',
      driver: sqlite3.Database,
    })

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.db?.get<User>('SELECT * FROM users WHERE email = ?', email)
  }

  async create(fullName: string, email: string, password: string): Promise<User> {
    const existingUser = await this.findByEmail(email)

    if (existingUser) {
      throw new ConflictException('Cet email existe déjà')
    }

    const passwordHash = await argon2.hash(password)

    await this.db?.run(
      'INSERT INTO users (fullName, email, passwordHash, role) VALUES (?, ?, ?, ?)',
      fullName,
      email,
      passwordHash,
      'member',
    )

    const newUser = await this.findByEmail(email)

    if (!newUser) {
      throw new Error('Erreur lors de la création du compte')
    }

    return newUser
  }
}