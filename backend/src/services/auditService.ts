import { Request } from "express";
import { AuditTrail, AuditAction } from "../models/AuditTrail";

interface RecordAuditOpts {
  userId?: string;
  action: AuditAction;
  aktivitas: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Persists an audit trail entry. Failures are swallowed (logged) so auditing
 * never breaks the main request flow.
 */
export async function recordAudit(opts: RecordAuditOpts): Promise<void> {
  try {
    await AuditTrail.create({
      userId: opts.userId || null,
      action: opts.action,
      aktivitas: opts.aktivitas,
      metadata: opts.metadata || {},
      ipAddress: opts.req?.ip,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[audit] failed to record audit trail:", (err as Error).message);
  }
}
