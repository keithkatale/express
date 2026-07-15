"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/** Figma Wireframe hero base gradient (Benchmark). */
export const HERO_GRADIENT_STYLE = {
  backgroundImage:
    "linear-gradient(120.58deg, rgb(32, 16, 88) 12.286%, rgb(59, 31, 160) 87.693%)",
} as const;

export const HERO_GRADIENT_CIRCLES_SRC = "/branding/gradient-circles.svg";

type HeroGradientBackgroundProps = {
  className?: string;
  flipVertical?: boolean;
};

/**
 * Marketing hero background — deep violet base + gradient circles layer.
 */
export function HeroGradientBackground({
  className,
  flipVertical = false,
}: HeroGradientBackgroundProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0" style={HERO_GRADIENT_STYLE} />

      <div
        className={cn(
          "absolute left-[-11%] top-[31%] h-[81%] w-[140%]",
          "max-md:left-[-22%] max-md:top-[38%] max-md:h-[72%] max-md:w-[155%]",
          flipVertical && "origin-center scale-y-[-1]"
        )}
      >
        <Image
          src={HERO_GRADIENT_CIRCLES_SRC}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="140vw"
        />
      </div>
    </div>
  );
}
