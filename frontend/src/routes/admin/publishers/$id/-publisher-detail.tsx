import { ArrowLeft, KeyRound, LockKeyhole, LockKeyholeOpen, Trash2 } from "lucide-react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordBadge, StatusBadge } from "@/components/admin/account-badges";
import { InfoRow } from "@/components/admin/info-row";
import { NoteConfirmDialog } from "@/components/admin/note-confirm-dialog";
import { Avatar } from "@/components/avatar";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/moderators";
import { TIER_LABELS, type PublisherDetail as Detail } from "@/lib/publishers";
import { getRole } from "@/lib/session";

const route = getRouteApi("/admin/publishers/$id/");
const NOT_FOUND_STATUS = 404;

type Action = "reset" | "lock" | "unlock" | "delete";

export const BACK_LINK_CLASS =
  "mt-5 flex w-fit items-center gap-2 text-lg font-bold hover:underline";

// "Nhà xuất bản và 4 biên tập viên" / "Nhà xuất bản" khi chưa có biên tập viên
const accountsPhrase = (editorCount: number) =>
  editorCount > 0
    ? `Nhà xuất bản và ${editorCount} biên tập viên`
    : "Nhà xuất bản";

/**
 * Theo Figma "NXB / Chi tiết (đang hoạt động | bị đình chỉ, KDV xem | admin xem)"
 * và các hộp thoại xác nhận. Nút Xóa chỉ admin thấy.
 */
