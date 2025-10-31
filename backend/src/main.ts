import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
