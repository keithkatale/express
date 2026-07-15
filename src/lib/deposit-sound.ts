const STORAGE_KEY = "be_deposit_sound_muted";
const SOUND_SRC = "/sounds/cha-ching.wav";

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 0.7;
  }
  return audio;
}

export function isDepositSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setDepositSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
}

/** Browsers block autoplay until a user gesture; call once after any click/tap. */
export function unlockDepositSound(): void {
  if (typeof window === "undefined" || unlocked) return;
  const el = getAudio();
  el.muted = true;
  void el
    .play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      unlocked = true;
    })
    .catch(() => {
      // Still locked; will retry on next gesture.
    });
}

export function playDepositChaChing(options?: { force?: boolean }): void {
  if (typeof window === "undefined") return;
  if (!options?.force && isDepositSoundMuted()) return;

  const el = getAudio();
  el.currentTime = 0;
  void el.play().catch(() => {
    unlocked = false;
  });
}
