import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface BlogLayoutProps {
  children: React.ReactNode;
  showBackLink?: boolean;
}

export default function BlogLayout({ children, showBackLink = false }: BlogLayoutProps) {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Header — same style as landing page */}
      <div className="dark">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <span className="text-lg font-bold">F</span>
                </div>
                <span className="text-xl font-bold text-foreground">Forfettino</span>
              </Link>
              {showBackLink && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <Link
                    to="/blog"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Blog
                  </Link>
                </>
              )}
            </div>
            <nav aria-label="Navigazione" className="hidden items-center gap-6 md:flex">
              <Link to="/#il-problema" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Il Problema
              </Link>
              <Link to="/#come-funziona" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Come Funziona
              </Link>
              <Link to="/#calcolatore" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Calcolatore
              </Link>
              <Link to="/#prezzi" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Prezzi
              </Link>
              <Link to="/blog" className="text-sm text-foreground font-medium transition-colors">
                Blog
              </Link>
              <Link to="/#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                FAQ
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              {!loading && user ? (
                <Button asChild>
                  <Link to="/dashboard">
                    Vai alla Dashboard
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="hidden sm:inline-flex text-white hover:text-white/80" asChild>
                    <Link to="/login">Accedi</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/login">
                      <span className="sm:hidden">Inizia</span>
                      <span className="hidden sm:inline">Inizia gratis</span>
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/" className="font-display font-bold text-lg text-slate-900">
              Forfettino
            </Link>
            <div className="flex items-center gap-6 text-sm text-slate-600">
              <Link to="/blog" className="hover:text-slate-900 transition-colors">Blog</Link>
              <Link to="/privacy-policy" className="hover:text-slate-900 transition-colors">Privacy</Link>
              <Link to="/cookie-policy" className="hover:text-slate-900 transition-colors">Cookie</Link>
              <Link to="/terms" className="hover:text-slate-900 transition-colors">Termini</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
