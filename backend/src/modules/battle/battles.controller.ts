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
    return {
      code: 0,
      message: '房间创建成功',
      data: this.battles.createBattle(userId, body.mode || 'pvp'),
    };
  }

  @Post('join')
  join(
    @Body() body: { battleId: number; password?: string | null },
    @Headers('authorization') authorization?: string,
  ) {
    const userId = this.battles.verifyBearer(authorization);
    const snap = this.battles.joinBattle(userId, body.battleId, body.password);
    return {
      code: 0,
      message: '加入成功',
      data: this.battles.snapshot(body.battleId),
    };
  }

  @Get(':battleId')
  get(
    @Param('battleId') battleId: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.battles.verifyBearer(authorization);
    const id = Number(battleId);
    return { code: 0, message: 'success', data: this.battles.snapshot(id) };
  }

  @Post('match')
  match(
    @Body() body: { mode?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const userId = this.battles.verifyBearer(authorization);
    const res = this.battles.quickMatch(userId, body.mode || 'pvp');
    return { code: 0, message: '匹配成功', data: res };
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
    return {
      code: 0,
      message: 'success',
      data: this.battles.history(userId, p, ps),
    };
  }
}
