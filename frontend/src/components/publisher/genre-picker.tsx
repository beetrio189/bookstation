import { ChevronDown, Plus, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BOOK_GENRES_MAX, UNCATEGORIZED, type GenreRef } from "@/lib/books";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 300;
// GET /genres cho tối đa 100 dòng; nhiều hơn thì gõ để lọc
const GENRES_LIMIT = 100;
const UNCATEGORIZED_LABEL = "Chưa phân loại";

/**
 * Danh sách chọn thể loại (component Figma "Danh sách chọn thể loại"): ô gõ để lọc,
 * tick chọn nhiều, chân ghi "Đã chọn N" + "Bỏ chọn tất cả".
 * - variant "filter" (danh sách sách): nút "Thể loại: …", có mục "Chưa phân loại"
 *   (chỉ được chọn một mình), chọn là đổi ngay.
 * - variant "form" (thêm/sửa sách): chip "Tên ×" + nút "+ Chọn thể loại", tối đa 10.
 * `seed`: tên các thể loại đã biết sẵn (chi tiết sách), để hiện chip trước khi tải danh sách.
 */
export function GenrePicker({
  variant,
  value,
  onChange,
  seed = [],
  invalid = false,
}: {
  variant: "filter" | "form";
  value: string[];
  onChange: (ids: string[]) => void;
  seed?: GenreRef[];
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GenreRef[]>();
  // Tên mọi thể loại từng thấy: thể loại đã chọn vẫn hiện tên khi bị lọc khỏi danh sách
  const [names, setNames] = useState(
    () => new Map(seed.map((genre) => [genre.id, genre.name])),
  );

  // Tải luôn từ đầu (không đợi mở) để có tên cho thể loại đang chọn trên URL
  useEffect(() => {
    const params = new URLSearchParams({
      limit: String(GENRES_LIMIT),
      ...(q && { q }),
    });

    api<{ items: GenreRef[] }>(`/genres?${params}`, { silent: true })
      .then(({ items: loaded }) => {
        setItems(loaded);
        setNames((prev) => {
          const next = new Map(prev);
          loaded.forEach((genre) => next.set(genre.id, genre.name));
          return next;
        });
      })
      .catch(() => setItems([]));
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const isFilter = variant === "filter";
  const isFull = value.length >= BOOK_GENRES_MAX;

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
    } else if (id === UNCATEGORIZED) {
      onChange([UNCATEGORIZED]);
    } else if (!isFull) {
      onChange([...value.filter((item) => item !== UNCATEGORIZED), id]);
    }
  };

  const nameOf = (id: string) =>
    id === UNCATEGORIZED ? UNCATEGORIZED_LABEL : (names.get(id) ?? "…");

  const filterLabel =
    value.length === 0 ? "Tất cả" : value.map(nameOf).join(", ");

  const trigger = isFilter ? (
    <Popover.Trigger
      className={cn(
        "flex h-14 w-full min-w-0 items-center gap-3 rounded-[20px] border-2 border-foreground bg-white/60 px-5 text-lg font-bold outline-none focus-visible:border-primary sm:w-62.5",
        open && "border-primary",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-left">
        Thể loại: {filterLabel}
      </span>
      <ChevronDown className="size-5.5 shrink-0" />
    </Popover.Trigger>
  ) : (
    <Popover.Trigger
      className={cn(
        "flex h-10 items-center gap-2 rounded-full border-2 border-dashed border-foreground/40 px-4 text-base font-bold outline-none hover:bg-foreground/5 focus-visible:border-primary",
        open && "border-solid border-primary",
        invalid && !open && "border-[#ff6d6d]",
      )}
    >
      <Plus className="size-4.5" strokeWidth={2.5} />
      Chọn thể loại
    </Popover.Trigger>
  );

  const rows = (isFilter
    ? [{ id: UNCATEGORIZED, name: UNCATEGORIZED_LABEL }]
    : []
  ).concat(items ?? []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {isFilter ? (
        trigger
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          {value.map((id) => (
            <span
              key={id}
              className="flex h-10 items-center gap-2 rounded-full bg-primary/10 pr-2.5 pl-4 text-base font-bold text-primary"
            >
              {nameOf(id)}
              <button
                type="button"
                aria-label={`Bỏ thể loại ${nameOf(id)}`}
                onClick={() => toggle(id)}
                className="rounded-full p-0.5 hover:bg-primary/15"
              >
                <X className="size-4" strokeWidth={3} />
              </button>
            </span>
          ))}
          {trigger}
        </div>
      )}
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 flex w-67 flex-col rounded-[14px] bg-white py-2 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.16)] outline-none"
        >
          <label className="mx-2 flex h-10 items-center gap-2.5 rounded-[10px] bg-foreground/5 px-3">
            <Search className="size-4 shrink-0" strokeWidth={2.5} />
            <input
              type="search"
              value={input}
              maxLength={100}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Gõ để lọc thể loại..."
              aria-label="Lọc thể loại"
              className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-foreground/45"
            />
          </label>
          <ul className="mt-1.5 max-h-72 overflow-y-auto">
            {items === undefined && (
              <li className="px-4 py-2 text-base font-medium text-foreground/50">
                Đang tải...
              </li>
            )}
            {items && rows.length === 0 && (
              <li className="px-4 py-2 text-base font-medium text-foreground/50">
                Không có thể loại nào
              </li>
            )}
            {items &&
              rows.map((genre) => {
                const checked = value.includes(genre.id);
                const disabled = !checked && isFull && genre.id !== UNCATEGORIZED;

                return (
                  <li
                    key={genre.id}
                    className={cn(
                      genre.id === UNCATEGORIZED &&
                        "border-b border-foreground/8",
                    )}
                  >
                    <label
                      className={cn(
                        "flex h-10 cursor-pointer items-center gap-3 px-4 text-base font-medium hover:bg-foreground/4",
                        checked && "bg-primary/8",
                        disabled && "cursor-not-allowed opacity-45",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(genre.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="truncate">{genre.name}</span>
                    </label>
                  </li>
                );
              })}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-foreground/8 px-4 pt-2 text-sm font-semibold">
            <span className="text-foreground/55">
              Đã chọn {value.length}
              {!isFilter && ` / ${BOOK_GENRES_MAX}`}
            </span>
            <button
              type="button"
              disabled={value.length === 0}
              onClick={() => onChange([])}
              className="font-bold text-primary disabled:opacity-40"
            >
              Bỏ chọn tất cả
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
