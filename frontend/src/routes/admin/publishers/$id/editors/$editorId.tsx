import { createFileRoute } from "@tanstack/react-router";
import { EditorDetail } from "./-editor-detail";

export const Route = createFileRoute("/admin/publishers/$id/editors/$editorId")({
  head: () => ({ meta: [{ title: "Biên tập viên | BookStation" }] }),
  component: EditorDetail,
});
