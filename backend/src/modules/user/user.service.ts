import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // 注册
  async register(dto: CreateUserDto) {
    const existed = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });
    if (existed) throw new BadRequestException('用户名或邮箱已被占用');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashed,
      },
    });

    return this.generateTokens(user.id, user.username, user.role);
  }

  // 登录（支持 username 或 email）
  async login(dto: LoginUserDto) {
    const user = await this.prisma.user.findFirst({
      where: dto.email
        ? { email: dto.email }
        : dto.username
          ? { username: dto.username }
          : undefined,
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
    return { accessToken, refreshToken };
  }
}
