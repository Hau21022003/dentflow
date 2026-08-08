import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TotpService } from './totp.service';
import { TotpController } from './totp.controller';
import { TotpFactor } from './entities/totp-factor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TotpFactor])],
  controllers: [TotpController],
  providers: [TotpService],
})
export class TotpModule {}
