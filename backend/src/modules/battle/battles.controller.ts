import { Controller, Post, Body, Headers } from '@nestjs/common';
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
}
