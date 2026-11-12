import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);

  // Nhận SIGTERM khi deploy thì làm nốt job đang chạy rồi mới tắt
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker đang chạy');
}

bootstrap().catch((err) => {
  new Logger('Worker').error(err);
  process.exit(1);
});
