/** Return a trimmed name of at most 100 characters, or null when invalid. */
export function normalizeDialogName(value) {
  const name = value.trim();
  return name && name.length <= 100 ? name : null;
}
