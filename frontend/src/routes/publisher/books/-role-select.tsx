import { Check, ChevronDown } from "lucide-react";
import { Select } from "radix-ui";
import { CONTRIBUTOR_ROLES, type ContributorRole } from "@/lib/books";

/**
 * Ô "Vai trò" ở form sách: khung giống BoxedSelect, menu tự vẽ theo component Figma
 * "Danh sách chọn vai trò" (mục đang chọn nền xanh nhạt, chữ xanh, dấu tích).
 */
export function RoleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ContributorRole;
  onChange: (role: ContributorRole) => void;
}) {
  return (
    <Select.Root
      value={value}
      onValueChange={(next) => onChange(next as ContributorRole)}
    >
      <Select.Trigger
        id={id}
        className="flex w-full items-center gap-3 rounded-[20px] border-2 border-foreground px-5 py-2.5 text-left outline-none focus-visible:border-primary data-[state=open]:border-primary"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg/[1.3] font-bold">Vai trò</span>
          <span className="truncate text-lg/[1.3] font-medium">
            <Select.Value />
          </span>
        </span>
        <Select.Icon>
          <ChevronDown className="size-5.5" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          className="z-50 w-(--radix-select-trigger-width) overflow-hidden rounded-2xl bg-white py-2 text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
        >
          <Select.Viewport>
            {CONTRIBUTOR_ROLES.map((role) => (
              <Select.Item
                key={role.value}
                value={role.value}
                className="flex h-11 cursor-pointer items-center gap-3 px-5 text-[17px] font-medium outline-none select-none data-highlighted:bg-foreground/5 data-[state=checked]:bg-primary/8 data-[state=checked]:font-bold data-[state=checked]:text-primary"
              >
                <Select.ItemText>{role.label}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="size-4.5" strokeWidth={3} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
