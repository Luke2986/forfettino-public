import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("PageErrorBoundary caught an error:", error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    window.location.href = "/?stay=1";
  };

  private handleLogout = async () => {
    sessionStorage.removeItem("otp_pending");
    sessionStorage.removeItem("was_password_login");
    sessionStorage.removeItem("backup_mfa_verified");
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex justify-center px-4 mt-8">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Qualcosa è andato storto</CardTitle>
              <CardDescription>
                Si è verificato un errore nel caricamento di questa pagina. Puoi
                riprovare o tornare alla dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV !== "production" && this.state.error && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleRetry} className="w-full gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Riprova
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="w-full gap-2"
                >
                  <Home className="h-4 w-4" />
                  Torna alla Home
                </Button>
                <Button
                  variant="ghost"
                  onClick={this.handleLogout}
                  className="w-full gap-2 text-muted-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Esci e torna al login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
