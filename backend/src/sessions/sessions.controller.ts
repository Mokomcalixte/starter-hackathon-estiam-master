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

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

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
      createdBy: body.createdBy,
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

  @Get(':code')
  findByCode(@Param('code') code: string) {
    return this.sessionsService.findByCode(code)
  }
}