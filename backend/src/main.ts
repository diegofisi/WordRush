import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Server } from 'node:http';
import { AppModule } from './app.module';
import { parseAllowedOrigins, parsePort } from '@shared/config/env';
import { CorsIoAdapter } from '@shared/socket/cors-io.adapter';

/**
 * Longer than the 60 s a Railway edge proxy holds an idle connection, so the
 * proxy is always the one to close it. A Node server that hangs up first
 * races the next request onto the same socket, which the client then sees as
 * a dropped connection: for a long-polling socket, a disconnection.
 */
const KEEP_ALIVE_TIMEOUT_MS = 65_000;
/** Must exceed `keepAliveTimeout`, or Node closes the kept-alive socket itself. */
const HEADERS_TIMEOUT_MS = 66_000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(ConfigService);
  const origins = parseAllowedOrigins(config.get<string>('FRONTEND_URL'));
  const port = parsePort(config.get<string>('PORT'));

  app.enableCors({ origin: origins ?? true, credentials: true });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
  app.enableShutdownHooks();

  const server = app.getHttpServer() as Server;
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;

  await app.listen(port, '0.0.0.0');
  Logger.log(
    `WordRush server listening on 0.0.0.0:${port} (CORS: ${origins ? origins.join(', ') : 'any origin'})`,
    'Bootstrap',
  );
}

void bootstrap();
