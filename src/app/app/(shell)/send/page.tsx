import { Suspense } from "react";
import SendMoneyForm from "./send-form";

export default function SendMoneyPage() {
  return (
    <Suspense fallback={<div className="shimmer card h-40 rounded-lg" />}>
      <SendMoneyForm />
    </Suspense>
  );
}
