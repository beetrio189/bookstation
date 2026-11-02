import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config';
import { AppModule } from './modules/app.module';
import { ERRORS } from './utils/errors/errors';
import { validationExceptionFactory } from './utils/errors/validation-exception.factory';

const setMiddleware = (app: NestExpressApplication) => {
  app.set('trust proxy', 1);

  app.enableCors({ origin: env.feUrl, credentials: true });
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        error: {
          code: ERRORS.TOO_MANY_REQUESTS.code,
          message: ERRORS.TOO_MANY_REQUESTS.message,
        },
      },
    }),
  );
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(compression());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
};

const setSwagger = (app: NestExpressApplication) => {
  const config = new DocumentBuilder()
    .setTitle('BookStation')
    .setDescription('API documentation for BookStation backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  setMiddleware(app);

  if (env.nodeEnv !== 'production') {
    setSwagger(app);
  }

  await app.listen(env.port);
  new Logger('App').log(`Listening on port ${env.port}`);
}

bootstrap().catch((err) => {
  new Logger('App').error(err);
  process.exit(1);
});
