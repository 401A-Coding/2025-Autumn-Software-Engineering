import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('Battles E2E', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const makeToken = (sub: number) =>
    jwt.sign({ sub, username: `u${sub}`, role: 'USER' });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwt = moduleFixture.get(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('quick match pairs two users, then cancel on waiting works for creator only', async () => {
    const t1 = makeToken(9001);
    const t2 = makeToken(9002);

    // user1 quick match -> creates waiting room
    const m1 = await request(app.getHttpServer())
      .post('/api/v1/battles/match')
      .set('Authorization', `Bearer ${t1}`)
      .send({ mode: 'pvp' })
      .expect(201);
    const battleId = (m1.body as { battleId: number }).battleId;
    expect(typeof battleId).toBe('number');

    // snapshot: waiting with single player
    const s1 = await request(app.getHttpServer())
      .get(`/api/v1/battles/${battleId}`)
      .set('Authorization', `Bearer ${t1}`)
      .expect(200);
    expect((s1.body as { status: string; players: number[] }).status).toBe(
      'waiting',
    );
    expect((s1.body as { status: string; players: number[] }).players).toEqual([
      9001,
    ]);

    // user2 quick match -> joins same battle, status becomes playing
    const m2 = await request(app.getHttpServer())
      .post('/api/v1/battles/match')
      .set('Authorization', `Bearer ${t2}`)
      .send({ mode: 'pvp' })
      .expect(201);
    expect((m2.body as { battleId: number }).battleId).toBe(battleId);

    const s2 = await request(app.getHttpServer())
      .get(`/api/v1/battles/${battleId}`)
      .set('Authorization', `Bearer ${t1}`)
      .expect(200);
    expect((s2.body as { status: string; players: number[] }).status).toBe(
      'playing',
    );
    expect(
      (s2.body as { status: string; players: number[] }).players.sort(),
    ).toEqual([9001, 9002].sort());

    // creator tries to cancel now should fail (not waiting)
    await request(app.getHttpServer())
      .post('/api/v1/battles/cancel')
      .set('Authorization', `Bearer ${t1}`)
      .send({ battleId })
      .expect(400);

    // create a new waiting and cancel as creator
    const t3 = makeToken(9011);
    const m3 = await request(app.getHttpServer())
      .post('/api/v1/battles/match')
      .set('Authorization', `Bearer ${t3}`)
      .send({ mode: 'pvp' })
      .expect(201);
    const bid2 = (m3.body as { battleId: number }).battleId;
    const c1 = await request(app.getHttpServer())
      .post('/api/v1/battles/cancel')
      .set('Authorization', `Bearer ${t3}`)
      .send({ battleId: bid2 })
      .expect(201);
    expect(c1.body).toEqual({ battleId: bid2, cancelled: true });
    // snapshot should now 400
    await request(app.getHttpServer())
      .get(`/api/v1/battles/${bid2}`)
      .set('Authorization', `Bearer ${t3}`)
      .expect(400);
  });

  it('leave API works idempotently and converts to waiting when one leaves', async () => {
    const t1 = makeToken(9901);
    const t2 = makeToken(9902);
    const m1 = await request(app.getHttpServer())
      .post('/api/v1/battles/match')
      .set('Authorization', `Bearer ${t1}`)
      .send({ mode: 'pvp' })
      .expect(201);
    const bid = (m1.body as { battleId: number }).battleId;
    await request(app.getHttpServer())
      .post('/api/v1/battles/match')
      .set('Authorization', `Bearer ${t2}`)
      .send({ mode: 'pvp' })
      .expect(201);
    // user2 leaves -> ok
    const l1 = await request(app.getHttpServer())
      .post('/api/v1/battles/leave')
      .set('Authorization', `Bearer ${t2}`)
      .send({ battleId: bid })
      .expect(201);
    expect(l1.body as { battleId: number; left: boolean }).toEqual({
      battleId: bid,
      left: true,
    });
    const s = await request(app.getHttpServer())
      .get(`/api/v1/battles/${bid}`)
      .set('Authorization', `Bearer ${t1}`)
      .expect(200);
    expect((s.body as { status: string; players: number[] }).status).toBe(
      'waiting',
    );
    expect((s.body as { status: string; players: number[] }).players).toEqual([
      9901,
    ]);
    // user2 leaves again -> idempotent false
    const l2 = await request(app.getHttpServer())
      .post('/api/v1/battles/leave')
      .set('Authorization', `Bearer ${t2}`)
      .send({ battleId: bid })
      .expect(201);
    expect((l2.body as { left: boolean }).left).toBe(false);
  });

  it('offline endpoint accepts userId in body and returns ok', async () => {
    const t1 = makeToken(9010);

    // Create a battle first
    const m1 = await request(app.getHttpServer())
      .post('/api/v1/battles/match')
      .set('Authorization', `Bearer ${t1}`)
      .send({ mode: 'pvp' })
      .expect(201);
    const battleId = (m1.body as { battleId: number }).battleId;

    // Call offline endpoint with userId in body (no auth required)
    const offline = await request(app.getHttpServer())
      .post(`/api/v1/battles/${battleId}/offline`)
      .send({ userId: 9010 })
      .expect(201);
    expect((offline.body as { ok: boolean }).ok).toBe(true);
  });
});

