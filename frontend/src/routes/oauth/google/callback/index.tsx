import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { searchString } from "@/lib/search";
import { GoogleCallback } from "./-google-callback";

// Backend xử lý xong với Google thì chuyển về đây, lỗi thì kèm ?error=<mã lỗi>
export const Route = createFileRoute("/oauth/google/callback/")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: searchString(search.error),
  }),
  head: () => ({ meta: [{ title: "Đăng nhập bằng Google | BookStation" }] }),
  component: Page,
});

function Page() {
  const { error } = Route.useSearch();

  return (
    <AuthLayout>
      <GoogleCallback errorCode={error} />
    </AuthLayout>
  );
}
