import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-page-inner shimmer h-40 rounded-lg" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
