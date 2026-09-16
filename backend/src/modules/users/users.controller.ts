import { Body, Controller, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.types';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  updateMyProfile(
    @CurrentUser() actor: AccessTokenPayload,
    @Body() body: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMyProfile(actor, body);
  }
}
