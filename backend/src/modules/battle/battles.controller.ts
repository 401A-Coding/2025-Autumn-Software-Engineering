import {
  Controller,
  Post,
  Body,
  Headers,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { BattlesService } from './battles.service';

@Controller('api/v1/battles')
export class BattlesController {
  constructor(private readonly battles: BattlesService) {}

  @Post()
  create(
    @Body() body: { mode?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const userId = this.battles.verifyBearer(authorization);
    return this.battles.createBattle(userId, body.mode || 'pvp');
  }

  @Post('join')
  join(
    @Body() body: { battleId: number; password?: string | null },
    @Headers('authorization') authorization?: string,
  ) {
    const userId = this.battles.verifyBearer(authorization);
    this.battles.joinBattle(userId, body.battleId, body.password);
    return this.battles.snapshot(body.battleId);
  }

  @Get(':battleId')
  get(
    @Param('battleId') battleId: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.battles.verifyBearer(authorization);
    const id = Number(battleId);
    return this.battles.snapshot(id);
  }

  @Post('match')
  match(
    @Body() body: { mode?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const userId = this.battles.verifyBearer(authorization);
    return this.battles.quickMatch(userId, body.mode || 'pvp');
  }

  @Get('history')
  history(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Headers('authorization') authorization?: string,
  ) {
    const userId = this.battles.verifyBearer(authorization);
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 10));
    return this.battles.history(userId, p, ps);
  }
}
