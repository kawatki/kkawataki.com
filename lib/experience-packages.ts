// Example add-ons: prices apply once per booking, separately from the experience fee.
export type ExperiencePackage = {
  id: string; name: string; priceJpy: number; minimumHours: number;
  requirement: string; description: string;
  availableFrom?: string; availableUntil?: string; durationMinutes?: number;
}
// Add confirmed fixed-price offerings here when ready.
export const EXPERIENCE_PACKAGES: readonly ExperiencePackage[] = [];

export function customIdeaLimit(hours: number) {
  return hours === 14 ? 3 : hours === 8 ? 2 : 1;
}

export function pricePackages(ids: readonly string[], durationHours: number) {
  if (new Set(ids).size !== ids.length)
    throw new Error("Choose each package only once.");
  return ids.reduce((total, id) => {
    const item = EXPERIENCE_PACKAGES.find((item) => item.id === id);
    if (!item || durationHours < item.minimumHours)
      throw new Error("Choose packages available for your selected duration.");
    return total + item.priceJpy;
  }, 0);
}

export function parsePackageIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((id) => typeof id !== "string")
  ) {
    throw new Error("Choose valid experience packages.");
  }
  if (new Set(value).size !== value.length) throw new Error("Choose each package only once.");
  // Historical payment snapshots retain IDs even after an offering is retired.
  // New checkout selections are validated by pricePackages.
  return value;
}

// All windows are local Japan time. Example rules do not guarantee venue availability.
export function packageUnavailableReason(item: {
  minimumHours: number; availableFrom?: string; availableUntil?: string; durationMinutes?: number
}, hours: number, start: string, end: string): string | null {
  if (hours < item.minimumHours) return `Requires ${item.minimumHours} hours or more. Change your duration.`;
  if (!start || !end) return "Choose your schedule first.";
  if (item.availableFrom && item.availableUntil && item.durationMinutes) {
    const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
    const overlap = Math.min(minutes(end), minutes(item.availableUntil)) - Math.max(minutes(start), minutes(item.availableFrom));
    if (overlap < item.durationMinutes) return `Requires ${item.durationMinutes / 60} hours between ${item.availableFrom} and ${item.availableUntil} JST. Change your start time.`;
  }
  return null;
}

export function validatePackageSchedule(ids: readonly string[], hours: number, start: string, end: string) {
  for (const id of ids) {
    const item = EXPERIENCE_PACKAGES.find(item => item.id === id);
    if (!item) throw new Error("Unknown package.");
    const reason = packageUnavailableReason(item, hours, start, end);
    if (reason) throw new Error(`${item.name}: ${reason}`);
  }
}
