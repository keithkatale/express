import { PageStack } from "@/components/layout/page-container";
import { WithdrawalFlow } from "@/components/cards/withdrawal-flow";
import { AccountantHomeHeader } from "../accountant-home-header";

export default function PaymentsPage() {
  return (
    <PageStack>
      <AccountantHomeHeader />
      <WithdrawalFlow />
    </PageStack>
  );
}
