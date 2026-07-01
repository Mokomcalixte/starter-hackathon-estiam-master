import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { SessionsService } from './sessions.service'
import { EngineService } from '../engine/engine.service'
import { join } from 'path'

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly engineService: EngineService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9)
          callback(null, uniqueName + extname(file.originalname))
        },
      }),
    }),
  )
  create(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    return this.sessionsService.create({
      title: body.title,
      description: body.description,
      videoName: file.originalname,
      videoPath: file.filename,
      createdBy: body.createdBy ? Number(body.createdBy) : undefined,
      presenterName: body.presenterName,
    })
  }

  @Get()
  findAll() {
    return this.sessionsService.findAll()
  }

  @Delete()
  deleteAll() {
    return this.sessionsService.deleteAll()
  }

  @Delete(':code')
  deleteByCode(@Param('code') code: string) {
    return this.sessionsService.deleteByCode(code)
  }

  @Post(':code/analyze')
  async analyze(@Param('code') code: string) {
    const session = await this.sessionsService.findByCode(code)
    const filePath = join(process.cwd(), 'uploads', session.videoPath)

    try {
      const metadata = await this.engineService.indexFile(
        filePath,
        session.videoName || session.videoPath,
      )

      return this.sessionsService.updateEngineAnalysis(code, metadata)
    } catch (error) {
      await this.sessionsService.markEngineAnalysisFailed(code)
      throw error
    }
  }

  @Get(':code')
  findByCode(@Param('code') code: string) {
    return this.sessionsService.findByCode(code)
  }
}
