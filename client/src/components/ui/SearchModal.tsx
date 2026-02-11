import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../atoms/Icon";

interface SearchResult {
  url: string;
  title: string;
  excerpt: string;
  breadcrumb?: string;
  subResult?: boolean;
}

interface PagefindResult {
  url: string;
  meta?: { title?: string };
  excerpt?: string;
  sub_results?: Array<{
    url: string;
    title: string;
    excerpt: string;
  }>;
}

interface SearchModalProps {
  locale: string;
  translations: Record<string, string>;
  variant?: "sidebar" | "mobile";
}

let pagefindInstance: {
  search: (query: string, options?: Record<string, unknown>) => Promise<{
    results: Array<{ data: () => Promise<PagefindResult> }>;
  }>;
} | null = null;

async function loadPagefind() {
  if (pagefindInstance) return pagefindInstance;
  try {
    // Load via fetch + blob URL to bypass Vite's module transform
    const resp = await fetch("/pagefind/pagefind.js");
    const text = await resp.text();
    const blob = new Blob([text], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const pf = await import(/* @vite-ignore */ url);
    URL.revokeObjectURL(url);
    await pf.options({
      basePath: "/pagefind/",
      ranking: {
        pageLength: 0.5,        // Less penalty for longer pages
        termFrequency: 1.2,     // Moderate boost for repeated terms
        termSaturation: 1.8,    // Diminish returns faster for repeated common words
        termSimilarity: 9.0,    // Strong boost for exact term matches
      },
    });
    pagefindInstance = pf;
    return pagefindInstance;
  } catch (e) {
    console.error("[SearchModal] Failed to load pagefind:", e);
    return null;
  }
}

/** Words too common to be useful for ranking */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "is", "it", "be", "as", "do", "by", "no", "so", "if", "up",
  "de", "e", "o", "um", "uma", "do", "da", "em", "no", "na", "para",
  "com", "por", "se", "que", "os", "as", "dos", "das",
]);

/** Score how well a title matches the query (higher = better match) */
function titleMatchScore(title: string, query: string): number {
  const normalizedTitle = title.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  // Exact match or containment gets highest score
  if (normalizedTitle === normalizedQuery) return 100;
  if (normalizedTitle.includes(normalizedQuery)) return 80;

  // Score by how many meaningful query terms appear in the title
  const queryTerms = normalizedQuery.split(/\s+/).filter((t) => !STOP_WORDS.has(t));
  if (queryTerms.length === 0) return 0;

  const matchedTerms = queryTerms.filter((term) => normalizedTitle.includes(term));
  return (matchedTerms.length / queryTerms.length) * 60;
}