export function PublisherDetail() {
  const { id } = route.useParams();
  const navigate = route.useNavigate();
  const isAdmin = getRole() === "admin";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(() => {
    api<Detail>(`/admin/publishers/${id}`, { auth: true })
      .then((data) => {
        setDetail(data);
        setIsNotFound(false);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) {
          setIsNotFound(true);
        }
      });
  }, [id]);

  useEffect(load, [load]);

  const toList = () => void navigate({ to: "/admin/publishers" });

  // Đã bị xóa (bởi người khác) trong lúc đang xem
  const handleGone = () => {
    toast.error("Nhà xuất bản này không còn tồn tại");
    toList();
  };

  const back = (
    <Link to="/admin/publishers" className={BACK_LINK_CLASS}>
      <ArrowLeft className="size-5.5" />
      Quay lại
    </Link>
  );

  if (isNotFound) {
    return (
      <>
        {back}
        <p className="mt-6 rounded-[20px] bg-white px-5 py-6 text-xl font-semibold sm:px-12 sm:py-11">
          Không tìm thấy nhà xuất bản này.
        </p>
      </>
    );
  }

  if (!detail) {
    return back;
  }

  const isLocked = detail.status === "locked";
  const accounts = accountsPhrase(detail.editorCount);
  const dialogProps = (kind: Action) => ({
    open: action === kind,
    onOpenChange: (open: boolean) => setAction(open ? kind : null),
    onGone: handleGone,
  });
  const post = (path: string) => (note: string) =>
    api(`/admin/publishers/${id}/${path}`, {
      method: "POST",
      auth: true,
      silent: true,
      body: { note },
    });

  return (
    <>
      {back}

      <section className="mt-6 flex flex-col gap-6 rounded-[20px] bg-white px-5 py-6 sm:gap-8 sm:px-12 sm:py-11">
        {isLocked && (
          <p className="rounded-xl bg-[#ff6d6d]/10 px-4.5 py-3.5 text-base/[1.4] font-semibold text-[#ff6d6d]">
            Nhà xuất bản đang bị đình chỉ: tài khoản
            {detail.editorCount > 0 &&
              ` và ${detail.editorCount} biên tập viên`}{" "}
            đều bị khóa, khảo sát tạm ẩn với độc giả. Sách vẫn hiển thị với độc
            giả.
          </p>
        )}

        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
          <Avatar src={detail.logoUrl} size={120} />
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-[28px] font-bold break-words sm:text-[32px]">
              {detail.publisherName}
            </h1>
            <p className="text-xl font-medium break-all text-foreground/75">
              {detail.email}
            </p>
            <StatusBadge status={detail.status} />
          </div>
        </div>

        <hr className="border-foreground/10" />

        <dl className="flex flex-col gap-4.5 text-lg">
          <InfoRow label="Mật khẩu">
            <PasswordBadge hasPassword={detail.hasPassword} />
          </InfoRow>
          <InfoRow label="Gói dịch vụ">
            {TIER_LABELS[detail.subscriptionTier ?? "none"]}
          </InfoRow>
          <InfoRow label="Số sách">{detail.bookCount}</InfoRow>
          <InfoRow label="Biên tập viên">
            <span className="flex items-center gap-4">
              {detail.editorCount}
              <Link
                to="/admin/publishers/$id/editors"
                params={{ id }}
                className="font-bold text-primary hover:underline"
              >
                Xem danh sách ›
              </Link>
            </span>
          </InfoRow>
          <InfoRow label="Ngày tạo">{formatDateTime(detail.createdAt)}</InfoRow>
          <InfoRow label="Cập nhật">{formatDateTime(detail.updatedAt)}</InfoRow>
          <InfoRow label="Giới thiệu">
            {detail.description ?? (
              <span className="text-foreground/45">Chưa có giới thiệu</span>
            )}
          </InfoRow>
        </dl>

        <div className="flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
          {isLocked ? (
            <Button
              className={actionButton("primary")}
              onClick={() => setAction("unlock")}
            >
              <LockKeyholeOpen />
              Mở khóa
            </Button>
          ) : (
            <>
              <Button
                className={actionButton("primary")}
                onClick={() => setAction("reset")}
              >
                <KeyRound />
                Đặt lại mật khẩu
              </Button>
              <Button
                className={actionButton("danger")}
                onClick={() => setAction("lock")}
              >
                <LockKeyhole />
                Đình chỉ
              </Button>
            </>
          )}
          {isAdmin && (
            <Button
              className={actionButton("dangerOutline")}
              onClick={() => setAction("delete")}
            >
              <Trash2 />
              Xóa nhà xuất bản
            </Button>
          )}
        </div>
      </section>

      <NoteConfirmDialog
        {...dialogProps("reset")}
        title="Đặt lại mật khẩu?"
        description={`Mật khẩu hiện tại sẽ hết hiệu lực ngay và nhà xuất bản bị đăng xuất khỏi mọi thiết bị. Mật khẩu mới sẽ được gửi tới ${detail.email}, lý do bên dưới được ghi ở cuối email. Mỗi nhà xuất bản chỉ được đặt lại tối đa 3 lần mỗi ngày.`}
        placeholder="VD: Nhà xuất bản báo không nhận được email đăng nhập"
        confirmLabel="Đặt lại"
        submit={post("reset-password")}
        onDone={() => {
          toast.success(`Đã gửi mật khẩu mới tới ${detail.email}`);
          load();
        }}
      />
      <NoteConfirmDialog
        {...dialogProps("lock")}
        title={`Đình chỉ ${detail.publisherName}?`}
        description={`${accounts} sẽ bị khóa và đăng xuất ngay. Sách vẫn hiển thị với độc giả, khảo sát của nhà xuất bản tạm ẩn với độc giả. Nhà xuất bản sẽ nhận email kèm lý do bên dưới.`}
        placeholder="VD: Tài khoản nhà xuất bản bị chiếm, có biên tập viên lạ"
        confirmLabel="Đình chỉ"
        kind="danger"
        submit={post("lock")}
        onDone={() => {
          toast.success(`Đã đình chỉ ${detail.publisherName}`);
          load();
        }}
      />
      <NoteConfirmDialog
        {...dialogProps("unlock")}
        title={`Mở khóa ${detail.publisherName}?`}
        description={`${accounts} sẽ đăng nhập lại được. Khảo sát của nhà xuất bản hiện lại với độc giả. Nhà xuất bản sẽ nhận email kèm lý do bên dưới.`}
        placeholder="VD: Đã xác minh lại với nhà xuất bản qua điện thoại"
        confirmLabel="Mở khóa"
        submit={post("unlock")}
        onDone={() => {
          toast.success(`Đã mở khóa ${detail.publisherName}`);
          load();
        }}
      />
      {isAdmin && (
        <NoteConfirmDialog
          {...dialogProps("delete")}
          title={`Xóa vĩnh viễn ${detail.publisherName}?`}
          description={`Toàn bộ dữ liệu sẽ bị xóa và không thể khôi phục: tài khoản nhà xuất bản, ${detail.editorCount} biên tập viên, ${detail.bookCount} cuốn sách cùng đánh giá của độc giả, các khảo sát và câu trả lời. Nếu chỉ muốn tạm dừng, hãy dùng Đình chỉ.`}
          placeholder="VD: Nhà xuất bản gửi yêu cầu ngừng hoạt động ngày 17/11"
          confirmLabel="Xóa vĩnh viễn"
          kind="danger"
          submit={(note) =>
            api(`/admin/publishers/${id}`, {
              method: "DELETE",
              auth: true,
              silent: true,
              body: { note },
            })
          }
          onDone={() => {
            toast.success(`Đã xóa ${detail.publisherName}`);
            toList();
          }}
        />
      )}
    </>
  );
}
