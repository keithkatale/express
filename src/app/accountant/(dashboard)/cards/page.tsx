import { PageStack } from "@/components/layout/page-container";
import { CardTestPanel } from "@/components/cards/card-test-panel";
import { AccountantHomeHeader } from "../accountant-home-header";

export default function CardsPage() {
  return (
    <PageStack>
      <AccountantHomeHeader />
      <div>
        <h1 className="page-title">Card Management</h1>
        <p className="page-subtitle mt-1">Check card assignments and assign cards to students</p>
      </div>
      <CardTestPanel />
    </PageStack>
  );
}
