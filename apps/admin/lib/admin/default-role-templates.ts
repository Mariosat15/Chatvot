/**
 * Keeps the ready-made role templates in step with the code.
 *
 * The templates used to be inserted once, when the collection was empty, and never again.
 * Every section added to ADMIN_SECTIONS afterwards (games, tutorials, the newer dev tools...)
 * therefore never reached a stored template, and a template added to DEFAULT_ROLE_TEMPLATES
 * later was never created at all, so the "ready-made" choices described an older admin panel.
 *
 * This sync runs on every read of the templates and is idempotent:
 *  - a default template missing by name is created;
 *  - a section the code now gives a template is added to it, and to every employee on it,
 *    because editing a template already copies its sections to its employees (role-templates
 *    PUT) and an employee on "Full Admin" should not lag the template they are on;
 *  - a section a super admin removed is NOT put back, because `seededSections` records every
 *    section the template has already been offered. Only never-offered sections are added.
 *  - an operator's own template that happens to share a default's name is left alone.
 *
 * Add-only: nothing is ever removed from a template or an employee here.
 */
// Reason: relative, not `@/`, because vitest maps `@` to the repository root, where the
// role-template model does not exist (it is admin-only); `next build` resolves both alike.
import { Admin } from "../../database/models/admin.model";
import {
  AdminRoleTemplate,
  DEFAULT_ROLE_TEMPLATES,
} from "../../database/models/admin-role-template.model";

export interface RoleTemplateSyncResult {
  created: string[];
  sectionsAdded: Record<string, string[]>;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

export async function syncDefaultRoleTemplates(): Promise<RoleTemplateSyncResult> {
  const result: RoleTemplateSyncResult = { created: [], sectionsAdded: {} };

  for (const def of DEFAULT_ROLE_TEMPLATES) {
    const existing = await AdminRoleTemplate.findOne({ name: def.name })
      .select("_id isDefault allowedSections seededSections")
      .lean<{
        _id: unknown;
        isDefault?: boolean;
        allowedSections?: string[];
        seededSections?: string[];
      }>();

    if (!existing) {
      try {
        await AdminRoleTemplate.create({
          ...def,
          seededSections: [...def.allowedSections],
        });
        result.created.push(def.name);
      } catch (error) {
        // Reason: two admins opening the screen at once both see it missing; the unique
        // name index lets exactly one create it, and the other has nothing left to do.
        if (!isDuplicateKeyError(error)) throw error;
      }
      continue;
    }

    if (!existing.isDefault) continue;

    const seeded = new Set(existing.seededSections ?? []);
    const allowed = new Set(existing.allowedSections ?? []);
    const unseeded = def.allowedSections.filter((s) => !seeded.has(s));
    if (unseeded.length === 0) continue;

    const toAdd = unseeded.filter((s) => !allowed.has(s));
    await AdminRoleTemplate.updateOne(
      { _id: existing._id },
      {
        $addToSet: {
          allowedSections: { $each: toAdd },
          seededSections: { $each: unseeded },
        },
      },
    );

    if (toAdd.length > 0) {
      await Admin.updateMany(
        { roleTemplateId: existing._id },
        { $addToSet: { allowedSections: { $each: toAdd } } },
      );
      result.sectionsAdded[def.name] = toAdd;
    }
  }

  return result;
}
