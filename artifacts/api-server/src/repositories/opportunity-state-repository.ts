import { db } from "@workspace/db";
import {
  opportunityWorkingStateTable,
  type OpportunityWorkingState,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export const LOGICGATE_STATE_TYPE = "logicgate_session" as const;
export const LOGICGATE_SCHEMA_VERSION = "1" as const;

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

export async function upsertWorkingState(
  opportunityId: string,
  payload: Record<string, unknown>,
  userId?: string,
  stateType: string = LOGICGATE_STATE_TYPE,
  schemaVersion: string = LOGICGATE_SCHEMA_VERSION,
): Promise<OpportunityWorkingState> {
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
  return row;
}
