import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { actionButton } from "@/components/app-dialog";
import { BoxedInput } from "@/components/boxed-input";
import { BoxedTextarea } from "@/components/boxed-textarea";
import { GenrePicker } from "@/components/publisher/genre-picker";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import {
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_ERROR_CODES,
  BOOK_TITLE_MAX_LENGTH,
  CONTRIBUTOR_NAME_MAX_LENGTH,
  CONTRIBUTORS_MAX,
  NOTE_MAX_LENGTH,
  type Contributor,
  type PublisherBookDetail,
} from "@/lib/books";
import { normalizeGenreName as normalizeText } from "@/lib/genres";
import { formatNumber } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { CoverField } from "./-cover-field";
import { DeleteBookDialog } from "./-delete-book-dialog";
import { RoleSelect } from "./-role-select";

const NOT_FOUND_STATUS = 404;

interface ContributorRow extends Contributor {
  key: number;
}

// key ổn định cho từng dòng người đóng góp (thêm / bỏ dòng giữa danh sách)
let nextRowKey = 0;
const newRow = (contributor: Contributor): ContributorRow => ({
  key: nextRowKey++,
  ...contributor,
});

interface Errors {
  title?: string;
  contributors?: string;
  names?: Record<number, string>;
  genres?: string;
  year?: string;
  cover?: string;
  form?: string;
}

// Giá trị form đã chuẩn hóa, dạng gửi lên BE
interface Values {
  title: string;
  description: string | null;
  contributors: Contributor[];
  publishedYear: number | null;
  genreIds: string[];
  coverPublicId: string | null;
}

const valuesOf = (book: PublisherBookDetail): Values => ({
  title: book.title,
  description: book.description ?? null,
  contributors: book.contributors.map(({ name, role }) => ({ name, role })),
  publishedYear: book.publishedYear ?? null,
  genreIds: book.genres.map((genre) => genre.id),
  coverPublicId: book.coverPublicId ?? null,
});

// Form có khác sách đang sửa không; thể loại so như tập hợp (đổi thứ tự không tính)
const isSameBook = (before: Values, after: Values) =>
  after.title === before.title &&
  after.description === before.description &&
  JSON.stringify(after.contributors) === JSON.stringify(before.contributors) &&
  after.publishedYear === before.publishedYear &&
  after.coverPublicId === before.coverPublicId &&
  after.genreIds.length === before.genreIds.length &&
  after.genreIds.every((id) => before.genreIds.includes(id));

/**
 * Figma "NXB / Sách / Thêm" và "Sửa" (+ các trạng thái lỗi / đang xử lý ảnh / chọn thể loại).
 * Không có `book` là thêm sách (POST); có là sửa (PUT gửi đủ cả sách, không đổi gì thì khóa nút Lưu).
 */
