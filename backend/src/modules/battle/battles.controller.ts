import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BattlesService } from './battles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('api/v1/battles')
export class BattlesController {
  constructor(private readonly battles: BattlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() body: { mode?: string },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.createBattle(req.user!.sub, body.mode || 'pvp');
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  join(
    @Body() body: { battleId: number; password?: string | null },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    this.battles.joinBattle(req.user!.sub, body.battleId, body.password);
    return this.battles.snapshot(body.battleId);
  }

  @Get(':battleId')
  @UseGuards(JwtAuthGuard)
  get(@Param('battleId') battleId: string) {
    const id = Number(battleId);
    return this.battles.snapshot(id);
  }

  @Post('match')
  @UseGuards(JwtAuthGuard)
  match(
    @Body() body: { mode?: string },
    @Req() req: Request & { user?: { sub: number } },
  ) {
    return this.battles.quickMatch(req.user!.sub, body.mode || 'pvp');
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
