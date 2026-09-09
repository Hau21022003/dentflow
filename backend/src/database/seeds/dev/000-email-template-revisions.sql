INSERT INTO "email_template_revisions" (
  "id",
  "template_key",
  "locale",
  "version",
  "status",
  "subject",
  "text",
  "html",
  "published_at"
) VALUES
  (
    '00000000-0000-4000-8000-000000000131',
    'tenant-owner-invitation',
    'vi',
    1,
    'PUBLISHED',
    'Kích hoạt tài khoản DentFlow của {{tenantDisplayName}}',
    'Bạn được mời quản trị {{tenantDisplayName}} trên DentFlow.\n\nKích hoạt tài khoản: {{invitationUrl}}\n\nLời mời này hết hạn vào {{expiresAt}}.',
    '<p>Bạn được mời quản trị <strong>{{tenantDisplayName}}</strong> trên DentFlow.</p><p><a href="{{invitationUrl}}">Kích hoạt tài khoản</a></p><p>Lời mời này hết hạn vào {{expiresAt}}.</p>',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000132',
    'tenant-owner-invitation',
    'en',
    1,
    'PUBLISHED',
    'Activate your {{tenantDisplayName}} DentFlow account',
    'You were invited to administer {{tenantDisplayName}} on DentFlow.\n\nActivate your account: {{invitationUrl}}\n\nThis invitation expires at {{expiresAt}}.',
    '<p>You were invited to administer <strong>{{tenantDisplayName}}</strong> on DentFlow.</p><p><a href="{{invitationUrl}}">Activate your account</a></p><p>This invitation expires at {{expiresAt}}.</p>',
    now()
  )
ON CONFLICT ("template_key", "locale", "version") DO NOTHING;
