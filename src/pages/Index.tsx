import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type { ChatMessage, Conversation } from "@/types/chat";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

const uid = () => Math.random().toString(36).slice(2, 10);

const createConversation = (): Conversation => ({
  id: uid(),
  title: "New chat",
  messages: [],
  updatedAt: Date.now(),
});

const wantsImagePrompt = (text: string) => /image|picture|photo|draw|generate.*pic/i.test(text);

const Index = () => {
  const [conversations, setConversations] = useState<Conversation[]>(() => [createConversation()]);
  const [activeId, setActiveId] = useState<string>(() => "");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // initialize active id once conversations are ready
  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  // smooth auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [active?.messages.length, isLoading]);

  const updateActive = (updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === activeId ? updater(c) : c)));
  };

  const handleSend = async (text: string) => {
    if (!active) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    updateActive((c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
      messages: [...c.messages, userMsg],
      updatedAt: Date.now(),
    }));

    setIsLoading(true);

    try {
      const conversation = conversations.find((c) => c.id === activeId);
      const history = (conversation?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const wantsImage = wantsImagePrompt(text);

      const chatPromise = fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: text }] }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail ?? "Chat request failed");
        return (await r.json()) as { text: string };
      });

      const imagePromise = wantsImage
        ? fetch(`${API_BASE_URL}/image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: text }),
          }).then(async (r) => {
            if (!r.ok) throw new Error((await r.json()).detail ?? "Image request failed");
            const blob = await r.blob();
            return URL.createObjectURL(blob);
          })
        : Promise.resolve(undefined);

      const [chatRes, imageUrl] = await Promise.all([chatPromise, imagePromise]);

      const reply: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: chatRes.text,
        imageUrl,
        createdAt: Date.now(),
      };

      updateActive((c) => ({
        ...c,
        messages: [...c.messages, reply],
        updatedAt: Date.now(),
      }));
    } catch (e: any) {
      const reply: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: `Error: ${e?.message ?? "Request failed"}`,
        createdAt: Date.now(),
      };
      updateActive((c) => ({
        ...c,
        messages: [...c.messages, reply],
        updatedAt: Date.now(),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    const c = createConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
  };

  const handleDelete = (id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        const fallback = next[0] ?? createConversation();
        if (next.length === 0) next.push(fallback);
        setActiveId(fallback.id);
      }
      return next;
    });
  };

  const handleClearActive = () => {
    updateActive((c) => ({ ...c, messages: [], title: "New chat", updatedAt: Date.now() }));
  };

  const sidebar = (
    <ChatSidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={setActiveId}
      onNew={handleNew}
      onDelete={handleDelete}
      onClose={() => setSidebarOpen(false)}
    />
  );

  return (
    <div className="flex h-screen w-full bg-gradient-subtle">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Main */}
      <div className="relative flex flex-1 flex-col">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-glow" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between gap-2 border-b border-border bg-background/70 px-4 py-3 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {sidebar}
              </SheetContent>
            </Sheet>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant md:hidden">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>

            <div>
              <h1 className="font-display text-lg font-semibold leading-tight">AI Assistant</h1>
              <p className="text-xs text-muted-foreground">Multi-modal · text, voice & images</p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-xl text-muted-foreground hover:text-destructive"
                disabled={!active || active.messages.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear chat</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  All messages in this chat will be removed. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearActive}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </header>

        {/* Conversation */}
        <main
          ref={scrollRef}
          className="scrollbar-thin relative z-0 flex-1 overflow-y-auto scroll-smooth"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
            {active && active.messages.length === 0 && !isLoading && <EmptyState />}
            {active?.messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {isLoading && <TypingIndicator />}
          </div>
        </main>

        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center px-4 py-16 text-center animate-fade-in-up">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-elegant">
      <Sparkles className="h-8 w-8 text-primary-foreground" />
    </div>
    <h2 className="mb-2 font-display text-2xl font-semibold md:text-3xl">
      How can I help today?
    </h2>
    <p className="max-w-md text-sm text-muted-foreground md:text-base">
      Ask anything — chat by text or voice, request an image, or just brainstorm.
    </p>
    <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
      {[
        "Generate an image of a mountain at sunset",
        "Summarize the latest in AI",
        "Help me plan a 3-day trip to Tokyo",
        "Write a poem about the ocean",
      ].map((s) => (
        <div
          key={s}
          className="rounded-xl border border-border bg-card p-3 text-left text-sm text-muted-foreground shadow-soft transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {s}
        </div>
      ))}
    </div>
  </div>
);

export default Index;
