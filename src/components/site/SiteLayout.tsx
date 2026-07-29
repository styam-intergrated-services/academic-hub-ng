import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import akceLogo from "@/assets/akce-logo.asset.json";

const NAV = [
  { to: "/about", label: "About" },
  { to: "/admissions", label: "Admissions" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header
        className={`sticky top-0 z-50 border-x-0 border-t-0 border-b bg-background/92 backdrop-blur-xl transition-shadow duration-500 ${
          scrolled ? "shadow-[0_10px_30px_-24px_oklch(0.2_0.06_260/0.6)]" : "shadow-none"
        }`}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 h-16 sm:h-20">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={akceLogo.url}
              alt="Aminu Kano College of Education logo"
              className="h-10 w-10 shrink-0 rounded-xl bg-white object-cover p-0.5 shadow-sm sm:h-12 sm:w-12"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-serif text-base font-bold text-primary sm:text-lg">AKCOE Portal</div>
              <div className="hidden truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:block">
                Aminu Kano College of Education
              </div>
            </div>
          </Link>

          <nav className="flex shrink-0 items-center gap-1">
            <div className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="relative rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  activeProps={{ className: "text-primary" }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
            <Link to="/auth" search={{ next: undefined }} className="hidden sm:block">
              <Button className="shine rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                Sign in <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-primary md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </nav>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t bg-background/95 backdrop-blur md:hidden"
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
                {NAV.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {n.label}
                  </Link>
                ))}
                <Link to="/auth" search={{ next: undefined }} onClick={() => setOpen(false)} className="mt-2">
                  <Button className="w-full rounded-xl">Sign in</Button>
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t bg-aurora">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src={akceLogo.url}
                alt=""
                aria-hidden
                className="h-11 w-11 rounded-xl bg-white object-cover p-0.5"
                loading="lazy"
              />
              <div className="font-serif text-lg font-bold text-primary">Aminu Kano College of Education</div>
            </div>
            <p className="mt-4 max-w-sm text-muted-foreground">
              No. 2 Ruga Kings Garden, behind Total Fueling Station, Airport Road, Kano, Kano State, Nigeria.
            </p>
            <div className="gold-rule mt-6 w-40" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Portal</div>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              <li><Link to="/about" className="transition-colors hover:text-primary">About the College</Link></li>
              <li><Link to="/admissions" className="transition-colors hover:text-primary">Admissions</Link></li>
              <li><Link to="/contact" className="transition-colors hover:text-primary">Contact us</Link></li>
              <li><Link to="/auth" search={{ next: undefined }} className="transition-colors hover:text-primary">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Get in touch</div>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              <li><a className="transition-colors hover:text-primary" href="mailto:info@akcoekano.com">info@akcoekano.com</a></li>
              <li><a className="transition-colors hover:text-primary" href="mailto:registry@akcoekano.com">registry@akcoekano.com</a></li>
              <li>
                <a className="transition-colors hover:text-primary" href="https://www.akcoekano.com" rel="noreferrer">
                  www.akcoekano.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Aminu Kano College of Education. All rights reserved.</span>
            <span className="uppercase tracking-[0.2em]">Kano · Nigeria</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
