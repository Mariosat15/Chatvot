/**
 * Who should receive a support chat when the AI hands off.
 *
 * Reason (6 Oct 2026): two escalate paths preferred a stale
 * `conversation.assignedEmployeeId` over `customer_assignments`, so the admin
 * badge could show Manager A while the player was connected to Manager B
 * (or the first Full Admin in the collection). Admin assignment is the source
 * of truth for "whose client"; temporary chat redirects are the exception.
 */

export type HandoffAdmin = {
  _id: { toString(): string };
  name?: string;
  email?: string;
  profileImage?: string;
  role?: string;
  isLockedOut?: boolean;
  isAvailableForChat?: boolean;
};

export type HandoffEmployee = {
  id: string;
  name: string;
  avatar?: string;
};

/** Roles that own customers day-to-day. Full Admin is a platform owner, not a pool default. */
export const ACCOUNT_MANAGER_ROLES = ["Backoffice", "Support Agent"] as const;

/** Last-resort roles when no account manager is free. */
export const FALLBACK_SUPPORT_ROLES = [
  "Backoffice",
  "Support Agent",
  "Full Admin",
] as const;

/** Never auto-assign new customers to these roles, even if enabled in settings. */
export const AUTO_ASSIGN_EXCLUDED_ROLES = ["Full Admin"] as const;

export type ConversationHandoffFacts = {
  assignedEmployeeId?: { toString(): string } | string | null;
  temporarilyRedirected?: boolean;
  /** Written by admin raw updates; may be absent from the Mongoose schema. */
  isChatTransferred?: boolean;
};

function toEmployee(admin: HandoffAdmin): HandoffEmployee {
  return {
    id: admin._id.toString(),
    name: admin.name || admin.email?.split("@")[0] || "Support",
    avatar: admin.profileImage,
  };
}

function isEligibleAssignee(admin: HandoffAdmin | undefined): admin is HandoffAdmin {
  // Reason: isAvailableForChat is a presence hint for the inbox, not permission to
  // steal somebody else's client. Only a lock-out may skip the assigned manager.
  return !!admin && admin.isLockedOut !== true;
}

function isChatAvailable(admin: HandoffAdmin | undefined): admin is HandoffAdmin {
  return (
    isEligibleAssignee(admin) && admin.isAvailableForChat !== false
  );
}

function pickFromRoles(
  admins: HandoffAdmin[],
  roles: readonly string[],
  excludeId?: string,
): HandoffAdmin | null {
  return (
    admins.find(
      (a) =>
        a._id.toString() !== excludeId &&
        !!a.role &&
        roles.includes(a.role) &&
        isChatAvailable(a),
    ) ?? null
  );
}

/**
 * Resolve who the AI (or a no-AI open) should hand the player to.
 */
export function resolveSupportHandoffEmployee(params: {
  userId: string;
  conversation?: ConversationHandoffFacts | null;
  /** Active assignment row for this customer, if any. */
  assignmentEmployeeId?: string | null;
  activeAdmins: HandoffAdmin[];
}): HandoffEmployee | null {
  const { conversation, assignmentEmployeeId, activeAdmins } = params;
  const adminById = new Map(
    activeAdmins.map((a) => [a._id.toString(), a] as const),
  );

  const conversationEmployeeId = conversation?.assignedEmployeeId
    ? conversation.assignedEmployeeId.toString()
    : null;

  // Temporary redirect / chat transfer keeps the cover employee on the ticket.
  const isTemporaryRedirect =
    conversation?.temporarilyRedirected === true ||
    conversation?.isChatTransferred === true;

  if (isTemporaryRedirect && conversationEmployeeId) {
    const cover = adminById.get(conversationEmployeeId);
    if (isChatAvailable(cover)) {
      return toEmployee(cover);
    }
  }

  // Reason: admin Customer Assignment is what operators edit and what the
  // badge shows — escalate to that person, not a stamp left on an old ticket.
  // Presence (isAvailableForChat) must NOT override this: GM "contact us" and
  // ordinary handoffs both promise the assigned employee by name.
  if (assignmentEmployeeId) {
    const assigned = adminById.get(assignmentEmployeeId.toString());
    if (isEligibleAssignee(assigned)) {
      return toEmployee(assigned);
    }

    // Assigned id missing from the admin list or locked out — cover with an
    // account manager first, never jump straight to the seed Full Admin.
    const backup =
      pickFromRoles(activeAdmins, ACCOUNT_MANAGER_ROLES, assignmentEmployeeId) ||
      pickFromRoles(activeAdmins, FALLBACK_SUPPORT_ROLES, assignmentEmployeeId);
    if (backup) {
      return toEmployee(backup);
    }
  }

  // No live customer assignment — honour a stamp already on the conversation.
  if (conversationEmployeeId) {
    const stamped = adminById.get(conversationEmployeeId);
    if (isChatAvailable(stamped)) {
      return toEmployee(stamped);
    }
  }

  // Nobody assigned — first free account manager, then Full Admin last resort.
  const fallback =
    pickFromRoles(activeAdmins, ACCOUNT_MANAGER_ROLES) ||
    pickFromRoles(activeAdmins, FALLBACK_SUPPORT_ROLES);
  return fallback ? toEmployee(fallback) : null;
}

/** Strip platform-owner roles from an auto-assign candidate list. */
export function filterAutoAssignCandidates<T extends { role?: string }>(
  employees: T[],
): T[] {
  return employees.filter(
    (e) => !e.role || !AUTO_ASSIGN_EXCLUDED_ROLES.includes(e.role as never),
  );
}
