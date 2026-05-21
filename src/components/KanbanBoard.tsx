"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import { toast }      from "sonner";
import { cn }         from "@/lib/utils";
import {
  X, Sparkles, Loader2, Copy, CheckCheck, RefreshCw,
} from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import type { TaskItem, TaskStatus } from "@/types";

type Lang = "en" | "uk" | "de" | "fr" | "pl";

// ─── All board strings in one place ──────────────────────────────────────────

interface BoardLabels {
  // Column titles (keyed by status)
  TODO:        string;
  IN_PROGRESS: string;
  DONE:        string;
  // Empty states
  noTasks:     string;
  dragHere:    string;
  completed:   string;
  // Board heading
  boardTitle:  string;
  // Modal
  aiFixLabel:    string;
  generateBtn:   string;
  regenerate:    string;
  aiWriting:     string;
  fixReady:      string;
  viewFix:       string;
  genFix:        string;
  copied:        string;
  copyClipboard: string;
}

const BOARD_LABELS: Record<Lang, BoardLabels> = {
  en: {
    TODO:        "To Do",
    IN_PROGRESS: "In Progress",
    DONE:        "Done",
    noTasks:     "No tasks yet",
    dragHere:    "Drop tasks here",
    completed:   "Completed tasks appear here",
    boardTitle:  "AI Action Board",
    aiFixLabel:    "AI-Generated Fix",
    generateBtn:   "Generate Fix with AI",
    regenerate:    "Regenerate",
    aiWriting:     "AI is writing code…",
    fixReady:      "✓ Fix ready",
    viewFix:       "View fix →",
    genFix:        "Generate fix →",
    copied:        "Copied!",
    copyClipboard: "Copy to Clipboard",
  },
  uk: {
    TODO:        "До виконання",
    IN_PROGRESS: "У процесі",
    DONE:        "Готово",
    noTasks:     "Немає завдань",
    dragHere:    "Перетягніть сюди",
    completed:   "Виконані завдання",
    boardTitle:  "ШІ-дошка",
    aiFixLabel:    "Рішення від ШІ",
    generateBtn:   "✨ Згенерувати рішення",
    regenerate:    "Оновити",
    aiWriting:     "ШІ пише код…",
    fixReady:      "✓ Рішення готове",
    viewFix:       "Переглянути →",
    genFix:        "Згенерувати →",
    copied:        "Скопійовано!",
    copyClipboard: "Скопіювати",
  },
  de: {
    TODO:        "Zu erledigen",
    IN_PROGRESS: "In Bearbeitung",
    DONE:        "Erledigt",
    noTasks:     "Keine Aufgaben",
    dragHere:    "Hierher ziehen",
    completed:   "Abgeschlossene Aufgaben",
    boardTitle:  "KI-Aktionsboard",
    aiFixLabel:    "KI-generierte Lösung",
    generateBtn:   "Lösung mit KI generieren",
    regenerate:    "Neu generieren",
    aiWriting:     "KI schreibt Code…",
    fixReady:      "✓ Lösung bereit",
    viewFix:       "Lösung ansehen →",
    genFix:        "Lösung generieren →",
    copied:        "Kopiert!",
    copyClipboard: "In Zwischenablage kopieren",
  },
  fr: {
    TODO:        "À faire",
    IN_PROGRESS: "En cours",
    DONE:        "Terminé",
    noTasks:     "Aucune tâche",
    dragHere:    "Glissez ici",
    completed:   "Tâches terminées",
    boardTitle:  "Tableau IA",
    aiFixLabel:    "Solution générée par l'IA",
    generateBtn:   "Générer une solution avec l'IA",
    regenerate:    "Régénérer",
    aiWriting:     "L'IA écrit le code…",
    fixReady:      "✓ Solution prête",
    viewFix:       "Voir la solution →",
    genFix:        "Générer →",
    copied:        "Copié !",
    copyClipboard: "Copier dans le presse-papier",
  },
  pl: {
    TODO:        "Do zrobienia",
    IN_PROGRESS: "W toku",
    DONE:        "Gotowe",
    noTasks:     "Brak zadań",
    dragHere:    "Przeciągnij tutaj",
    completed:   "Ukończone zadania",
    boardTitle:  "Tablica AI",
    aiFixLabel:    "Rozwiązanie AI",
    generateBtn:   "Wygeneruj rozwiązanie z AI",
    regenerate:    "Regeneruj",
    aiWriting:     "AI pisze kod…",
    fixReady:      "✓ Rozwiązanie gotowe",
    viewFix:       "Zobacz rozwiązanie →",
    genFix:        "Generuj →",
    copied:        "Skopiowano!",
    copyClipboard: "Kopiuj do schowka",
  },
} satisfies Record<Lang, BoardLabels>;

