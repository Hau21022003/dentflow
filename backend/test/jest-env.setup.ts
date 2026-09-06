process.env.FRONTEND_ORIGIN ??= 'http://localhost:5173';
process.env.AUDIT_IP_HMAC_SECRET ??= 'test-audit-ip-hmac-secret';
process.env.IDEMPOTENCY_HMAC_SECRET ??= 'test-idempotency-hmac-secret';
process.env.IDEMPOTENCY_PROCESSING_LEASE ??= '5m';
process.env.IDEMPOTENCY_COMPLETED_RETENTION ??= '30d';
