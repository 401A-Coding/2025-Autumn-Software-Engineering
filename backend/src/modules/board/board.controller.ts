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
  Query,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtService } from '@nestjs/jwt';
import { ResponseEnvelopeInterceptor } from '../../common/interceptors/response-envelope.interceptor';

@Controller('api/v1/boards')
@UseInterceptors(ResponseEnvelopeInterceptor)
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

  @Get('standard')
  getStandard() {
    return this.boardService.standard();
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
  findMine(
    @Headers('authorization') authorization?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const ownerId = this.getUserIdFromAuth(authorization);
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;
    return this.boardService.findMinePaginated(ownerId, p, ps);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization?: string,
  ) {
    // 与 OpenAPI 一致：需要鉴权
    this.getUserIdFromAuth(authorization);
    return this.boardService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBoardDto: UpdateBoardDto,
    @Headers('authorization') authorization?: string,
  ) {
    const ownerId = this.getUserIdFromAuth(authorization);
    return this.boardService.findOne(id).then((b) => {
      if (b.ownerId && b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
      return this.boardService.update(id, updateBoardDto);
    });
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization?: string,
  ) {
    const ownerId = this.getUserIdFromAuth(authorization);
    return this.boardService.findOne(id).then((b) => {
      if (b.ownerId && b.ownerId !== ownerId) {
        throw new ForbiddenException('无权限');
      }
      return this.boardService.remove(id);
    });
  }
}
