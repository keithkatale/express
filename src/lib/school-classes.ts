export const LOWER_STREAMS = ["North", "East", "West", "South"] as const;
export const UPPER_STREAMS = ["Sciences", "Arts"] as const;

export const SENIOR_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export type LowerStream = (typeof LOWER_STREAMS)[number];
export type UpperStream = (typeof UPPER_STREAMS)[number];
export type SeniorLevel = (typeof SENIOR_LEVELS)[number];

const CLASS_PATTERN = /^S\.([1-6]) (North|East|West|South|Sciences|Arts)$/;

export function streamsForLevel(level: SeniorLevel): readonly string[] {
  return level <= 4 ? LOWER_STREAMS : UPPER_STREAMS;
}

export function formatClassName(level: SeniorLevel, stream: string): string {
  return `S.${level} ${stream}`;
}

export function isValidClassSelection(
  level: number | null,
  stream: string | null
): level is SeniorLevel {
  if (level === null || stream === null) return false;
  if (!SENIOR_LEVELS.includes(level as SeniorLevel)) return false;
  return streamsForLevel(level as SeniorLevel).includes(stream);
}

export function classNameFromSelection(level: number | null, stream: string | null): string | null {
  if (!isValidClassSelection(level, stream)) return null;
  return formatClassName(level, stream as string);
}

export function isValidClassName(className: string): boolean {
  const match = className.trim().match(CLASS_PATTERN);
  if (!match) return false;

  const level = Number.parseInt(match[1], 10) as SeniorLevel;
  const stream = match[2];

  return streamsForLevel(level).includes(stream);
}

export function parseClassName(className: string): { level: SeniorLevel; stream: string } | null {
  const match = className.trim().match(CLASS_PATTERN);
  if (!match) return null;

  const level = Number.parseInt(match[1], 10) as SeniorLevel;
  const stream = match[2];

  if (!streamsForLevel(level).includes(stream)) return null;

  return { level, stream };
}

export function seniorLevelLabel(level: SeniorLevel): string {
  return `Senior ${level}`;
}
