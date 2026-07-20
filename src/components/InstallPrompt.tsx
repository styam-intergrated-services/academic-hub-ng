import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "akcoe-install-dismissed-at";
const DISMISS_DAYS = 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function dismissedRecently() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInIframe() || isStandalone() || dismissedRecently()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    // iOS fallback (no beforeinstallprompt)
    if (isIOS()) {
      setShowIOSHint(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setVisible(false);
    else dismiss();
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:w-96 z-[60] rounded-lg border bg-background shadow-lg p-4 flex items-start gap-3">
      <div className="mt-0.5 h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Download className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">Install AKCOE Portal</div>
        {showIOSHint ? (
          <p className="text-xs text-muted-foreground mt-1">
            Tap the <span className="font-medium">Share</span> icon in Safari, then{" "}
            <span className="font-medium">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Install this portal on your device for quick access — no browser tabs.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {!showIOSHint && (
            <Button size="sm" onClick={install}>Install</Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
        </div>
      </div>
      <button aria-label="Dismiss" onClick={dismiss} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
