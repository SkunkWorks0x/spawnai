// Slug generation utilities
// TODO: Generate URL-safe slugs from agent names
// TODO: Handle collisions by appending random suffix
// TODO: Validate slug format and length

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