// ─── Column metadata (styles, not text) ──────────────────────────────────────

type ColKey = "noTasks" | "dragHere" | "completed";

const COLUMN_META: Array<{
  id:          TaskStatus;
  emptyKey:    ColKey;
  accentColor: string;
  accentBg:    string;
  ringClass:   string;
}> = [
  { id: "TODO",        emptyKey: "noTasks",   accentColor: "bg-slate-400",   accentBg: "bg-slate-400/10",   ringClass: "ring-slate-400/30" },
  { id: "IN_PROGRESS", emptyKey: "dragHere",  accentColor: "bg-amber-400",   accentBg: "bg-amber-400/10",   ringClass: "ring-amber-400/30" },
  { id: "DONE",        emptyKey: "completed", accentColor: "bg-emerald-400", accentBg: "bg-emerald-400/10", ringClass: "ring-emerald-400/30" },
];

const CATEGORY_STYLES: Record<string, string> = {
  SEO:       "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  MARKETING: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  UX:        "bg-violet-500/15 text-violet-400 border border-violet-500/25",
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH:   "bg-red-400",
  MEDIUM: "bg-amber-400",
  LOW:    "bg-slate-400",
};

const PRIORITY_LABEL: Record<string, string> = {
  HIGH:   "text-red-400",
  MEDIUM: "text-amber-400",
  LOW:    "text-slate-400",
};

// ─── Animated writing dots ────────────────────────────────────────────────────

function WritingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

// ─── Task detail modal ────────────────────────────────────────────────────────

