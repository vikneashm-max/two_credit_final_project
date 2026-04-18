import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble = ({ message }: ChatBubbleProps) => {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3 animate-fade-in-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-elegant">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
      )}

      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-2 rounded-2xl px-4 py-3 shadow-bubble md:max-w-[70%]",
          isUser
            ? "rounded-br-md bg-bubble-user text-bubble-user-foreground"
            : "rounded-bl-md border border-border bg-bubble-assistant text-bubble-assistant-foreground"
        )}
      >
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Shared in chat"
            className="max-h-80 w-full rounded-xl object-cover"
            loading="lazy"
          />
        )}
        {message.content && (
          <div
            className={cn(
              "prose prose-sm max-w-none break-words",
              isUser
                ? "prose-invert prose-p:text-bubble-user-foreground"
                : "prose-p:text-bubble-assistant-foreground"
            )}
          >
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  );
};
