import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { searchString } from "@/lib/search";
import { VerifyEmailStatus } from "./-verify-email-status";

// Link trong email: ?uid=...&token=...
export const Route = createFileRoute("/verify-email/")({
  validateSearch: (search: Record<string, unknown>) => ({
    uid: searchString(search.uid),
    token: searchString(search.token),
  }),
  head: () => ({ meta: [{ title: "Xác thực email | BookStation" }] }),
  component: Page,
});

function Page() {
  const { uid, token } = Route.useSearch();

  return (
    <AuthLayout>
      <VerifyEmailStatus uid={uid} token={token} />
    </AuthLayout>
  );
}
