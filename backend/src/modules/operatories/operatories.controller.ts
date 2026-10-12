import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScope } from '../../common/decorators/tenant-scope.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { Idempotent } from '../idempotency/idempotent.decorator';
import {
  CreateOperatoryDto,
  ListOperatoriesQueryDto,
  OperatoryReasonDto,
  UpdateOperatoryDto,
} from './dto/operatory.dto';
import { OperatoriesService } from './operatories.service';

@Controller('tenants/:tenantSlug/branches/:branchSlug/operatories')
@TenantScope('branch')
@RequirePermissions(Permission.OPERATORY_MANAGE)
export class OperatoriesController {
  constructor(private readonly service: OperatoriesService) {}

  @Get()
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListOperatoriesQueryDto,
  ) {
    return this.service.list(context, query);
  }

  @Get(':operatoryId')
  get(
    @RequestContext() context: AuthorizationContext,
    @Param('operatoryId', ParseUUIDPipe) operatoryId: string,
  ) {
    return this.service.get(context, operatoryId);
  }

  @Post()
  @Idempotent('clinical.operatory.create')
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateOperatoryDto,
  ) {
    return this.service.create(context, body);
  }

  @Patch(':operatoryId')
  @Idempotent('clinical.operatory.update')
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('operatoryId', ParseUUIDPipe) operatoryId: string,
    @Body() body: UpdateOperatoryDto,
  ) {
    return this.service.update(context, operatoryId, body);
  }

  @Post(':operatoryId/deactivate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.operatory.deactivate')
  deactivate(
    @RequestContext() context: AuthorizationContext,
    @Param('operatoryId', ParseUUIDPipe) operatoryId: string,
    @Body() body: OperatoryReasonDto,
  ) {
    return this.service.changeActivity(
      context,
      operatoryId,
      false,
      body.reason,
    );
  }

  @Post(':operatoryId/activate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.operatory.activate')
  activate(
    @RequestContext() context: AuthorizationContext,
    @Param('operatoryId', ParseUUIDPipe) operatoryId: string,
    @Body() body: OperatoryReasonDto,
  ) {
    return this.service.changeActivity(context, operatoryId, true, body.reason);
  }
}
