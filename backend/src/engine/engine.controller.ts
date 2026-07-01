import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { EngineService } from './engine.service'

@Controller('engine')
export class EngineController {
  constructor(private readonly engineService: EngineService) {}

  @Get('health')
  health() {
    return this.engineService.health()
  }

  @Post('index')
  @UseInterceptors(FileInterceptor('file'))
  index(@UploadedFile() file: Express.Multer.File) {
    return this.engineService.index(file)
  }

  @Get('videos')
  findAllVideos() {
    return this.engineService.findAllVideos()
  }

  @Get('videos/:id')
  findVideo(@Param('id') id: string) {
    return this.engineService.findVideo(id)
  }

  @Delete('videos/:id')
  deleteVideo(@Param('id') id: string) {
    return this.engineService.deleteVideo(id)
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.engineService.search(q)
  }
}
