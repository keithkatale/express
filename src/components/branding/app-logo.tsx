import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/branding/benchmark-logo.png";

export function AppLogo({
  size = 48,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Benchmark Express"
      width={size}
      height={size}
      priority={priority}
      className={cn("rounded-xl", className)}
    />
  );
}
