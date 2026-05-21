"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { type Lang, VALID_LANGS } from "@/lib/i18n";

interface LangContextValue {
  lang:    Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [lang, setLangState] = useState<Lang>("en");

  // Sync from session (DB) on first load and after session.update() calls
  useEffect(() => {
    const sessionLang = (session?.user as { language?: string } | undefined)?.language;
    const stored      = typeof window !== "undefined" ? localStorage.getItem("sierralogic-lang") : null;
    const resolved    = sessionLang ?? stored ?? "en";
    if (VALID_LANGS.includes(resolved as Lang)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(resolved as Lang);
    }
  }, [session]);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("sierralogic-lang", l);
  }

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

/** Returns the current UI language and a setter that also writes to localStorage. */
export function useLang(): LangContextValue {
  return useContext(LangContext);
}
