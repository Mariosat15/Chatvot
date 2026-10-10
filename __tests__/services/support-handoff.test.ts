/**
 * Support handoff resolution — whose client the AI connects.
 */

import { describe, expect, it } from "vitest";
import {
  filterAutoAssignCandidates,
  resolveSupportHandoffEmployee,
  type HandoffAdmin,
} from "@/lib/services/messaging/resolve-support-handoff";

function admin(
  id: string,
  role: string,
  opts: Partial<HandoffAdmin> & { name: string },
): HandoffAdmin {
  return {
    _id: { toString: () => id },
    role,
    isAvailableForChat: true,
    isLockedOut: false,
    ...opts,
  };
}

describe("resolveSupportHandoffEmployee", () => {
  const fullAdmin = admin("adm1", "Full Admin", { name: "Admin" });
  const agentA = admin("a1", "Backoffice", { name: "Agent A" });
  const agentB = admin("a2", "Backoffice", { name: "Agent B" });
  const all = [fullAdmin, agentA, agentB];

  it("prefers the live customer assignment over a stale ticket stamp", () => {
    const result = resolveSupportHandoffEmployee({
      userId: "u1",
      conversation: { assignedEmployeeId: "adm1" },
      assignmentEmployeeId: "a1",
      activeAdmins: all,
    });
    expect(result?.id).toBe("a1");
    expect(result?.name).toBe("Agent A");
  });

  it("keeps a temporary chat redirect on the cover employee", () => {
    const result = resolveSupportHandoffEmployee({
      userId: "u1",
      conversation: {
        assignedEmployeeId: "a2",
        isChatTransferred: true,
      },
      assignmentEmployeeId: "a1",
      activeAdmins: all,
    });
    expect(result?.id).toBe("a2");
  });

  it("falls back to an account manager before Full Admin when unassigned", () => {
    const result = resolveSupportHandoffEmployee({
      userId: "u1",
      conversation: null,
      assignmentEmployeeId: null,
      activeAdmins: all,
    });
    expect(result?.id).toBe("a1");
    expect(result?.name).not.toBe("Admin");
  });

  it("keeps the assigned manager even when marked unavailable for chat", () => {
    // Reason: isAvailableForChat is presence, not ownership. GM contact-us and
    // ordinary escalate both name the assigned employee — stealing the client
    // for Andy.A (or anyone else) because the inbox showed offline is the bug.
    const busyA = admin("a1", "Backoffice", {
      name: "Agent A",
      isAvailableForChat: false,
    });
    const andy = admin("andy", "Support Agent", { name: "Andy.A" });
    const result = resolveSupportHandoffEmployee({
      userId: "u1",
      conversation: { assignedEmployeeId: "andy" },
      assignmentEmployeeId: "a1",
      activeAdmins: [fullAdmin, busyA, andy, agentB],
    });
    expect(result?.id).toBe("a1");
    expect(result?.name).toBe("Agent A");
  });

  it("covers a locked-out assigned manager with another Backoffice first", () => {
    const lockedA = admin("a1", "Backoffice", {
      name: "Agent A",
      isLockedOut: true,
    });
    const result = resolveSupportHandoffEmployee({
      userId: "u1",
      conversation: null,
      assignmentEmployeeId: "a1",
      activeAdmins: [fullAdmin, lockedA, agentB],
    });
    expect(result?.id).toBe("a2");
  });
});

describe("filterAutoAssignCandidates", () => {
  it("removes Full Admin from the auto-assign pool", () => {
    const pool = filterAutoAssignCandidates([
      { role: "Full Admin" },
      { role: "Backoffice" },
      { role: "Support Agent" },
    ]);
    expect(pool).toEqual([{ role: "Backoffice" }, { role: "Support Agent" }]);
  });
});
