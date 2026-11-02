export const WORK_ENTRY_TYPES = ["market", "other_work", "private_work"] as const;
export type WorkEntryType = (typeof WORK_ENTRY_TYPES)[number];

export const REASON_MAX_LENGTH = 500;

export interface WorkEntryInput {
  entry_type: WorkEntryType;
  store_id: number | null;
  reason: string | null;
}

type WorkEntryResult = { value: WorkEntryInput } | { error: string };

// An entry is exactly one of the three types, so a payload that mixes them is
// rejected instead of silently saving a leftover market or reason. A missing
// entry_type means a market visit, which is what older clients send.
export const parseWorkEntry = (body: {
  entry_type?: unknown;
  store_id?: unknown;
  reason?: unknown;
}): WorkEntryResult => {
  const entryType = body.entry_type ?? "market";

  if (!WORK_ENTRY_TYPES.includes(entryType as WorkEntryType)) {
    return { error: "Lloji i punës është i pavlefshëm." };
  }

  if (body.reason !== undefined && body.reason !== null && typeof body.reason !== "string") {
    return { error: "Arsyeja duhet të jetë tekst." };
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const hasStore = body.store_id !== undefined && body.store_id !== null;

  if (entryType === "market") {
    const storeId = Number(body.store_id);

    if (!hasStore || !Number.isInteger(storeId) || storeId <= 0) {
      return { error: "Zgjidh marketin." };
    }

    if (reason) {
      return { error: "Arsyeja lejohet vetëm për Punë tjetër ose Punë private." };
    }

    return { value: { entry_type: "market", store_id: storeId, reason: null } };
  }

  if (hasStore) {
    return { error: "Marketi lejohet vetëm për vizita në market." };
  }

  if (reason.length > REASON_MAX_LENGTH) {
    return { error: `Arsyeja nuk mund të ketë më shumë se ${REASON_MAX_LENGTH} karaktere.` };
  }

  return {
    value: {
      entry_type: entryType as WorkEntryType,
      store_id: null,
      reason: reason || null,
    },
  };
};
