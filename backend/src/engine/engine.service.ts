import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common'
import { readFile } from 'fs/promises'

@Injectable()
export class EngineService {
  private readonly engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8000'

  async health() {
    return this.request('/health')
  }

  async index(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucune video recue pour indexation')
    }

    const formData = new FormData()
    const blob = new Blob([file.buffer as unknown as BlobPart], {
      type: file.mimetype,
    })

    formData.append('file', blob, file.originalname)

    return this.request('/index', {
      method: 'POST',
      body: formData,
    })
  }

  async indexFile(filePath: string, filename: string, mimetype = 'video/mp4') {
    const buffer = await readFile(filePath)
    const formData = new FormData()
    const blob = new Blob([buffer as unknown as BlobPart], {
      type: mimetype,
    })

    formData.append('file', blob, filename)

    return this.request('/index', {
      method: 'POST',
      body: formData,
    })
  }

  async findAllVideos() {
    return this.request('/videos')
  }

  async findVideo(id: string) {
    return this.request(`/videos/${encodeURIComponent(id)}`)
  }

  async deleteVideo(id: string) {
    return this.request(`/videos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async search(q: string) {
    const query = new URLSearchParams({ q })
    return this.request(`/search?${query.toString()}`)
  }

  private async request(path: string, init?: RequestInit) {
    const url = `${this.engineUrl}${path}`

    try {
      const response = await fetch(url, init)
      const contentType = response.headers.get('content-type') ?? ''
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text()

      if (!response.ok) {
        throw new BadGatewayException({
          message: 'Erreur retournee par le service Engine',
          status: response.status,
          payload,
        })
      }

      return payload
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error
      }

      throw new BadGatewayException({
        message: 'Service Engine indisponible',
        engineUrl: this.engineUrl,
        cause: String(error),
      })
    }
  }
}
