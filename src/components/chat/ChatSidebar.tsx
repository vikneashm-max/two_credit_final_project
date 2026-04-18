import { MessageSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/chat";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

export const ChatSidebar = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: ChatSidebarProps) => {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-sm font-semibold leading-tight">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">Multi-Modal</p>
        </div>
      </div>

      <div className="p-3">
        <Button
          onClick={() => {
            onNew();
            onClose?.();
          }}
          className="w-full justify-start gap-2 rounded-xl bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-3">
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No conversations yet
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelect(c.id);
                onClose?.();
              }}
              className={cn(
                "group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                activeId === c.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{c.title}</span>
              <Trash2
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="h-4 w-4 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              />
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
        Built with Lovable ✨
      </div>
    </aside>
  );
};
