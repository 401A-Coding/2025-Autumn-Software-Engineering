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
  let prisma: { user: { findFirst: jest.Mock; create: jest.Mock } };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = {
      sign: jest.fn(() => 'token-xxx'),
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
});
