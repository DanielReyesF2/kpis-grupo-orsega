import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, FileText, Settings, User, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

interface CommandAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  action: () => void;
  group?: string;
}

interface CommandPaletteProps {
  actions?: CommandAction[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({
  actions = [],
  isOpen: controlledOpen,
  onOpenChange,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : open;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isControlled && onOpenChange) {
          onOpenChange(!isOpen);
        } else {
          setOpen((open) => !open);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, isControlled, onOpenChange]);

  const defaultActions: CommandAction[] = [
    {
      id: "search-vouchers",
      label: "Buscar comprobantes",
      icon: FileText,
      keywords: ["comprobante", "voucher", "buscar"],
      action: () => {
        setLocation("/treasury/vouchers");
        if (isControlled && onOpenChange) {
          onOpenChange(false);
        } else {
          setOpen(false);
        }
      },
      group: "Navegación",
    },
    {
      id: "treasury",
      label: "Ir a Tesorería",
      icon: TrendingUp,
      keywords: ["tesorería", "treasury", "pagos"],
      action: () => {
        setLocation("/treasury");
        if (isControlled && onOpenChange) {
          onOpenChange(false);
        } else {
          setOpen(false);
        }
      },
      group: "Navegación",
    },
  ];

  const allActions = [...defaultActions, ...actions];

  const filteredActions = allActions.filter((action) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      action.label.toLowerCase().includes(searchLower) ||
      action.keywords.some((keyword) =>
        keyword.toLowerCase().includes(searchLower)
      )
    );
  });

  const groupedActions = filteredActions.reduce(
    (acc, action) => {
      const group = action.group || "Otros";
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(action);
      return acc;
    },
    {} as Record<string, CommandAction[]>
  );

  const handleSelect = useCallback(
    (action: CommandAction) => {
      action.action();
      setSearch("");
    },
    []
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (isControlled && onOpenChange) {
          onOpenChange(open);
        } else {
          setOpen(open);
        }
        if (!open) {
          setSearch("");
        }
      }}
    >
      <DialogContent className="overflow-hidden p-0 max-w-2xl">
        <Command className="rounded-lg border-none">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Buscar comandos... (⌘K)"
              value={search}
              onValueChange={setSearch}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty>No se encontraron resultados.</Command.Empty>
            {Object.entries(groupedActions).map(([group, groupActions]) => (
              <Command.Group key={group} heading={group}>
                {groupActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Command.Item
                      key={action.id}
                      value={action.label}
                      onSelect={() => handleSelect(action)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{action.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

