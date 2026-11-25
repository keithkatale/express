let ctx: AudioContext | null = null;

/** Two short falling low tones — the "declined" beep. Synthesised, so no audio file is needed. */
export function playDeclineBeep(): void {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    [
      { at: 0, freq: 330 },
      { at: 0.22, freq: 220 },
    ].forEach(({ at, freq }) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(0.25, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.2);
    });
  } catch {
    // Audio unavailable or blocked; the red card is still shown.
  }
}
