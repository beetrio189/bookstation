import { createFileRoute } from "@tanstack/react-router";
import { EditorsList } from "./-editors-list";

export const Route = createFileRoute("/publisher/editors/")({
  head: () => ({ meta: [{ title: "Biên tập viên | BookStation" }] }),
  component: EditorsList,
});
