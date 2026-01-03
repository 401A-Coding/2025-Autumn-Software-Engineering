import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { BattlesService } from './battles.service';
import { BoardService } from '../board/board.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('api/v1/battles')
export class BattlesController {
  constructor(
    private readonly battles: BattlesService,
    private readonly boards: BoardService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body()
    body: {
      mode?: string;
      initialBoardId?: number;
      initialLayout?: {
        pieces: { type: string; side: 'red' | 'black'; x: number; y: number }[];
        turn?: 'red' | 'black';
      };
    },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    // 构造种子：优先使用 initialLayout，其次尝试 initialBoardId（模板表中的 layout）
    let seed:
      | {
        board: import('../../shared/chess/types').Board;
        turn: import('../../shared/chess/types').Side;
      }
      | undefined;
    const turn = body.initialLayout?.turn ?? 'red';
    if (
      body.initialLayout?.pieces &&
      Array.isArray(body.initialLayout.pieces)
    ) {
      const pieces = body.initialLayout.pieces;
      const b: import('../../shared/chess/types').Board = Array.from(
        { length: 10 },
        () => Array(9).fill(null),
      );
      let idSeq = 0;
      for (const p of pieces) {
        if (
          typeof p.x === 'number' &&
          typeof p.y === 'number' &&
          p.x >= 0 &&
          p.x < 9 &&
          p.y >= 0 &&
          p.y < 10 &&
          typeof p.type === 'string' &&
          (p.side === 'red' || p.side === 'black')
        ) {
          // 统一 rook/chariot：前端已统一 rook，这里兼容 chariot
          const type = p.type === 'chariot' ? 'rook' : (p.type as any);
          (b as any)[p.y][p.x] = { id: `seed-${idSeq++}`, type, side: p.side };
        }
      }
      seed = { board: b, turn };
    }
    // 若提供 initialBoardId，则尝试从模板加载布局
    if (!seed && body.initialBoardId && Number.isFinite(body.initialBoardId)) {
      try {
        const tmpl = await this.boards.findOne(Number(body.initialBoardId));
        const layout: any = (tmpl as any).layout;
        const pieces: any[] = Array.isArray(layout?.pieces)
          ? layout.pieces
          : [];
        const b: import('../../shared/chess/types').Board = Array.from(
          { length: 10 },
          () => Array(9).fill(null),
        );
        let idSeq = 0;
        for (const p of pieces) {
          if (
            typeof p.x === 'number' &&
            typeof p.y === 'number' &&
            p.x >= 0 &&
            p.x < 9 &&
            p.y >= 0 &&
            p.y < 10 &&
            typeof p.type === 'string' &&
            (p.side === 'red' || p.side === 'black')
          ) {
            const type = p.type === 'chariot' ? 'rook' : p.type;
            (b as any)[p.y][p.x] = {
              id: `seed-${idSeq++}`,
              type,
              side: p.side,
            };
          }
        }
        const t = (layout?.turn ?? 'red') as 'red' | 'black';
        seed = { board: b, turn: t };
      } catch {
        // 找不到模板或布局异常则忽略，退回默认开局
      }
    }
    return await this.battles.createBattle(
      req.user!.sub,
      body.mode || 'pvp',
      {
        source: 'room',
        visibility: 'private', // 默认私密房，只能通过房间号/链接进入
      },
      seed,
    );
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async join(
    @Body() body: { battleId: number; password?: string | null },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    await this.battles.joinBattle(req.user!.sub, body.battleId, body.password);
    return this.battles.snapshot(body.battleId);
  }

  @Get(':battleId')
  @UseGuards(JwtAuthGuard)
  get(@Param('battleId') battleId: string) {
    const id = Number(battleId);
    return this.battles.snapshot(id);
  }

  // 临时规则：仅在自定义在线对战期间使用，结束后清理
  @Post(':battleId/rules')
  @UseGuards(JwtAuthGuard)
  setRules(
    @Param('battleId') battleId: string,
    @Body() body: { rules: any },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const id = Number(battleId);
    const b = this.battles.getBattle(id);
    if (!b.ownerId || b.ownerId !== req.user!.sub) {
      // 只有房主（创建者/红方）能设置该对局规则
      throw new ForbiddenException('仅房主可设置规则');
    }
    return this.battles.setCustomRules(id, body?.rules);
  }

  @Get(':battleId/rules')
  @UseGuards(JwtAuthGuard)
  getRules(@Param('battleId') battleId: string) {
    const id = Number(battleId);
    return this.battles.getCustomRules(id);
  }

  // 临时回放：房主可设，房间参与者可取，用于加入方复制保存
  @Post(':battleId/replay')
  @UseGuards(JwtAuthGuard)
  setReplay(
    @Param('battleId') battleId: string,
    @Body() body: { replay: any },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const id = Number(battleId);
    const b = this.battles.getBattle(id);
    if (!b.ownerId || b.ownerId !== req.user!.sub) {
      throw new ForbiddenException('仅房主可设置回放');
    }
    return this.battles.setTempReplay(id, body?.replay);
  }

  @Get(':battleId/replay')
  @UseGuards(JwtAuthGuard)
  getReplay(
    @Param('battleId') battleId: string,
    @Req() req: Request & { user?: { sub: number } },
  ) {
    const id = Number(battleId);
    const b = this.battles.getBattle(id);
    // 仅房间参与者可取（房主或加入者）
    if (!b.players.includes(req.user!.sub)) {
      throw new ForbiddenException('仅房间参与者可获取回放');
    }
    return this.battles.getTempReplay(id);
  }

  @Post('match')
  @UseGuards(JwtAuthGuard)
  async match(
    @Body() body: { mode?: string },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return await this.battles.quickMatch(req.user!.sub, body.mode || 'pvp');
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @Body() body: { battleId: number },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.cancelWaiting(req.user!.sub, body.battleId);
  }

  @Post('leave')
  @UseGuards(JwtAuthGuard)
  leave(
    @Body() body: { battleId: number },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.leaveBattle(req.user!.sub, body.battleId);
  }

  @Post('resign')
  @UseGuards(JwtAuthGuard)
  resign(
    @Body() body: { battleId: number },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.resign(req.user!.sub, body.battleId);
  }

  @Post('draw/offer')
  @UseGuards(JwtAuthGuard)
  offerDraw(
    @Body() body: { battleId: number },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.offerDraw(req.user!.sub, body.battleId);
  }

  @Post('draw/accept')
  @UseGuards(JwtAuthGuard)
  acceptDraw(
    @Body() body: { battleId: number },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.acceptDraw(req.user!.sub, body.battleId);
  }

  @Post('draw/decline')
  @UseGuards(JwtAuthGuard)
  declineDraw(
    @Body() body: { battleId: number },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.declineDraw(req.user!.sub, body.battleId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  history(
    @Req() req: Request & { user?: { sub: number } },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 10));
    return this.battles.history(req.user!.sub, p, ps);
  }
}
