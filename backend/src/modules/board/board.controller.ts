import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtService } from '@nestjs/jwt';

@Controller('api/v1/boards')
export class BoardController {
  constructor(
    private readonly boardService: BoardService,
    private readonly jwt: JwtService,
  ) {}

  private getUserIdFromAuth(authorization?: string): number {
    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('未登录');
    }
    const token = authorization.slice(7).trim();
    try {
      const payload = this.jwt.verify<{ sub: number }>(token);
      return payload.sub;
    } catch {
      throw new UnauthorizedException('无效的凭证');
    }
  }

  @Post()
  create(
    @Body() createBoardDto: CreateBoardDto,
    @Headers('authorization') authorization?: string,
  ) {
    const ownerId = this.getUserIdFromAuth(authorization);
    return this.boardService.create(createBoardDto, ownerId);
  }

  @Get('templates')
  findTemplates() {
    return this.boardService.findTemplates();
  }

  @Get('mine')
  findMine(@Headers('authorization') authorization?: string) {
    const ownerId = this.getUserIdFromAuth(authorization);
    return this.boardService.findMine(ownerId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.boardService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBoardDto: UpdateBoardDto,
  ) {
    return this.boardService.update(id, updateBoardDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.boardService.remove(id);
  }
}
