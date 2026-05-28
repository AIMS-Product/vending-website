export type StructuredDataSettings = {
  breadcrumb: boolean;
  faq: boolean;
};

export const defaultStructuredDataSettings: StructuredDataSettings = {
  breadcrumb: true,
  faq: true,
};

export function parseStructuredDataSettings(
  value: unknown,
): StructuredDataSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStructuredDataSettings;
  }

  const settings = value as Record<string, unknown>;
  return {
    breadcrumb:
      typeof settings.breadcrumb === "boolean"
        ? settings.breadcrumb
        : defaultStructuredDataSettings.breadcrumb,
    faq:
      typeof settings.faq === "boolean"
        ? settings.faq
        : defaultStructuredDataSettings.faq,
  };
}
