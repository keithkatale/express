"use client";

import {
  SENIOR_LEVELS,
  formatClassName,
  seniorLevelLabel,
  streamsForLevel,
  type SeniorLevel,
} from "@/lib/school-classes";

export function ClassStreamPicker({
  level,
  stream,
  onLevelChange,
  onStreamChange,
}: {
  level: SeniorLevel | null;
  stream: string | null;
  onLevelChange: (level: SeniorLevel) => void;
  onStreamChange: (stream: string) => void;
}) {
  const streams = level ? streamsForLevel(level) : [];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Senior class</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SENIOR_LEVELS.map((value) => {
            const active = level === value;
            return (
              <button
                key={value}
                type="button"
                className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[var(--lumina-primary)] bg-[var(--bc-layer2)]"
                    : "border-[var(--app-divider)] bg-[var(--home-card-bg)]"
                }`}
                onClick={() => onLevelChange(value)}
              >
                {seniorLevelLabel(value)}
              </button>
            );
          })}
        </div>
      </div>

      {level ? (
        <div>
          <p className="mb-2 text-sm font-medium">
            {level <= 4 ? "Stream" : "Combination"}
          </p>
          <div className={`grid gap-2 ${streams.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
            {streams.map((value) => {
              const active = stream === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-[var(--lumina-primary)] bg-[var(--bc-layer2)]"
                      : "border-[var(--app-divider)] bg-[var(--home-card-bg)]"
                  }`}
                  onClick={() => onStreamChange(value)}
                >
                  {value}
                </button>
              );
            })}
          </div>
          {level && stream ? (
            <p className="mt-3 text-sm text-[var(--app-text-secondary)]">
              Class: <span className="font-medium">{formatClassName(level, stream)}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--app-text-muted)]">Select a senior class first.</p>
      )}
    </div>
  );
}
