import { cn } from "@/lib/utils";

export function AuthPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("auth-page", className)}>
      <div className="auth-page-inner">{children}</div>
    </div>
  );
}

export function PageStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("page-stack", className)}>{children}</div>;
}