function TaskModal({
  task,
  labels,
  onClose,
  onSolutionSaved,
}: {
  task:            TaskItem;
  labels:          BoardLabels;
  onClose:         () => void;
  onSolutionSaved: (taskId: string, solution: string) => void;
}) {
  const [solution,  setSolution]  = useState(task.solution ?? "");
  const [streaming, setStreaming] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [solution]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function generateFix() {
    setStreaming(true);
    setSolution("");
    try {
      const res = await fetch(`/api/tasks/${task.id}/solve`, { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setSolution(full);
      }
      full += decoder.decode();
      setSolution(full);
      onSolutionSaved(task.id, full);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate fix.");
    } finally {
      setStreaming(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(solution);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_200);
    } catch {
      toast.error("Clipboard write failed.");
    }
  }

  const hasSolution = solution.trim().length > 0;

  return (
    <>
      <motion.div
        key="task-modal-backdrop"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="task-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl",
          "border border-white/25 dark:border-white/10",
          "bg-white/70 dark:bg-zinc-900/80 backdrop-blur-2xl",
          "shadow-[0_24px_64px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
        )}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/40 dark:hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="border-b border-white/20 dark:border-white/10 p-5 pb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                CATEGORY_STYLES[task.category] ?? CATEGORY_STYLES.SEO,
              )}>
                {task.category}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                PRIORITY_LABEL[task.priority],
              )}>
                <span className={cn("inline-block h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} />
                {task.priority}
              </span>
              {hasSolution && (
                <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                  {labels.fixReady}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-foreground">{task.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{task.description}</p>
          </div>

          {/* Solution */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{labels.aiFixLabel}</p>
              {hasSolution && !streaming && (
                <button
                  onClick={generateFix}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/30 dark:hover:bg-white/10 hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" />
                  {labels.regenerate}
                </button>
              )}
            </div>

            {!hasSolution && !streaming && (
              <motion.button
                onClick={generateFix}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full rounded-2xl py-3.5 px-4",
                  "inline-flex items-center justify-center gap-2",
                  "text-sm font-semibold text-white",
                  "bg-gradient-to-r from-indigo-600 to-violet-600",
                  "shadow-[0_4px_20px_rgba(99,102,241,0.35)]",
                  "transition-all duration-200 hover:shadow-[0_4px_28px_rgba(99,102,241,0.5)]",
                )}
              >
                <Sparkles className="h-4 w-4" />
                {labels.generateBtn}
              </motion.button>
            )}

            {streaming && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-indigo-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{labels.aiWriting}</span>
                  <WritingDots />
                </div>
                {solution && (
                  <pre className={cn(
                    "overflow-x-auto rounded-xl p-4 text-xs leading-relaxed",
                    "bg-zinc-950/80 dark:bg-black/60 text-zinc-100",
                    "border border-white/10 backdrop-blur-sm font-mono whitespace-pre-wrap break-words",
                  )}>
                    {solution}
                  </pre>
                )}
              </div>
            )}

            {hasSolution && !streaming && (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    className={cn(
                      "w-full resize-none rounded-xl p-4 text-xs leading-relaxed",
                      "bg-zinc-950/80 dark:bg-black/60 text-zinc-100",
                      "border border-white/10 backdrop-blur-sm",
                      "font-mono outline-none focus:ring-2 focus:ring-indigo-500/30",
                      "min-h-[80px] max-h-[400px] overflow-y-auto",
                    )}
                    spellCheck={false}
                  />
                </div>
                <button
                  onClick={copyToClipboard}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4",
                    "text-sm font-semibold transition-all duration-200",
                    copied
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/30 dark:bg-white/10 text-foreground hover:bg-white/50 dark:hover:bg-white/15 border border-white/30 dark:border-white/10",
                  )}
                >
                  {copied
                    ? <><CheckCheck className="h-4 w-4" />{labels.copied}</>
                    : <><Copy className="h-4 w-4" />{labels.copyClipboard}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  labels,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task:        TaskItem;
  labels:      BoardLabels;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd:   () => void;
  onClick:     (task: TaskItem) => void;
}) {
  const didDrag = useRef(false);

  return (
    <div
      draggable
      onDragStart={(e) => { didDrag.current = true; onDragStart(e, task.id); }}
      onDragEnd={() => { onDragEnd(); setTimeout(() => { didDrag.current = false; }, 80); }}
      onClick={() => { if (!didDrag.current) onClick(task); }}
      className={cn(
        "group cursor-pointer select-none",
        "rounded-2xl border p-3.5",
        // More opaque than column so cards read as foreground objects
        "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md",
        "border-white/50 dark:border-white/10",
        "shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
        "active:opacity-70 active:scale-[0.98]",
      )}
    >
      {/* Priority + category */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className={cn(
          "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
          PRIORITY_LABEL[task.priority],
        )}>
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} />
          {task.priority}
        </span>
        <div className="flex items-center gap-1.5">
          {task.solution && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" title={labels.fixReady} />
          )}
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            CATEGORY_STYLES[task.category] ?? CATEGORY_STYLES.SEO,
          )}>
            {task.category}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="mb-1.5 text-sm font-semibold leading-snug text-foreground">
        {task.title}
      </p>

      {/* Description — capped height with hidden scrollbar so glass aesthetic stays clean */}
      <div className="max-h-[80px] overflow-y-auto hide-scrollbar">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {task.description}
        </p>
      </div>

      {/* Fix hint — appears on hover */}
      <div className="mt-3 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Sparkles className="h-3 w-3 text-indigo-400" />
        <span className="text-[10px] text-indigo-400">
          {task.solution ? labels.viewFix : labels.genFix}
        </span>
      </div>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  labels,
  tasks,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardClick,
}: {
  col:         (typeof COLUMN_META)[number];
  labels:      BoardLabels;
  tasks:       TaskItem[];
  isDragOver:  boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd:   () => void;
  onDragOver:  (e: React.DragEvent, status: TaskStatus) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop:      (e: React.DragEvent, status: TaskStatus) => void;
  onCardClick: (task: TaskItem) => void;
}) {
  return (
    <div
      onDragOver={(e) => onDragOver(e, col.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, col.id)}
      className={cn(
        // Fixed-width columns that don't overflow their scroll parent
        "w-[280px] min-w-[280px] md:w-[320px] md:min-w-[320px] max-w-[320px] flex-shrink-0 snap-center",
        "flex flex-col rounded-[2.5rem] p-6 transition-all duration-200",
        // Liquid glass column
        "bg-white/10 dark:bg-zinc-900/20 backdrop-blur-xl",
        "border border-white/30 dark:border-white/10",
        "shadow-[0_8px_32px_0_rgba(0,0,0,0.10)]",
        isDragOver && cn("ring-2 ring-inset scale-[1.01]", col.ringClass),
      )}
    >
      {/* Column header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", col.accentColor)} />
          <p className="text-sm font-semibold text-foreground">{labels[col.id]}</p>
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
          "bg-white/30 dark:bg-white/10 text-foreground/70",
        )}>
          {tasks.length}
        </span>
      </div>

      {/* Cards — column scrolls internally; glass bg stays fixed behind */}
      <div
        className="flex flex-col gap-4 overflow-y-auto hide-scrollbar pb-12"
        style={{ minHeight: "120px", maxHeight: "52vh" }}
      >
        {tasks.length === 0 ? (
          <p className={cn(
            "flex flex-1 items-center justify-center py-10 text-xs text-muted-foreground/40",
            isDragOver && "text-muted-foreground/70",
          )}>
            {isDragOver ? "↓" : labels[col.emptyKey]}
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              labels={labels}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Kanban board ─────────────────────────────────────────────────────────────

export interface KanbanBoardProps {
  initialTasks: TaskItem[];
  lang?:        Lang; // kept for backward-compat; board reads from useLang() context
}

export function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const { lang } = useLang();
  const labels   = BOARD_LABELS[(lang as Lang) in BOARD_LABELS ? (lang as Lang) : "en"];

  const [tasks, setTasks]               = useState<TaskItem[]>(initialTasks);
  const [dragOverCol, setDragOverCol]   = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const draggingId                      = useRef<string | null>(null);

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  function handleDragStart(e: React.DragEvent, id: string) {
    draggingId.current = id;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDragOverCol(null);
    draggingId.current = null;
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCol(null);
    }
  }

  async function handleDrop(e: React.DragEvent, newStatus: TaskStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const id = draggingId.current;
    draggingId.current = null;
    if (!id) return;

    const snapshot = tasks;
    const task     = snapshot.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;

    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setTasks(snapshot);
      toast.error(`Failed to save task status. ${err instanceof Error ? err.message : ""}`);
    }
  }

  function handleSolutionSaved(taskId: string, solution: string) {
    setTasks((ts) => ts.map((t) => t.id === taskId ? { ...t, solution } : t));
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, solution } : prev);
  }

  function handleCardClick(task: TaskItem) {
    const latest = tasks.find((t) => t.id === task.id) ?? task;
    setSelectedTask(latest);
  }

  const forCol = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <>
      {/* Board title */}
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        {labels.boardTitle}
      </p>

      {/* Outer: clips horizontal overflow. Inner: w-max + mx-auto = centered when
          columns fit the viewport, left-anchored scroll when they don't. */}
      <div className="w-full overflow-x-auto hide-scrollbar">
        <div className="flex gap-6 pt-1 pb-8 snap-x px-4 md:px-6 w-max mx-auto">
        {COLUMN_META.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            labels={labels}
            tasks={forCol(col.id)}
            isDragOver={dragOverCol === col.id}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onCardClick={handleCardClick}
          />
        ))}
        </div>  {/* end inner centering div */}
      </div>  {/* end outer scroll div */}

      {/* Task detail modal — portalled above all content */}
      <AnimatePresence>
        {selectedTask && (
          <TaskModal
            key={selectedTask.id}
            task={selectedTask}
            labels={labels}
            onClose={() => setSelectedTask(null)}
            onSolutionSaved={handleSolutionSaved}
          />
        )}
      </AnimatePresence>
    </>
  );
}
