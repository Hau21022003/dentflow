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
  ),
  (
    '00000000-0000-4000-8000-000000000133',
    'staff-invitation',
    'vi',
    1,
    'PUBLISHED',
    'Lời mời tham gia {{tenantDisplayName}} trên DentFlow',
    'Bạn được mời tham gia {{tenantDisplayName}} trên DentFlow.\n\nChấp nhận lời mời: {{invitationUrl}}\n\nLời mời này hết hạn vào {{expiresAt}}.',
    '<p>Bạn được mời tham gia <strong>{{tenantDisplayName}}</strong> trên DentFlow.</p><p><a href="{{invitationUrl}}">Chấp nhận lời mời</a></p><p>Lời mời này hết hạn vào {{expiresAt}}.</p>',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000134',
    'staff-invitation',
    'en',
    1,
    'PUBLISHED',
    'Join {{tenantDisplayName}} on DentFlow',
    'You were invited to join {{tenantDisplayName}} on DentFlow.\n\nAccept the invitation: {{invitationUrl}}\n\nThis invitation expires at {{expiresAt}}.',
    '<p>You were invited to join <strong>{{tenantDisplayName}}</strong> on DentFlow.</p><p><a href="{{invitationUrl}}">Accept invitation</a></p><p>This invitation expires at {{expiresAt}}.</p>',
    now()
  )
ON CONFLICT ("template_key", "locale", "version") DO NOTHING;
