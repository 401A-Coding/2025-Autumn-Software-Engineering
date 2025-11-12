import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  ForbiddenException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('api/v1/boards')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get('standard')
  getStandard() {
    return this.boardService.standard();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createBoardDto: CreateBoardDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const ownerId = req.user!.sub;
    return this.boardService.create(createBoardDto, ownerId);
  }

  @Get('templates')
  findTemplates() {
    return this.boardService.findTemplates();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(
    @Req() req: Request & { user?: { sub: number } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const ownerId = req.user!.sub;
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;
    return this.boardService.findMinePaginated(ownerId, p, ps);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.boardService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBoardDto: UpdateBoardDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const ownerId = req.user!.sub;
    return this.boardService.findOne(id).then((b) => {
      if (b.ownerId && b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
      return this.boardService.update(id, updateBoardDto);
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const ownerId = req.user!.sub;
    return this.boardService.findOne(id).then((b) => {
      if (b.ownerId && b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
      return this.boardService.remove(id);
    });
  }
}
