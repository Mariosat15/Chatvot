/**
 * Extracts the shape of a Mongoose schema from a source file, using the TypeScript
 * AST rather than regular expressions.
 *
 * Reason: the mirror guard has to compare what the two apps actually agree a document
 * looks like. A regex over `field: {` misses nested paths, array subdocuments and the
 * `type: { ... }` subdocument form, all of which appear in these models. Getting any
 * of those wrong means the guard either misses real drift or blocks commits on
 * imaginary drift, and a guard that cries wolf gets switched off.
 */
import ts from "typescript";

export interface SchemaShape {
  /** Dotted field paths, e.g. `rules.rankingMethod`. */
  fields: Set<string>;
  /** Path -> the allowed values declared in `enum: [...]`. */
  enums: Map<string, Set<string>>;
  /** Paths whose enum is computed at runtime and cannot be compared statically. */
  dynamicEnums: Set<string>;
  /** True when the file contains no `new Schema(...)` call at all. */
  empty: boolean;
}

/** Mongoose keys that describe a field rather than name a subdocument path. */
const OPTION_KEYS = new Set([
  "type",
  "enum",
  "required",
  "default",
  "ref",
  "index",
  "unique",
  "sparse",
  "select",
  "validate",
  "get",
  "set",
  "alias",
  "immutable",
  "transform",
  "of",
]);

export function extractSchemaShape(
  sourceText: string,
  fileName: string,
): SchemaShape {
  const shape: SchemaShape = {
    fields: new Set(),
    enums: new Map(),
    dynamicEnums: new Set(),
    empty: true,
  };

  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  // A file can declare sub-schemas as separate consts alongside the main schema.
  // Every one of them is merged into a single shape. A sub-schema's fields lose their
  // parent prefix, which is imprecise, but the same thing happens on both sides of the
  // comparison, so drift is still detected symmetrically.
  const visit = (node: ts.Node): void => {
    if (ts.isNewExpression(node) && isSchemaConstructor(node.expression)) {
      const definition = resolveDefinition(node.arguments?.[0], source);
      if (definition) {
        shape.empty = false;
        walkDefinition(definition, "", shape);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);

  return shape;
}

function isSchemaConstructor(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) {
    return expression.text === "Schema";
  }
  // `new mongoose.Schema({...})`
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === "Schema";
  }
  return false;
}

/**
 * Returns the object literal describing the fields. Follows one level of indirection
 * when the schema is built from a separately declared const.
 */
function resolveDefinition(
  argument: ts.Expression | undefined,
  source: ts.SourceFile,
): ts.ObjectLiteralExpression | undefined {
  if (!argument) return undefined;
  if (ts.isObjectLiteralExpression(argument)) return argument;

  if (ts.isIdentifier(argument)) {
    const name = argument.text;
    let found: ts.ObjectLiteralExpression | undefined;

    const search = (node: ts.Node): void => {
      if (found) return;
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        found = node.initializer;
        return;
      }
      ts.forEachChild(node, search);
    };

    search(source);
    return found;
  }

  return undefined;
}

/**
 * Classifies a schema value and records it.
 *
 * The rules, in order:
 *  1. `{ type: <object> }` declares a subdocument - descend, dropping the `type` step
 *     from the path, because Mongoose does not treat it as a field name.
 *  2. `{ type: <not an object> }` is a leaf field - record it and its enum.
 *  3. An object of nothing but option keys is also a leaf.
 *  4. Any other object is a nested path - descend into every property.
 *  5. An array shares the shape of its element, so the path does not change.
 *  6. Anything else (`String`, `Schema.Types.ObjectId`) is a leaf.
 */
function walkDefinition(
  node: ts.Expression,
  path: string,
  shape: SchemaShape,
): void {
  if (ts.isObjectLiteralExpression(node)) {
    const typeValue = getPropertyValue(node, "type");

    if (typeValue) {
      if (ts.isObjectLiteralExpression(typeValue)) {
        walkDefinition(typeValue, path, shape);
        return;
      }
      recordLeaf(node, path, shape);
      return;
    }

    const properties = node.properties.filter(ts.isPropertyAssignment);
    if (properties.length === 0) {
      recordField(path, shape);
      return;
    }

    // An object made only of option keys and no `type` is still a field definition,
    // not a path - for example `{ required: true, default: 0 }`.
    const looksLikeOptionsOnly = properties.every((property) =>
      OPTION_KEYS.has(propertyName(property)),
    );
    if (looksLikeOptionsOnly) {
      recordLeaf(node, path, shape);
      return;
    }

    for (const property of properties) {
      const name = propertyName(property);
      if (!name) continue;
      walkDefinition(
        property.initializer,
        path ? `${path}.${name}` : name,
        shape,
      );
    }
    return;
  }

  if (ts.isArrayLiteralExpression(node)) {
    const element = node.elements[0];
    if (!element) {
      recordField(path, shape);
      return;
    }
    walkDefinition(element, path, shape);
    return;
  }

  recordField(path, shape);
}

function recordLeaf(
  node: ts.ObjectLiteralExpression,
  path: string,
  shape: SchemaShape,
): void {
  recordField(path, shape);

  const enumValue = getPropertyValue(node, "enum");
  if (!enumValue) return;

  if (!ts.isArrayLiteralExpression(enumValue)) {
    // e.g. `enum: Object.values(SomeEnum)` - real, but not statically comparable.
    shape.dynamicEnums.add(path);
    return;
  }

  const values = new Set<string>();
  for (const element of enumValue.elements) {
    if (
      ts.isStringLiteral(element) ||
      ts.isNoSubstitutionTemplateLiteral(element)
    ) {
      values.add(element.text);
    } else {
      shape.dynamicEnums.add(path);
    }
  }

  const existing = shape.enums.get(path);
  if (existing) {
    for (const value of values) existing.add(value);
  } else {
    shape.enums.set(path, values);
  }
}

function recordField(path: string, shape: SchemaShape): void {
  if (path) shape.fields.add(path);
}

function getPropertyValue(
  node: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined {
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && propertyName(property) === name) {
      return property.initializer;
    }
  }
  return undefined;
}

function propertyName(property: ts.PropertyAssignment): string {
  const name = property.name;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return "";
}