/** Extract a readable breadcrumb from a docs URL, e.g. "/en/developing-guide/hello-world" → "Developing Guide" */
function breadcrumbFromUrl(url: string): string {
  // Remove locale prefix and trailing slash, take middle segments
  const segments = url.replace(/\/$/, "").split("/").filter(Boolean).slice(1, -1);
  return segments
    .map((s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" > ");
}

const DEBOUNCE_MS = 150;

export function SearchModal({ locale, translations, variant = "sidebar" }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const placeholder = translations["search.placeholder"] ?? "Search docs...";
  const noResults = translations["search.noResults"] ?? "No results found.";

  const openModal = useCallback(() => {
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setSearched(false);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closeModal();
        } else {
          openModal();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, openModal, closeModal]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Search with debounce
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const pf = await loadPagefind();
      if (!pf) {
        setLoading(false);
        setSearched(true);
        return;
      }

      const search = await pf.search(query, {
        filters: {},
      });

      const dataResults = await Promise.all(
        search.results.slice(0, 15).map((r) => r.data()),
      );

      // Build result groups (parent page + its sub-results)
      const groups: { parent: SearchResult; children: SearchResult[] }[] = [];

      for (const data of dataResults) {
        if (!data.url.startsWith(`/${locale}/`)) continue;

        const parent: SearchResult = {
          url: data.url,
          title: data.meta?.title ?? data.url,
          excerpt: data.excerpt ?? "",
          breadcrumb: breadcrumbFromUrl(data.url),
        };

        const children: SearchResult[] = [];
        if (data.sub_results) {
          for (const sub of data.sub_results.slice(0, 2)) {
            if (sub.title === data.meta?.title) continue;
            children.push({
              url: sub.url,
              title: sub.title,
              excerpt: sub.excerpt ?? "",
              subResult: true,
            });
          }
        }

        groups.push({ parent, children });
      }

      // Sort groups by title relevance to the query
      groups.sort((a, b) =>
        titleMatchScore(b.parent.title, query) - titleMatchScore(a.parent.title, query)
      );

      // Flatten back: parent followed by its sub-results
      const items: SearchResult[] = [];
      for (const group of groups) {
        items.push(group.parent);
        items.push(...group.children);
      }

      setResults(items);
      setActiveIndex(0);
      setSearched(true);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, locale]);

  // Keyboard navigation inside modal
  function handleModalKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      closeModal();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? Math.max(results.length - 1, 0) : prev - 1,
      );
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      globalThis.location.href = results[activeIndex].url;
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector("[data-active='true']");
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const shortcutLabel = isMac ? "\u2318K" : "Ctrl K";

  // Trigger button
  const trigger =
    variant === "mobile" ? (
      <button
        type="button"
        onClick={openModal}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        aria-label="Search"
      >
        <Icon name="Search" size={20} />
      </button>
    ) : (
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        <Icon name="Search" size={16} className="shrink-0" />
        <span className="flex-1 text-left">{placeholder}</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-app-background text-xs font-mono text-muted-foreground">
          {shortcutLabel}
        </kbd>
      </button>
    );

  // Modal content
  const modal = open
    ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          onClick={closeModal}
          onKeyDown={handleModalKeyDown}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Dialog */}
          <div
            className="relative w-full max-w-xl mx-4 rounded-xl border border-border bg-app-background shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Icon name="Search" size={18} className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                >
                  <Icon name="X" size={16} />
                </button>
              )}
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Icon name="Loader2" size={20} className="inline-block animate-spin" />
                </div>
              )}

              {!loading && searched && results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {noResults}
                </div>
              )}

              {!loading && results.length > 0 && (
                <ul className="py-2">
                  {results.map((result, i) => (
                    <li key={`${result.url}-${i}`}>
                      <a
                        href={result.url}
                        data-active={i === activeIndex}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                          i === activeIndex
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        } ${result.subResult ? "pl-10" : ""}`}
                      >
                        <Icon
                          name={result.subResult ? "Hash" : "FileText"}
                          size={16}
                          className={`shrink-0 mt-0.5 ${i === activeIndex ? "text-primary" : ""}`}
                        />
                        <div className="flex-1 min-w-0">
                          {result.breadcrumb && (
                            <div className="text-[11px] text-muted-foreground/70 truncate mb-0.5">
                              {result.breadcrumb}
                            </div>
                          )}
                          <div className={`text-sm font-medium truncate ${i === activeIndex ? "text-foreground" : ""}`}>
                            {result.title}
                          </div>
                          {result.excerpt && (
                            <div
                              className="text-xs text-muted-foreground mt-0.5 line-clamp-2 [&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm [&_mark]:px-0.5"
                              dangerouslySetInnerHTML={{ __html: result.excerpt }}
                            />
                          )}
                        </div>
                        {i === activeIndex && (
                          <Icon name="CornerDownLeft" size={14} className="shrink-0 mt-0.5 text-muted-foreground" />
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {!loading && !searched && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {placeholder}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">&uarr;</kbd>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">&darr;</kbd>
                <span className="ml-0.5">navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">&crarr;</kbd>
                <span className="ml-0.5">select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">esc</kbd>
                <span className="ml-0.5">close</span>
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {trigger}
      {modal}
    </>
  );
}
