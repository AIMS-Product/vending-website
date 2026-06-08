const unsupportedConstraintKeys = new Set([
  "maxItems",
  "minItems",
  "maxLength",
  "minLength",
  "maximum",
  "minimum",
  "pattern",
]);

export function toCerebrasJsonSchema<T>(schema: T): T {
  return transformSchema(schema) as T;
}

function transformSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformSchema);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const type = source.type;

  if (Array.isArray(type) && type.includes("null")) {
    const nonNullTypes = type.filter((item) => item !== "null");
    if (nonNullTypes.length === 1) {
      const nonNullSchema: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(source)) {
        if (key === "type") continue;
        if (unsupportedConstraintKeys.has(key)) continue;
        nonNullSchema[key] = transformSchema(child);
      }
      nonNullSchema.type = nonNullTypes[0];
      return {
        anyOf: [nonNullSchema, { type: "null" }],
      };
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (unsupportedConstraintKeys.has(key)) continue;
    result[key] = transformSchema(child);
  }
  return result;
}
