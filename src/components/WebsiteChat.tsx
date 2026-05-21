"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat }              from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart } from "ai";
import type { UIMessage }       from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Bot, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract plain text from a UIMessage's parts array. */
function messageText(m: UIMessage): string {
  return m.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What is the main product or service?",
  "Who is the target audience?",
  "What are the key calls to action?",
  "Is there contact information?",
  "What pricing is mentioned?",
];

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "rounded-tr-sm bg-indigo-600 text-white"
            : "rounded-tl-sm bg-muted text-foreground",
        )}
      >
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface WebsiteChatProps {
  websiteContext: string;
  websiteUrl:     string;
}

export function WebsiteChat({ websiteContext, websiteUrl }: WebsiteChatProps) {
  const [input, setInput]   = useState("");
  const bottomRef           = useRef<HTMLDivElement>(null);
  const textareaRef         = useRef<HTMLTextAreaElement>(null);

  // Memoize transport so it's not recreated on every render
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { websiteContext } }),
    [websiteContext],
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(text: string) {
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
  }

  const hostname = (() => {
    try { return new URL(websiteUrl).hostname; }
    catch { return websiteUrl; }
  })();

  return (
    <div className="mt-5 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10">
          <MessageSquare className="h-4 w-4 text-violet-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Chat with this website</p>
          <p className="truncate text-xs text-muted-foreground">{hostname}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3 overflow-y-auto p-4" style={{ maxHeight: "380px" }}>
        {/* Empty state + suggestions */}
        {messages.length === 0 && (
          <div className="space-y-3 py-2">
            <p className="text-center text-xs text-muted-foreground">
              Ask anything about the content of this page.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  disabled={isStreaming}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-violet-400 hover:bg-violet-50/50 hover:text-violet-600 disabled:opacity-40 dark:hover:bg-violet-950/30 dark:hover:text-violet-400"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const text = messageText(m);
            if (!text) return null;
            const role = m.role as "user" | "assistant";
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageBubble role={role} text={text} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isStreaming && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <TypingIndicator />
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-border bg-background/60 p-3 backdrop-blur-sm">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this page…"
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 disabled:opacity-50"
          style={{ maxHeight: "120px" }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
          aria-label="Send"
        >
          {isStreaming
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
