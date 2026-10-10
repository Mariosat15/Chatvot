/**
 * Fills `{{name}}`-style variables and one `{{#sections}}...{{/sections}}` block in an
 * employee email template.
 */

const HTML_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
]);

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES.get(ch) ?? ch);
}

export function replaceTemplateVariables(
  text: string,
  variables: Record<string, unknown>,
  options: { html?: boolean } = {},
): string {
  // Reason: the generated password alphabet contains `&`, and an HTML body renders
  // `&lt`, `&not`, `&para`... as other characters even without a semicolon, so an
  // unescaped password could be emailed as something other than what was stored.
  const encode = options.html ? escapeHtml : (value: string) => value;
  let result = text;

  // Reason: a literal split/join, never `replace` with a string - `replace`
  // reads `$&` and `$$` in the replacement as patterns, and the generated
  // password alphabet contains both `$` and `&`, so the emailed password
  // could differ from the stored one.
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{{${key}}}`).join(encode(String(value || "")));
  }

  if (variables.sections && Array.isArray(variables.sections)) {
    const sectionsMatch = result.match(
      /\{\{#sections\}\}([\s\S]*?)\{\{\/sections\}\}/,
    );
    if (sectionsMatch) {
      const itemTemplate = sectionsMatch[1];
      const sectionsList = variables.sections
        .map((s: unknown) => itemTemplate.split("{{.}}").join(encode(String(s))))
        .join("");
      result = result.split(sectionsMatch[0]).join(sectionsList);
    }
  }

  return result;
}
