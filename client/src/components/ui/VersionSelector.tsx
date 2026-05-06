import { useEffect, useRef, useState } from "react";
import { Icon } from "../atoms/Icon.tsx";
import {
  versions,
  buildVersionRootUrl,
  type VersionConfig,
} from "../../config/versions.ts";

interface VersionSelectorProps {
  /** Current version id (e.g. "v1" or "v2"). */
  currentVersion: string;
  /** Current locale (e.g. "en" or "pt"). */
  locale: string;
  className?: string;
}

export function VersionSelector({
  currentVersion,
  locale,
  className = "",
}: VersionSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current =
    versions.find((v) => v.id === currentVersion) ?? versions[0];

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Switch documentation version"
        className="flex items-center justify-between w-full h-9 px-3 text-sm bg-transparent border border-border rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon name="GitBranch" size={14} className="text-muted-foreground" />
          <span className="truncate">{current.shortLabel}</span>
        </span>
        <Icon
          name="ChevronDown"
          size={14}
          className={`text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Documentation versions"
          className="absolute left-0 right-0 bottom-[calc(100%+8px)] z-50 rounded-lg border border-border bg-app-background shadow-lg overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border/60">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Versions
            </span>
          </div>
          <div className="py-1">
            {versions.map((version) => (
              <VersionMenuItem
                key={version.id}
                version={version}
                locale={locale}
                isCurrent={version.id === current.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface VersionMenuItemProps {
  version: VersionConfig;
  locale: string;
  isCurrent: boolean;
}

function VersionMenuItem({ version, locale, isCurrent }: VersionMenuItemProps) {
  const sharedClasses = `flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
    isCurrent ? "bg-primary/5" : "hover:bg-muted"
  }`;

  const body = (
    <>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          className={`text-sm font-medium truncate ${
            isCurrent ? "text-primary" : "text-foreground"
          }`}
        >
          {version.label}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {version.description}
        </span>
      </div>
      {isCurrent && (
        <Icon
          name="Check"
          size={16}
          className="text-primary shrink-0 mt-0.5"
        />
      )}
    </>
  );

  if (isCurrent) {
    return (
      <div role="menuitem" aria-current="true" className={sharedClasses}>
        {body}
      </div>
    );
  }

  return (
    <a
      href={buildVersionRootUrl(version, locale)}
      role="menuitem"
      className={sharedClasses}
    >
      {body}
    </a>
  );
}
