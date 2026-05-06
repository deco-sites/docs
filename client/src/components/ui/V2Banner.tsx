import { useEffect, useState } from "react";
import { Icon } from "../atoms/Icon.tsx";

const STORAGE_KEY = "docs-v2-banner-dismissed";

interface V2BannerProps {
  locale: string;
}

const COPY = {
  en: {
    label: "New",
    body: "deco.cx v2 (TanStack / React) is now in preview.",
    cta: "Read the v2 docs",
    dismiss: "Dismiss",
  },
  pt: {
    label: "Novo",
    body: "A v2 da deco.cx (TanStack / React) já está em preview.",
    cta: "Ver a documentação da v2",
    dismiss: "Dispensar",
  },
} as const;

type Locale = keyof typeof COPY;

export function V2Banner({ locale }: V2BannerProps) {
  // Default to visible so non-dismissed readers (the common case) don't see a
  // flash-of-no-banner after hydration. Dismissed readers see it for one paint
  // before the effect below hides it — acceptable trade-off for a dismissible
  // announcement.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY) === "true";
    if (dismissed) setVisible(false);
  }, []);

  if (!visible) return null;

  const copy = COPY[(locale as Locale) in COPY ? (locale as Locale) : "en"];
  const targetLocale = (locale as Locale) in COPY ? locale : "en";
  const href = `/v2/${targetLocale}/getting-started/overview`;

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // localStorage may be unavailable (private mode); just hide for the session.
    }
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 text-sm">
      <div className="flex items-center gap-3 px-4 lg:px-8 py-2">
        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-primary text-primary-foreground shrink-0">
          {copy.label}
        </span>
        <p className="flex-1 min-w-0 text-foreground truncate">
          <span className="hidden sm:inline">{copy.body}</span>
          <span className="sm:hidden">deco.cx v2 preview</span>{" "}
          <a
            href={href}
            className="font-medium text-primary hover:underline whitespace-nowrap"
          >
            {copy.cta} →
          </a>
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={copy.dismiss}
          className="shrink-0 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
}
