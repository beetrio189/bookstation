import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { searchString } from "@/lib/search";
import { ResetPasswordForm } from "./-reset-password-form";

// Link trong email: ?uid=...&token=...
export const Route = createFileRoute("/reset-password/")({
  validateSearch: (search: Record<string, unknown>) => ({
    uid: searchString(search.uid),
    token: searchString(search.token),
  }),
  head: () => ({ meta: [{ title: "Tạo mật khẩu mới | BookStation" }] }),
  component: Page,
});

function Page() {
  const { uid, token } = Route.useSearch();

  return (
    <AuthLayout>
      <ResetPasswordForm uid={uid} token={token} />
    </AuthLayout>
  );
}
