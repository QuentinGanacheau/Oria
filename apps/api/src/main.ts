import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  // Adaptateur Express passé explicitement : l'instrumentation Sentry
  // (OpenTelemetry) intercepte les require() et casse le chargement DYNAMIQUE
  // de @nestjs/platform-express que ferait NestFactory.create(AppModule) seul
  // → "No driver (HTTP) has been selected". L'import statique contourne ça.
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  app.setGlobalPrefix('v1');
  // FRONTEND_URL accepte plusieurs origines séparées par des virgules.
  // On autorise aussi tous les déploiements *.vercel.app (previews + alias),
  // car Vercel génère une URL distincte par déploiement.
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Pas d'origin = appels server-to-server / curl → autorisés
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(new URL(origin).hostname);
      callback(
        isAllowed ? null : new Error(`CORS bloqué : ${origin}`),
        isAllowed,
      );
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.PORT ?? 4000;
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
  await app.listen(port);
}
bootstrap();
