"use client";

import { useState } from "react";

interface NumpadProps {
  onAmount: (amount: number) => void;
  disabled?: boolean;
}

export function Numpad({ onAmount, disabled = false }: NumpadProps) {
  const [input, setInput] = useState("");

  function handleNumber(digit: string) {
    if (disabled) return;
    setInput((prev) => prev + digit);
  }

  function handleClear() {
    if (disabled) return;
    setInput("");
  }

  function handleBackspace() {
    if (disabled) return;
    setInput((prev) => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (disabled || !input) return;
    const amount = parseInt(input, 10);
    if (amount > 0) {
      onAmount(amount); // amount is in UGX (100 UGX minimum)
    }
  }

  const displayAmount = input || "0";

  return (
    <div className="space-y-4">
      <div className="bg-[var(--app-bg-secondary)] rounded-lg p-4 text-center">
        <div className="text-sm text-[var(--app-text-muted)] mb-2">Amount</div>
        <div className="text-4xl font-semibold text-[var(--app-text-primary)]">
          UGX {displayAmount}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleNumber(num)}
            disabled={disabled}
            className="numpad-key"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear"
          className="numpad-key numpad-key--small"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => handleNumber("0")}
          disabled={disabled}
          className="numpad-key"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          disabled={disabled}
          aria-label="Backspace"
          className="numpad-key"
        >
          ←
        </button>
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || !input}
        className="btn-primary w-full py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Enter Amount
      </button>
    </div>
  );
}
