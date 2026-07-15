import { db } from "@workspace/db";
import {
  opportunityWorkingStateTable,
  type OpportunityWorkingState,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export const LOGICGATE_STATE_TYPE = "logicgate_session" as const;
export const LOGICGATE_SCHEMA_VERSION = "1" as const;

export type UpsertWorkingStateResult =
  | { row: OpportunityWorkingState; conflict: false }
  | { row: OpportunityWorkingState; conflict: true };

export async function getWorkingState(
  opportunityId: string,
  stateType: string = LOGICGATE_STATE_TYPE,
): Promise<OpportunityWorkingState | null> {
  const [row] = await db
    .select()
    .from(opportunityWorkingStateTable)
    .where(
      and(
        eq(opportunityWorkingStateTable.opportunityId, opportunityId),
        eq(opportunityWorkingStateTable.stateType, stateType),
      ),
    );
  return row ?? null;
}

/**
 * Upsert working state, with optional optimistic concurrency check.
 *
 * When `expectedVersion` is supplied it must be the ISO string of the
 * `updatedAt` timestamp last seen by the client. If the current row's
 * `updatedAt` is strictly newer, the write is rejected and `conflict: true`
 * is returned along with the current (winning) row, so the caller can
 * respond with a 409 and the authoritative server version.
 *
 * When `expectedVersion` is omitted the upsert is unconditional (legacy
 * behaviour — used for first saves where no version has been seen yet).
 */
export async function upsertWorkingState(
  opportunityId: string,
  payload: Record<string, unknown>,
  userId?: string,
  expectedVersion?: string,
  stateType: string = LOGICGATE_STATE_TYPE,
  schemaVersion: string = LOGICGATE_SCHEMA_VERSION,
): Promise<UpsertWorkingStateResult> {
  // Optimistic concurrency check
  if (expectedVersion !== undefined) {
    const current = await getWorkingState(opportunityId, stateType);
    if (current?.updatedAt) {
      const currentMs = current.updatedAt.getTime();
      const expectedMs = new Date(expectedVersion).getTime();
      if (currentMs > expectedMs) {
        return { row: current, conflict: true };
      }
    }
  }

  const [row] = await db
    .insert(opportunityWorkingStateTable)
    .values({
      opportunityId,
      stateType,
      schemaVersion,
      payload,
      createdByUserId: userId ?? null,
    })
    .onConflictDoUpdate({
      target: [
        opportunityWorkingStateTable.opportunityId,
        opportunityWorkingStateTable.stateType,
      ],
      set: {
        payload,
        schemaVersion,
        updatedAt: new Date(),
      },
    })
    .returning();
  return { row, conflict: false };
}
