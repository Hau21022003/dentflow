export interface RequestAuditContext {
  requestId: string;
  sourceIpHmac: string | null;
  userAgent: string | null;
}
