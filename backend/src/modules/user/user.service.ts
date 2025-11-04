import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) { }

  // 注册
  async register(dto: CreateUserDto) {
    const existed = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: dto.phone },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });
    if (existed) throw new BadRequestException('手机号或邮箱已被占用');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        // 用 username 字段保存手机号
        username: dto.phone,
        phone: dto.phone,
        email: dto.email,
        password: hashed,
      },
    });

    return this.generateTokens(user.id, user.username, user.role);
  }

  // 登录（使用 phone，即存于 username 字段）
  async login(dto: LoginUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { phone: dto.phone },
    });
    if (!user) throw new UnauthorizedException('账号或密码错误');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('账号或密码错误');

    // TODO: 将 refreshToken 写入 Redis（可选）
    return this.generateTokens(user.id, user.username, user.role);
  }

  private generateTokens(
    sub: number,
    username: string,
    role: 'USER' | 'ADMIN',
  ) {
    const payload = { sub, username, role };
    const accessToken = this.jwt.sign(payload, { expiresIn: '30m' });
    const refreshToken = this.jwt.sign(payload, { expiresIn: '7d' });
    // keep contract in docs/openapi.yaml: expiresIn is seconds for access token TTL
    const expiresIn = 30 * 60; // 30 minutes
    return { accessToken, refreshToken, expiresIn };
  }
}
