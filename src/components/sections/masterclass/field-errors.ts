/**
 * The errors still worth showing: a field the visitor has edited since the
 * last submit drops its error (and its aria-invalid) until the next submit
 * says otherwise. The form-level error stays.
 */
export function liveErrors<K extends string>(
  errors: Partial<Record<K, string>>,
  edited: ReadonlySet<string>,
): Partial<Record<K, string>> {
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => !edited.has(field)),
  ) as Partial<Record<K, string>>;
}
