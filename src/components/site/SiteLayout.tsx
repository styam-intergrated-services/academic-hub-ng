import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import akceLogo from "@/assets/akce-logo.asset.json";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={akceLogo.url}
              alt="Aminu Kano College of Education logo"
              className="h-11 w-11 rounded-md object-cover bg-white p-0.5 shadow-sm"
            />
            <div className="leading-tight">
              <div className="font-serif font-bold text-primary">AKCOE Portal</div>
              <div className="hidden sm:block text-[10px] uppercase tracking-widest text-muted-foreground">
                Aminu Kano College of Education
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            <Link
              to="/about"
              className="hidden sm:inline text-sm text-muted-foreground hover:text-primary px-2 py-1"
            >
              About
            </Link>
            <Link
              to="/contact"
              className="hidden sm:inline text-sm text-muted-foreground hover:text-primary px-2 py-1"
            >
              Contact
            </Link>
            <Link to="/auth">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Sign in</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 grid gap-6 sm:grid-cols-3 text-sm">
          <div>
            <div className="font-serif font-semibold text-primary">Aminu Kano College of Education</div>
            <p className="mt-2 text-muted-foreground">
              No. 2 Ruga Kings Garden, behind Total Fueling Station, Airport Road, Kano, Kano State, Nigeria.
            </p>
          </div>
          <div>
            <div className="font-semibold">Portal</div>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary">About the College</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Contact us</Link></li>
              <li><Link to="/auth" className="hover:text-primary">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold">Get in touch</div>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                <a className="hover:text-primary" href="mailto:info@akcoekano.com">info@akcoekano.com</a>
              </li>
              <li>
                <a className="hover:text-primary" href="https://www.akcoekano.com" rel="noreferrer">
                  www.akcoekano.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground flex justify-between">
            <span>© {new Date().getFullYear()} Aminu Kano College of Education</span>
            <span>AKCOE Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
