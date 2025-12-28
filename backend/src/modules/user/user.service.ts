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

type MinimalUser = { id: number; username: string; role: 'USER' | 'ADMIN' };

@Injectable()
export class UserService {
  private resetMap = new Map<string, { phone: string; expiresAt: number }>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // 请求找回密码（开发环境：生成临时 requestId 并返回；真实环境应通过短信/邮件验证）
  async requestPasswordReset(phone: string) {
    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user) {
      // 为避免泄露是否存在，仍返回 ok （但不生成 token）
      return { requestId: null, expireIn: 0 };
    }
    const requestId = `reset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    this.resetMap.set(requestId, { phone, expiresAt });
    return { requestId, expireIn: 15 * 60 };
  }

  // 使用 requestId 重置用户密码（开发环境简化实现）
  async resetPassword(phone: string, requestId: string, newPassword: string) {
    const entry = this.resetMap.get(requestId);
    if (!entry || entry.phone !== phone || entry.expiresAt < Date.now()) {
      throw new BadRequestException('重置令牌无效或已过期');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { phone },
      data: { password: hashed },
    });
    this.resetMap.delete(requestId);
    return {};
  }

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
    // 使用随机昵称作为 username
    let created: MinimalUser | null = null;
    for (let i = 0; i < 3; i++) {
      const nickname = this.generateNickname();
      try {
        const u = await this.prisma.user.create({
          data: {
            username: nickname,
            phone: dto.phone,
            email: dto.email,
            password: hashed,
            avatarUrl: this.generateDefaultAvatar(nickname),
          },
          select: { id: true, username: true, role: true },
        });
        created = u;
        break;
      } catch (e: unknown) {
        if (this.getPrismaErrorCode(e) === 'P2002') continue; // 唯一约束冲突，重试
        throw e;
      }
    }
    if (!created) throw new BadRequestException('注册失败，请重试');

    const tokens = this.generateTokens(
      created.id,
      created.username,
      created.role,
    );
    // 持久化 refreshToken（开发期简单用数组，生产建议 Redis + 轮换）
    await this.prisma.user.update({
      where: { id: created.id },
      data: { refreshTokens: { push: tokens.refreshToken } },
    });
    return tokens;
  }

  // 登录（使用 phone，即存于 username 字段）
  async login(dto: LoginUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { phone: dto.phone },
    });
    if (!user) throw new UnauthorizedException('账号或密码错误');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('账号或密码错误');

    const tokens = this.generateTokens(user.id, user.username, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokens: { push: tokens.refreshToken } },
    });
    return tokens;
  }

  // 刷新 accessToken（并轮换 refreshToken）
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        username: string;
        role: 'USER' | 'ADMIN';
      }>(refreshToken);
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, refreshTokens: { has: refreshToken } },
        select: { id: true, username: true, role: true, refreshTokens: true },
      });
      if (!user) throw new UnauthorizedException('刷新令牌无效');

      const tokens = this.generateTokens(user.id, user.username, user.role);
      // 轮换：移除旧的，加入新的
      const nextList = (user.refreshTokens || []).filter(
        (t) => t !== refreshToken,
      );
      nextList.push(tokens.refreshToken);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokens: { set: nextList } },
      });
      return tokens;
    } catch {
      throw new UnauthorizedException('刷新令牌无效');
    }
  }

  // 登出：基于 access token 找到用户并清空其 refreshTokens（服务端失效刷新能力）
  async logoutByAccessToken(authorization?: string) {
    try {
      if (
        !authorization ||
        !authorization.toLowerCase().startsWith('bearer ')
      ) {
        return; // 无授权头则视为幂等成功
      }
      const token = authorization.slice(7).trim();
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        username: string;
        role: 'USER' | 'ADMIN';
      }>(token);
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { refreshTokens: { set: [] } },
      });
    } catch {
      // 忽略异常，保持登出幂等
      return;
    }
  }

  private generateTokens(
    sub: number,
    username: string,
    role: 'USER' | 'ADMIN',
  ) {
    const payload = { sub, username, role };
    const accessToken = this.jwt.sign(payload, { expiresIn: '4h' });
    const refreshToken = this.jwt.sign(payload, { expiresIn: '30d' });
    // keep contract in docs/openapi.yaml: expiresIn is seconds for access token TTL
    const expiresIn = 4 * 60 * 60; // 4 hours
    return { accessToken, refreshToken, expiresIn };
  }

  // 简单随机昵称生成
  private generateNickname() {
    const prefix = '棋友';
    const part1 = Math.random().toString(36).slice(2, 6).toUpperCase();
    const part2 = (Math.floor(Math.random() * 900) + 100).toString();
    return `${prefix}${part1}${part2}`;
  }

  private getPrismaErrorCode(err: unknown): string | undefined {
    if (typeof err === 'object' && err && 'code' in (err as any)) {
      const code = (err as { code?: unknown }).code;
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }

  // 生成简单的 SVG 默认头像（圆底 + 首字母）
  private generateDefaultAvatar(name: string) {
    const initial = (name || '棋').charAt(0).toUpperCase();
    const colors = ['#1abc9c', '#3498db', '#9b59b6', '#e67e22', '#e74c3c'];
    const bg = colors[Math.abs(this.hashCode(name)) % colors.length];
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><style>.t{font:700 28px system-ui,Segoe UI,Arial;}</style></defs>
  <circle cx="32" cy="32" r="32" fill="${bg}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#ffffff" class="t">${initial}</text>
</svg>`;
    const b64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${b64}`;
  }

  private hashCode(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h;
  }

  // 解析 Authorization Bearer 头，返回 JWT payload
  private async parseAccessToken(authorization?: string) {
    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('未登录');
    }
    const token = authorization.slice(7).trim();
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        username: string;
        role: 'USER' | 'ADMIN';
      }>(token);
      return payload;
    } catch {
      throw new UnauthorizedException('无效的凭证');
    }
  }

  // 获取当前用户信息
  async getMe(authorization?: string) {
    const payload = await this.parseAccessToken(authorization);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        phone: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    const { username, ...rest } = user;
    return { ...rest, nickname: username };
  }

  // 基于 userId 获取当前用户信息（配合 JwtAuthGuard 使用）
  async getMeByUserId(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        phone: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        bio: true,
      },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    const { username, ...rest } = user;
    return { ...rest, nickname: username, bio: user.bio ?? null };
  }

  // 获取任意用户的公开信息（不返回手机号、邮箱等敏感字段）
  async getPublicProfileById(userId: number) {
    const [user, postCount, commentCount, likeCount, posts] =
      await this.prisma.$transaction([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
            bio: true,
          },
        }),
        this.prisma.post.count({
          where: { authorId: userId, status: 'PUBLISHED' },
        }),
        this.prisma.communityComment.count({ where: { authorId: userId } }),
        this.prisma.postLike.count({
          where: { post: { authorId: userId } },
        }),
        this.prisma.post.findMany({
          where: { authorId: userId, status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            _count: {
              select: { likes: true, comments: true },
            },
          },
        }),
      ]);

    if (!user) throw new UnauthorizedException('用户不存在');
    const { username, ...rest } = user;
    return {
      ...rest,
      nickname: username,
      bio: (user as any).bio ?? null,
      stats: {
        posts: postCount,
        comments: commentCount,
        likes: likeCount,
      },
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title ?? '(无标题)',
        excerpt: p.content?.slice(0, 200) ?? '',
        createdAt: p.createdAt,
        likeCount: (p as any)._count?.likes ?? 0,
        commentCount: (p as any)._count?.comments ?? 0,
      })),
    };
  }

  // 更新当前用户信息（支持 nickname/password/avatarUrl）
  async updateMe(
    authorization: string | undefined,
    patch: { password?: string; avatarUrl?: string | null; nickname?: string },
  ) {
    const payload = await this.parseAccessToken(authorization);
    const data: {
      password?: string;
      avatarUrl?: string | null;
      username?: string;
    } = {};
    if (
      typeof patch.nickname === 'string' &&
      patch.nickname.trim().length > 0
    ) {
      data.username = patch.nickname.trim();
    }
    if (typeof patch.avatarUrl !== 'undefined') {
      data.avatarUrl = patch.avatarUrl;
    }
    if (typeof patch.password === 'string' && patch.password.length > 0) {
      data.password = await bcrypt.hash(patch.password, 10);
    }
    try {
      const updated = await this.prisma.user.update({
        where: { id: payload.sub },
        data,
        select: {
          id: true,
          username: true,
          phone: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      });
      const { username, ...rest } = updated;
      return { ...rest, nickname: username };
    } catch (e: unknown) {
      if (this.getPrismaErrorCode(e) === 'P2002')
        throw new BadRequestException('昵称已被占用');
      throw e;
    }
  }

  // 基于 userId 更新当前用户信息（配合 JwtAuthGuard 使用）
  async updateMeByUserId(
    userId: number,
    patch: {
      password?: string;
      avatarUrl?: string | null;
      nickname?: string;
      bio?: string | null;
    },
  ) {
    const data: {
      password?: string;
      avatarUrl?: string | null;
      username?: string;
      bio?: string | null;
    } = {};
    if (
      typeof patch.nickname === 'string' &&
      patch.nickname.trim().length > 0
    ) {
      data.username = patch.nickname.trim();
    }
    if (typeof patch.avatarUrl !== 'undefined') {
      data.avatarUrl = patch.avatarUrl;
    }
    if (typeof patch.password === 'string' && patch.password.length > 0) {
      data.password = await bcrypt.hash(patch.password, 10);
    }
    if (typeof patch.bio === 'string' || patch.bio === null) {
      data.bio = patch.bio;
    }
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          username: true,
          phone: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          bio: true,
        },
      });
      const { username, ...rest } = updated;
      return { ...rest, nickname: username };
    } catch (e: unknown) {
      if (this.getPrismaErrorCode(e) === 'P2002')
        throw new BadRequestException('昵称已被占用');
      throw e;
    }
  }
}
