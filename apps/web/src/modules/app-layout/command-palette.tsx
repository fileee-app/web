import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@fileee/ui/components/command";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CircleAlertIcon,
  DatabaseIcon,
  HouseIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { orpc } from "../../lib/orpc.ts";
import { setTheme } from "../../lib/theme.ts";
import { FileIcon } from "../../components/file-icon.tsx";

const GROUPS = ["Go to", "Storages", "Theme"] as const;

type Action = { group: string; label: string; icon: ReactNode; run: () => void };

/** ⌘K / Ctrl+K from anywhere in the app: jump to a page or storage, switch theme, or find a file. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data: user } = useSuspenseQuery(orpc.auth.me.queryOptions());
  const { data: storages } = useSuspenseQuery(orpc.storage.list.queryOptions());

  const files = useQuery(
    orpc.search.query.queryOptions({
      input: { q },
      enabled: open && q !== "",
      placeholderData: keepPreviousData,
    }),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((was) => !was);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 200);

    return () => clearTimeout(timer);
  }, [text]);

  const close = (then: () => void) => () => {
    setOpen(false);
    setText("");
    then();
  };

  const actions: Action[] = [
    {
      group: "Go to",
      label: "Home",
      icon: <HouseIcon />,
      run: () => navigate({ to: "/" }),
    },
    {
      group: "Go to",
      label: "Trash",
      icon: <Trash2Icon />,
      run: () => navigate({ to: "/trash" }),
    },
    {
      group: "Go to",
      label: "Settings",
      icon: <SettingsIcon />,
      run: () => navigate({ to: "/settings" }),
    },
    {
      group: "Go to",
      label: "Account settings",
      icon: <UserIcon />,
      run: () => navigate({ to: "/settings/account" }),
    },
    {
      group: "Go to",
      label: "Storage settings",
      icon: <DatabaseIcon />,
      run: () => navigate({ to: "/settings/storages" }),
    },
    ...(user?.role === "admin"
      ? [
          {
            group: "Go to",
            label: "General settings",
            icon: <SlidersHorizontalIcon />,
            run: () => navigate({ to: "/settings/general" }),
          },
          {
            group: "Go to",
            label: "Users",
            icon: <UsersIcon />,
            run: () => navigate({ to: "/settings/users" }),
          },
        ]
      : []),
    ...storages.map((storage) => ({
      group: "Storages",
      label: storage.name,
      icon:
        storage.status === "error" ? (
          <CircleAlertIcon className="text-destructive" />
        ) : (
          <DatabaseIcon />
        ),
      run: () => navigate({ to: "/s/$storageId/$", params: { storageId: storage.id, _splat: "" } }),
    })),
    {
      group: "Storages",
      label: "Connect storage",
      icon: <PlusIcon />,
      run: () => navigate({ to: "/settings/storages/new" }),
    },
    {
      group: "Theme",
      label: "Light theme",
      icon: <SunIcon />,
      run: () => setTheme({ mode: "light" }),
    },
    {
      group: "Theme",
      label: "Dark theme",
      icon: <MoonIcon />,
      run: () => setTheme({ mode: "dark" }),
    },
    {
      group: "Theme",
      label: "System theme",
      icon: <MonitorIcon />,
      run: () => setTheme({ mode: "system" }),
    },
  ];

  const needle = text.trim().toLowerCase();
  const matching = actions.filter((action) => action.label.toLowerCase().includes(needle));
  // Results for older text linger while the new ones load, so they only show once they're for this text.
  const found = q && q === text.trim() ? (files.data?.items.slice(0, 8) ?? []) : [];

  const first = matching.length
    ? `${GROUPS.find((group) => matching.some((action) => action.group === group))}:0`
    : found[0]
      ? `file:${found[0].id}`
      : "search-all";

  // cmdk keeps its selection when results arrive late, so Enter would skip the top file: a new top item resets it.
  const [pick, setPick] = useState({ top: first, value: first });
  const selected = pick.top === first ? pick.value : first;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) setText("");
      }}
      title="Command palette"
      description="Go to a page or storage, change the theme, or find a file"
    >
      {/* The server ranks files by name and metadata, so cmdk's own filter would hide good matches. */}
      <Command
        shouldFilter={false}
        value={selected}
        onValueChange={(value) => setPick({ top: first, value })}
      >
        <CommandInput
          placeholder="Type a command or search files…"
          value={text}
          onValueChange={setText}
          maxLength={200}
        />

        <CommandList>
          {GROUPS.map((group) => {
            const items = matching.filter((action) => action.group === group);

            return (
              items.length > 0 && (
                <CommandGroup key={group} heading={group}>
                  {items.map((action, i) => (
                    <CommandItem key={i} value={`${group}:${i}`} onSelect={close(action.run)}>
                      {action.icon}
                      {action.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            );
          })}

          {needle && (
            <CommandGroup heading="Files">
              {found.map((file) => (
                <CommandItem
                  key={file.id}
                  value={`file:${file.id}`}
                  onSelect={close(() =>
                    navigate({
                      to: "/s/$storageId/$",
                      params: { storageId: file.storageId, _splat: file.folderId },
                    }),
                  )}
                >
                  <FileIcon mimeType={file.mimeType} />
                  <span className="truncate">{file.name}</span>
                  <CommandShortcut className="tracking-normal">{file.storageName}</CommandShortcut>
                </CommandItem>
              ))}

              <CommandItem
                value="search-all"
                onSelect={close(() => navigate({ to: "/search", search: { q: text.trim() } }))}
              >
                <SearchIcon />
                Search all files for “{text.trim()}”
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
