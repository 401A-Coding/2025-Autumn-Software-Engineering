import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { load } from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 启用 CORS，便于前端在 Vite (默认 5173) 开发环境跨域访问
  app.enableCors({
    origin: [
      /http:\/\/localhost:5173$/,
      /http:\/\/127\.0\.0\.1:5173$/,
      /http:\/\/192\.168\.[0-9]+\.[0-9]+:5173$/,
      /http:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+:5173$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Serve Swagger UI from contract-first spec (docs/openapi.yaml)
  try {
    const specPath = path.resolve(process.cwd(), '..', 'docs', 'openapi.yaml');
    const raw = fs.readFileSync(specPath, 'utf8');
    const spec = load(raw) as Record<string, unknown>;
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
    // Expose machine-readable JSON
    app.use('/api-json', (_req: Request, res: Response) => {
      res.json(spec);
    });
  } catch (e) {
    console.warn(
      '[swagger] Failed to load docs/openapi.yaml:',
      (e as Error).message,
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
