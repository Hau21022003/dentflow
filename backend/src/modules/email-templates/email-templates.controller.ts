import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlatformScope } from '../../common/decorators/platform-scope.decorator';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { SaveEmailTemplateDraftDto } from './dto/save-email-template-draft.dto';
import {
  assertEmailTemplateKey,
  assertEmailTemplateLocale,
} from './email-template-registry';
import { EmailTemplatesService } from './email-templates.service';

@ApiTags('Platform email templates')
@Controller('platform/email-templates')
@PlatformScope()
@RequirePermissions(Permission.PLATFORM_EMAIL_TEMPLATE_MANAGE)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  list() {
    return this.emailTemplatesService.list();
  }

  @Get(':templateKey/:locale')
  get(
    @Param('templateKey') templateKey: string,
    @Param('locale') locale: string,
  ) {
    return this.emailTemplatesService.get(
      assertEmailTemplateKey(templateKey),
      assertEmailTemplateLocale(locale),
    );
  }

  @Put(':templateKey/:locale/draft')
  @Idempotent('platform.email-template.draft.save')
  saveDraft(
    @RequestContext() context: AuthorizationContext,
    @Param('templateKey') templateKey: string,
    @Param('locale') locale: string,
    @Body() body: SaveEmailTemplateDraftDto,
  ) {
    return this.emailTemplatesService.saveDraft(
      context,
      assertEmailTemplateKey(templateKey),
      assertEmailTemplateLocale(locale),
      body,
    );
  }

  @Post(':templateKey/:locale/publish')
  @Idempotent('platform.email-template.publish')
  publish(
    @RequestContext() context: AuthorizationContext,
    @Param('templateKey') templateKey: string,
    @Param('locale') locale: string,
    @Body() body: SaveEmailTemplateDraftDto,
  ) {
    return this.emailTemplatesService.publish(
      context,
      assertEmailTemplateKey(templateKey),
      assertEmailTemplateLocale(locale),
      body,
    );
  }

  @Post(':templateKey/:locale/draft/publish')
  @Idempotent('platform.email-template.draft.publish')
  publishDraft(
    @RequestContext() context: AuthorizationContext,
    @Param('templateKey') templateKey: string,
    @Param('locale') locale: string,
  ) {
    return this.emailTemplatesService.publishDraft(
      context,
      assertEmailTemplateKey(templateKey),
      assertEmailTemplateLocale(locale),
    );
  }
}
