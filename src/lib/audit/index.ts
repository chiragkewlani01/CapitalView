import { prisma } from "@/lib/prisma";
import { AuditAction } from "@prisma/client";

export interface AuditLogEntry {
  companyId?: string;
  userId?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: entry.companyId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        oldValues: entry.oldValues ?? undefined,
        newValues: entry.newValues ?? undefined,
        metadata: entry.metadata ?? undefined,
        ipAddress: entry.ipAddress,
      },
    });
  } catch (error) {
    // Audit logging should never crash the main operation
    console.error("Audit log failed:", error);
  }
}
