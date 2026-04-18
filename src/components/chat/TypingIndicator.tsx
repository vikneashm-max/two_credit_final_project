import { Bot } from "lucide-react";

export const TypingIndicator = () => (
  <div className="flex w-full gap-3 animate-fade-in-up">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-elegant">
      <Bot className="h-5 w-5 text-primary-foreground" />
    </div>
    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-bubble-assistant px-4 py-4 shadow-bubble">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  </div>
);
