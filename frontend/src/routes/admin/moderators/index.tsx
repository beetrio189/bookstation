import { createFileRoute } from "@tanstack/react-router";
import { ModeratorsList } from "./-moderators-list";

export const Route = createFileRoute("/admin/moderators/")({
  head: () => ({ meta: [{ title: "Kiểm duyệt viên | BookStation" }] }),
  component: ModeratorsList,
});
