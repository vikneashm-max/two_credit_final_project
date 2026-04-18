import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

// Minimal SpeechRecognition typing
type SR = {
  start: () => void;
  stop: () => void;
  onresult: (e: any) => void;
  onerror: (e: any) => void;
  onend: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SR | null>(null);
  const baseTextRef = useRef<string>("");
  const finalTranscriptRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const toggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        title: "Voice input unavailable",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      });
      return;
    }

    // Most browsers require HTTPS for microphone/speech features (localhost is allowed).
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      toast({
        title: "Voice input blocked",
        description: "Open the app over HTTPS (or use http://localhost) to use the microphone.",
        variant: "destructive",
      });
      return;
    }

    if (recording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition: SR = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    baseTextRef.current = text;
    finalTranscriptRef.current = "";

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";

      // event.results contains cumulative results; rebuild the transcript each time.
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const t = (res?.[0]?.transcript ?? "").toString();
        if (res.isFinal) finalText += t;
        else interimText += t;
      }

      finalText = finalText.trim();
      interimText = interimText.trim();
      finalTranscriptRef.current = finalText;

      const combined = [baseTextRef.current, finalText, interimText]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ");

      setText(combined);
    };
    recognition.onerror = (e: any) => {
      setRecording(false);
      const code = e?.error as string | undefined;
      const description =
        code === "not-allowed"
          ? "Microphone permission denied. Allow mic access in the browser address bar."
          : code === "no-speech"
            ? "No speech detected. Try speaking a bit louder or closer to the mic."
            : "Try again.";

      toast({
        title: "Voice input error",
        description,
        variant: "destructive",
      });
    };
    recognition.onend = () => {
      setRecording(false);
      const combined = [baseTextRef.current, finalTranscriptRef.current]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ");
      setText(combined);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setRecording(false);
      toast({
        title: "Voice input error",
        description: "Couldn't start voice input. Try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-end gap-2 p-3 md:p-4">
        <div className="relative flex flex-1 items-end rounded-2xl border border-border bg-card shadow-soft transition-all focus-within:border-primary/50 focus-within:shadow-elegant">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            rows={1}
            className="min-h-[52px] resize-none border-0 bg-transparent px-4 py-4 pr-14 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleMic}
            className={cn(
              "absolute bottom-2 right-2 h-9 w-9 rounded-full",
              recording && "bg-destructive/10 text-destructive animate-pulse-ring"
            )}
            aria-label={recording ? "Stop recording" : "Start voice input"}
          >
            {recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
          </Button>
        </div>

        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-primary shadow-elegant transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      <p className="pb-2 text-center text-xs text-muted-foreground">
        AI Assistant can make mistakes. Verify important info.
      </p>
    </div>
  );
};
