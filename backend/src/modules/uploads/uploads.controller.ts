import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScope } from '../../common/decorators/tenant-scope.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { CreateImageUploadIntentDto } from './dto/create-image-upload-intent.dto';
import { CreateUserImageUploadIntentDto } from './dto/create-user-image-upload-intent.dto';
import { UploadsService } from './uploads.service';

@Controller()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('tenants/:tenantSlug/branches/:branchSlug/uploads/image-intents')
  @HttpCode(HttpStatus.CREATED)
  @TenantScope('branch')
  @RequirePermissions(Permission.FILE_UPLOAD)
  createImageIntent(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateImageUploadIntentDto,
  ) {
    return this.uploadsService.createImageUploadIntent(context, body);
  }

  @Post('uploads/image-intents')
  @HttpCode(HttpStatus.CREATED)
  createUserImageIntent(
    @CurrentUserId() userId: string,
    @Body() body: CreateUserImageUploadIntentDto,
  ) {
    return this.uploadsService.createUserImageUploadIntent(userId, body);
  }
}
