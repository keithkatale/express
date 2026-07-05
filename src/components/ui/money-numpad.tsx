"use client";

import { formatUgx, parseUgxInput } from "@/lib/format-money";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"] as const;

function MoneyNumpad({
  value,
  onChange,
  maxDigits = 10,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  maxDigits?: number;
  compact?: boolean;
}) {
  function handleKey(key: (typeof KEYS)[number]) {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }

    const next = value + key;
    const digits = next.replace(/[^\d]/g, "");
    if (digits.length > maxDigits) return;
    onChange(digits);
  }

  return (
    <div
      className={cn("money-numpad", compact && "money-numpad--compact")}
      role="group"
      aria-label="Amount keypad"
    >
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={cn("money-numpad-key", key === "back" && "money-numpad-key--muted")}
          onClick={() => handleKey(key)}
        >
          {key === "back" ? "⌫" : key}
        </button>
      ))}
    </div>
  );
}

export function MoneyAmountField({
  value,
  onChange,
  label,
  placeholder = "0",
  required,
  id,
  numpadOnly = false,
  compactNumpad = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  /** Always use on-screen numpad (e.g. bursar withdrawal). */
  numpadOnly?: boolean;
  /** Tighter numpad grid for compact desktop panels. */
  compactNumpad?: boolean;
}) {
  const fieldId = id ?? "money-amount";
  const amount = parseUgxInput(value);
  const display = amount ? formatUgx(amount) : placeholder;

  const numpadBlock = (
    <>
      <div className="money-numpad-display" aria-live="polite" aria-atomic="true">
        {display}
      </div>
      <MoneyNumpad
        value={value}
        onChange={onChange}
        compact={compactNumpad || numpadOnly}
      />
      <input
        type="hidden"
        name={fieldId}
        value={value}
        required={required}
        tabIndex={-1}
        aria-hidden
      />
    </>
  );

  if (numpadOnly) {
    return (
      <div>
        <p className="mb-2 block text-sm font-medium">{label}</p>
        {numpadBlock}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <input
        id={fieldId}
        className="input-ios hidden md:block"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        required={required}
      />

      <div className="md:hidden">{numpadBlock}</div>
    </div>
  );
}
