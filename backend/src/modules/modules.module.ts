import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TestingModule } from './testing/testing.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [UsersModule, AuthModule, TestingModule],
})
export class ModulesModule {}