export function BookForm({ book }: { book?: PublisherBookDetail }) {
  const id = useId();
  const navigate = useNavigate();

  const [title, setTitle] = useState(book?.title ?? "");
  const [contributors, setContributors] = useState<ContributorRow[]>(() =>
    book
      ? book.contributors.map(newRow)
      : [newRow({ name: "", role: "author" })],
  );
  const [genreIds, setGenreIds] = useState(
    () => book?.genres.map((genre) => genre.id) ?? [],
  );
  const [year, setYear] = useState(book?.publishedYear?.toString() ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [note, setNote] = useState("");
  const [cover, setCover] = useState(book?.coverPublicId ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const clearError = (field: keyof Errors) =>
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));

  const values: Values = {
    title: normalizeText(title),
    description: description.trim() || null,
    contributors: contributors.map(({ name, role }) => ({
      name: normalizeText(name),
      role,
    })),
    publishedYear: year.trim() === "" ? null : Number(year.trim()),
    genreIds,
    coverPublicId: cover,
  };
  const isUnchanged = book !== undefined && isSameBook(valuesOf(book), values);

  const validate = (): Errors => {
    const found: Errors = {};
    const names: Record<number, string> = {};
    const currentYear = new Date().getFullYear();
    const yearText = year.trim();

    if (!values.title) found.title = "Tên sách không được để trống";
    contributors.forEach((row, i) => {
      if (!values.contributors[i].name) {
        names[row.key] = "Họ tên không được để trống";
      }
    });
    if (Object.keys(names).length > 0) found.names = names;
    if (!contributors.some((row) => row.role === "author")) {
      found.contributors = "Cần ít nhất một tác giả";
    }
    if (genreIds.length === 0) found.genres = "Chọn ít nhất một thể loại";
    if (yearText && (!/^\d{1,4}$/.test(yearText) || Number(yearText) < 1)) {
      found.year = "Năm xuất bản không hợp lệ";
    } else if (yearText && Number(yearText) > currentYear) {
      found.year = "Năm xuất bản không được lớn hơn năm hiện tại";
    }

    return found;
  };

  const goToList = () => void navigate({ to: "/publisher/books" });

  const handleGone = () => {
    toast.error("Sách này không còn tồn tại");
    goToList();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();

    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      return;
    }

    const trimmedNote = note.trim();
    setIsPending(true);

    // Thêm và sửa cùng một body; trường tùy chọn bỏ trống thì không gửi
    const body = {
      title: values.title,
      contributors: values.contributors,
      genreIds,
      ...(values.description && { description: values.description }),
      ...(values.publishedYear !== null && {
        publishedYear: values.publishedYear,
      }),
      ...(cover && { coverPublicId: cover }),
      ...(trimmedNote && { note: trimmedNote }),
    };

    try {
      if (book) {
        await api(`/publisher/books/${book.id}`, {
          method: "PUT",
          auth: true,
          body,
        });
        toast.success(`Đã lưu sách "${values.title}"`);
      } else {
        await api("/publisher/books", { method: "POST", auth: true, body });
        toast.success(`Đã thêm sách "${values.title}"`);
      }
      goToList();
    } catch (cause) {
      if (!(cause instanceof ApiError)) {
        throw cause;
      }
      // Lỗi hệ thống: api() đã hiện toast
      if (isSystemError(cause.status)) {
        return;
      }
      if (book && cause.status === NOT_FOUND_STATUS) {
        handleGone();
      } else if (cause.code === BOOK_ERROR_CODES.GENRE_NOT_FOUND) {
        setErrors({ genres: cause.message });
      } else if (cause.code === BOOK_ERROR_CODES.INVALID_COVER) {
        setErrors({ cover: cause.message });
      } else {
        setErrors({ form: cause.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  const updateRow = (key: number, change: Partial<Contributor>) => {
    setContributors((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
    setErrors((prev) => ({
      ...prev,
      form: undefined,
      ...(change.name !== undefined && {
        names: { ...prev.names, [key]: "" },
      }),
      ...(change.role !== undefined && { contributors: undefined }),
    }));
  };

  return (
    <>
      <div className="mt-5 flex items-end justify-between gap-4 sm:mt-7">
        <div className="flex flex-col gap-2">
          <Link
            to="/publisher/books"
            className="flex items-center gap-2 text-base font-semibold text-foreground/70 hover:text-foreground"
          >
            <ArrowLeft className="size-4.5" />
            Quay lại danh sách
          </Link>
          <h1 className="text-[28px] font-bold sm:text-[32px]">
            {book ? "Sửa sách" : "Thêm sách"}
          </h1>
        </div>
        {book && (
          <Button
            type="button"
            className={actionButton("dangerOutline")}
            onClick={() => setIsDeleting(true)}
          >
            <Trash2 />
            Xóa sách
          </Button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 flex flex-col gap-6 sm:mt-8 lg:flex-row lg:gap-9"
      >
        <CoverField
          value={cover}
          onChange={(publicId) => {
            setCover(publicId);
            clearError("cover");
          }}
          onBusyChange={setIsUploading}
          error={errors.cover}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-6 rounded-[20px] bg-white p-6 sm:p-8">
          <BoxedInput
            id={`${id}-title`}
            label="Tên sách"
            placeholder="VD: Nhà Giả Kim"
            maxLength={BOOK_TITLE_MAX_LENGTH}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              clearError("title");
            }}
            error={errors.title}
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="contents">
              <span className="text-lg/[1.3] font-bold">Người đóng góp</span>
            </legend>
            <p
              className={cn(
                "-mt-3 text-[15px] font-semibold",
                errors.contributors ? "text-[#ff6d6d]" : "text-foreground/55",
              )}
            >
              {errors.contributors ?? "Cần ít nhất một tác giả"}
            </p>
            {contributors.map((row) => (
              <div key={row.key} className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
                  <div className="min-w-0 flex-1">
                    <BoxedInput
                      id={`${id}-name-${row.key}`}
                      label="Họ tên"
                      placeholder="VD: Paulo Coelho"
                      maxLength={CONTRIBUTOR_NAME_MAX_LENGTH}
                      value={row.name}
                      onChange={(event) =>
                        updateRow(row.key, { name: event.target.value })
                      }
                      error={errors.names?.[row.key] || undefined}
                    />
                  </div>
                  <div className="sm:w-60">
                    <RoleSelect
                      id={`${id}-role-${row.key}`}
                      value={row.role}
                      onChange={(role) => updateRow(row.key, { role })}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Bỏ người đóng góp này"
                  disabled={contributors.length === 1}
                  onClick={() => {
                    setContributors((rows) =>
                      rows.filter((item) => item.key !== row.key),
                    );
                    clearError("contributors");
                  }}
                  className="mt-3 flex size-11 shrink-0 items-center justify-center rounded-[10px] border-2 border-foreground/20 hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <X className="size-5" />
                </button>
              </div>
            ))}
            {contributors.length < CONTRIBUTORS_MAX && (
              <button
                type="button"
                onClick={() =>
                  setContributors((rows) => [
                    ...rows,
                    newRow({ name: "", role: "author" }),
                  ])
                }
                className="flex items-center gap-2 self-start text-base font-bold text-primary hover:underline"
              >
                <Plus className="size-4.5" strokeWidth={2.5} />
                Thêm người đóng góp
              </button>
            )}
          </fieldset>

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-lg/[1.3] font-bold">Thể loại</p>
              <p
                role={errors.genres ? "alert" : undefined}
                className={cn(
                  "text-[15px] font-semibold",
                  errors.genres ? "text-[#ff6d6d]" : "text-foreground/55",
                )}
              >
                {errors.genres ?? "Chọn từ 1 đến 10 thể loại"}
              </p>
            </div>
            <GenrePicker
              variant="form"
              value={genreIds}
              seed={book?.genres}
              invalid={errors.genres !== undefined}
              onChange={(ids) => {
                setGenreIds(ids);
                clearError("genres");
              }}
            />
          </div>

          <div className="sm:max-w-75">
            <BoxedInput
              id={`${id}-year`}
              label="Năm xuất bản (không bắt buộc)"
              placeholder={`VD: ${new Date().getFullYear()}`}
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(event) => {
                setYear(event.target.value.replace(/\D/g, ""));
                clearError("year");
              }}
              error={errors.year}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <BoxedTextarea
              id={`${id}-description`}
              label="Giới thiệu (không bắt buộc)"
              placeholder="Nội dung chính, đối tượng độc giả..."
              rows={6}
              maxLength={BOOK_DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearError("form");
              }}
            />
            <p className="text-right text-sm font-semibold text-foreground/55">
              {formatNumber(description.length)} /{" "}
              {formatNumber(BOOK_DESCRIPTION_MAX_LENGTH)}
            </p>
          </div>

          <BoxedTextarea
            id={`${id}-note`}
            label="Ghi chú (không bắt buộc)"
            placeholder="VD: Bổ sung theo kế hoạch xuất bản quý 1"
            rows={2}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          {book && (
            <p className="rounded-[10px] bg-primary/8 px-4 py-3 text-[15px] font-semibold text-primary">
              Đổi tên sách thì đường dẫn của sách cũng đổi theo, link cũ sẽ
              không mở được.
            </p>
          )}

          {errors.form && (
            <p role="alert" className="text-base font-semibold text-[#ff6d6d]">
              {errors.form}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              className={actionButton("secondary")}
              onClick={goToList}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isPending || isUploading || isUnchanged}
              className={actionButton("primary")}
            >
              {book ? "Lưu" : "Thêm sách"}
            </Button>
          </div>
        </div>
      </form>

      {book && isDeleting && (
        <DeleteBookDialog
          book={book}
          onClose={() => setIsDeleting(false)}
          onDone={() => {
            toast.success(`Đã xóa sách "${book.title}"`);
            goToList();
          }}
          onGone={handleGone}
        />
      )}
    </>
  );
}
