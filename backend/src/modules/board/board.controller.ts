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
    // server-side validation for endgame layouts
    try {
      if (
        createBoardDto.isEndgame &&
        createBoardDto.layout &&
        Array.isArray((createBoardDto.layout as any).pieces)
      ) {
        const { assertValidEndgameOrThrow } = require('./endgame.validator');
        assertValidEndgameOrThrow((createBoardDto.layout as any).pieces);
      }
    } catch (e: any) {
      // rethrow as BadRequest
      const msg = e?.validation
        ? e.validation.join('; ')
        : e?.message || 'Invalid layout';
      const { BadRequestException } = require('@nestjs/common');
      throw new BadRequestException(msg);
    }
    return this.boardService.create(createBoardDto, ownerId);
  }

  @Get('templates')
  async findTemplates(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;
    const all = await this.boardService.findTemplates();
    const total = all.length;
    const start = (Math.max(p, 1) - 1) * Math.min(Math.max(ps, 1), 100);
    const items = all.slice(start, start + Math.min(Math.max(ps, 1), 100));
    return {
      items,
      page: Math.max(p, 1),
      pageSize: Math.min(Math.max(ps, 1), 100),
      total,
    };
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

  @Get('endgames')
  @UseGuards(JwtAuthGuard)
  async findMyEndgames(
    @Req() req: Request & { user?: { sub: number } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const ownerId = req.user!.sub;
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;
    const all = await this.boardService.findMyEndgames(ownerId);
    const total = all.length;
    const start = (Math.max(p, 1) - 1) * Math.min(Math.max(ps, 1), 100);
    const items = all.slice(start, start + Math.min(Math.max(ps, 1), 100));
    return {
      items,
      page: Math.max(p, 1),
      pageSize: Math.min(Math.max(ps, 1), 100),
      total,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.boardService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBoardDto: UpdateBoardDto,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const ownerId = req.user!.sub;
    const b = (await this.boardService.findOne(id)) as unknown as {
      ownerId: number | null;
      isTemplate?: boolean;
    };
    if (b.isTemplate) {
      if (b.ownerId == null) {
        throw new ForbiddenException('模板不可修改');
      }
      if (b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
    } else {
      if (b.ownerId && b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
    }
    return this.boardService.update(id, updateBoardDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const ownerId = req.user!.sub;
    const b = (await this.boardService.findOne(id)) as unknown as {
      ownerId: number | null;
      isTemplate?: boolean;
    };
    if (b.isTemplate) {
      if (b.ownerId == null) {
        throw new ForbiddenException('模板不可删除');
      }
      if (b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
    } else {
      if (b.ownerId && b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
    }
    return this.boardService.remove(id);
  }
}
