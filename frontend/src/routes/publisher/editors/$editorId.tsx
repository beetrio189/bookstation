import { createFileRoute, redirect } from "@tanstack/react-router";
import { getRole } from "@/lib/session";
import { EditorDetail } from "./-editor-detail";

export const Route = createFileRoute("/publisher/editors/$editorId")({
  // Chi tiết chỉ dành cho NXB: biên tập viên mở link thẳng thì về danh sách
  beforeLoad: () => {
    if (getRole() === "editor") {
      throw redirect({ to: "/publisher/editors" });
    }
  },
  head: () => ({ meta: [{ title: "Biên tập viên | BookStation" }] }),
  component: EditorDetail,
});
