import { Module } from '@nestjs/common';
import { DevSepayController } from './dev-sepay.controller';

// API thử nghiệm cho môi trường dev, app.module không nạp module này ở production
@Module({ controllers: [DevSepayController] })
export class DevModule {}
