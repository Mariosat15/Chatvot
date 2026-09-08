"use client";

import { ConfigSchemaFields } from "../ConfigSchemaFields";
import { RoundClockNote } from "../RoundClockNote";
import type { ContestDraft } from "../contest-draft";
import type { ContestableTitle } from "../contest-types";
import { Problem } from "./fields";

/**
 * Step three: the game's own options, generated from its `configSchema`.
 *
 * NOTHING HERE KNOWS WHICH GAME IT IS RENDERING. `ConfigSchemaFields` branches on the
 * declared field TYPE, never on a game code, which is what makes a new title data-only.
 *
 * THE CLOCK NOTE IS HERE AS WELL AS ON THE SCHEDULE STEP, and both are needed. An operator
 * setting a round length is asking "what is this number for?"; one setting dates is asking
 * "when can people play?". One shared component answers both so the two screens cannot
 * describe the contest clock differently.
 */
export function StepSettings({
  draft,
  patch,
  title,
}: {
  draft: ContestDraft;
  patch: (changes: Partial<ContestDraft>) => void;
  title: ContestableTitle;
}) {
  return (
    <>
      <RoundClockNote
        variant="settings"
        startTime={draft.startTime}
        endTime={draft.endTime}
        maxDurationSeconds={title.maxDurationSeconds}
        roundStartPolicy={draft.roundStartPolicy}
      />

      {title.schema.ok ? (
        <ConfigSchemaFields
          fields={title.schema.fields}
          values={draft.settings}
          onChange={(name, value) =>
            patch({ settings: { ...draft.settings, [name]: value } })
          }
        />
      ) : (
        <Problem
          title="This game's settings cannot be read"
          lines={[title.schema.error]}
        />
      )}
    </>
  );
}
