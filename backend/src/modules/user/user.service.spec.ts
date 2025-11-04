import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

// Mock bcryptjs default export used in service
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: jest.fn((s: string) => Promise.resolve(`hashed:${s}`)),
    compare: jest.fn(() => Promise.resolve(true)),
  },
}));

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let jwt: { sign: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = {
      sign: jest.fn(() => 'token-xxx'),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('register should return tokens with expiresIn', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 1,
      username: '13800000000',
      role: 'USER',
    });

    const regDto = new CreateUserDto();
    regDto.phone = '13800000000';
    regDto.password = 'Abc12345';

    const res = await service.register(regDto);

    expect(jwt.sign).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
    expect(res).toHaveProperty('accessToken');
    expect(res).toHaveProperty('refreshToken');
    expect(res).toHaveProperty('expiresIn', 1800);
  });

  it('register should reject when phone already exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 2 });
    const regDto = new CreateUserDto();
    regDto.phone = '13800000000';
    regDto.password = 'Abc12345';
    await expect(service.register(regDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('login should return tokens when password matches', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 3,
      username: '13800000000',
      role: 'USER',
      password: 'hashed:Abc12345',
    });
    const loginDto = new LoginUserDto();
    loginDto.phone = '13800000000';
    loginDto.password = 'Abc12345';
    const res = await service.login(loginDto);
    expect(res).toHaveProperty('accessToken');
    expect(res).toHaveProperty('refreshToken');
    expect(res).toHaveProperty('expiresIn', 1800);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('login should throw Unauthorized when user not found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const dto = new LoginUserDto();
    dto.phone = 'not-exist';
    dto.password = 'xxx';
    await expect(service.login(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logoutByAccessToken should clear refreshTokens when auth header valid', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 9, username: 'u9', role: 'USER' });
    await service.logoutByAccessToken('Bearer access-token');
    expect(jwt.verifyAsync).toHaveBeenCalledWith('access-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { refreshTokens: { set: [] } },
    });
  });

  it('logoutByAccessToken should be idempotent for missing/invalid header', async () => {
    await service.logoutByAccessToken(undefined);
    await service.logoutByAccessToken('');
    await service.logoutByAccessToken('Token something');
    jwt.verifyAsync.mockRejectedValue(new Error('bad'));
    await service.logoutByAccessToken('Bearer bad');
    // No throws and prisma.user.update may not be called in these cases
    expect(true).toBe(true);
  });

  it('refresh should rotate token and return new tokens', async () => {
    const oldToken = 'old-refresh';
    jwt.verifyAsync.mockResolvedValue({
      sub: 1,
      username: '138',
      role: 'USER',
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 1,
      username: '138',
      role: 'USER',
      refreshTokens: [oldToken, 'another'],
    });
    type UpdateArg = {
      where: { id: number };
      data: { refreshTokens: { set: string[] } };
    };
    let capturedArg: UpdateArg | undefined;
    prisma.user.update.mockImplementation((arg: UpdateArg) => {
      capturedArg = arg;
      return Promise.resolve({});
    });
    const res = await service.refresh(oldToken);
    expect(res).toHaveProperty('accessToken');
    expect(res).toHaveProperty('refreshToken');
    expect(prisma.user.update).toHaveBeenCalled();
    expect(capturedArg).toBeDefined();
    expect(capturedArg!.where).toEqual({ id: 1 });
    expect(Array.isArray(capturedArg!.data.refreshTokens.set)).toBe(true);
    expect(capturedArg!.data.refreshTokens.set).not.toContain(oldToken);
  });

  it('refresh should throw when token invalid', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('bad token'));
    await expect(service.refresh('bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
