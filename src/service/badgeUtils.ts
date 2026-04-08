/**
 * Generates unique 2-letter badges for staff members based on their names.
 * Used in the weekly roster grid view for compact display.
 *
 * Algorithm:
 * 1. Two-part name: first char of first name + first char of last name
 * 2. Single name: first two characters
 * 3. On collision: extend first-name portion (2 chars first + 1 char last)
 * 4. On continued collision: append numeric suffix
 */
export function generateBadges(
  users: { id: string; name: string }[]
): Map<string, string> {
  const result = new Map<string, string>();
  if (users.length === 0) return result;

  // Step 1: Generate initial badges
  const entries = users.map((user) => ({
    id: user.id,
    name: user.name.trim(),
    badge: initialBadge(user.name.trim()),
  }));

  // Step 2: Resolve collisions
  const badgeGroups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = badgeGroups.get(entry.badge) || [];
    group.push(entry);
    badgeGroups.set(entry.badge, group);
  }

  for (const [badge, group] of badgeGroups) {
    if (group.length === 1) {
      result.set(group[0].id, badge);
      continue;
    }

    // Try extending first-name portion
    const extended = group.map((entry) => ({
      ...entry,
      badge: extendedBadge(entry.name),
    }));

    const extGroups = new Map<string, typeof extended>();
    for (const entry of extended) {
      const g = extGroups.get(entry.badge) || [];
      g.push(entry);
      extGroups.set(entry.badge, g);
    }

    for (const [extBadge, extGroup] of extGroups) {
      if (extGroup.length === 1) {
        result.set(extGroup[0].id, extBadge);
      } else {
        // Numeric suffix fallback
        extGroup.forEach((entry, i) => {
          result.set(entry.id, `${extBadge}${i + 1}`);
        });
      }
    }
  }

  return result;
}

function splitName(name: string): string[] {
  return name.split(/\s+/).filter(Boolean);
}

function initialBadge(name: string): string {
  const parts = splitName(name);
  if (parts.length === 0) return "??";
  if (parts.length === 1) {
    return parts[0].length >= 2 ? parts[0].slice(0, 2) : parts[0];
  }
  return parts[0][0] + parts[parts.length - 1][0];
}

function extendedBadge(name: string): string {
  const parts = splitName(name);
  if (parts.length === 0) return "??";
  if (parts.length === 1) {
    return parts[0].slice(0, 3) || parts[0];
  }
  const firstPart = parts[0].slice(0, 2);
  const lastPart = parts[parts.length - 1][0];
  return firstPart + lastPart;
}
