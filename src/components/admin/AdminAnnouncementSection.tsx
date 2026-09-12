import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Copy, Check, ExternalLink, MailOpen, RefreshCcw } from "lucide-react";
import type { AnnouncementReadStats } from "@/hooks/useAdminStats";
import { useAdminAnnouncements, type AdminAnnouncementRow } from "@/hooks/useAdminAnnouncements";
import { formatDateIT } from "@/lib/schedule-helpers";
import { NewAnnouncementDialog, type ResendDefaults } from "./NewAnnouncementDialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PAGE_SIZE = 10;

const audienceLabels: Record<string, string> = {
  all: "Tutti",
  pro: "Solo Pro",
  free: "Solo Free",
};

function AnnouncementDetailDialog({
  announcement,
  open,
  onOpenChange,
  readStats,
  onResend,
}: {
  announcement: AdminAnnouncementRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readStats?: AnnouncementReadStats;
  onResend?: (announcement: AdminAnnouncementRow) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!announcement) return null;

  const handleCopy = async () => {
    const text = `${announcement.title}\n\n${announcement.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden"
        data-testid={`announcement-detail-${announcement.id}`}
      >
        <div className="flex flex-col" style={{ maxHeight: "80vh" }}>
          {/* Header */}
          <div className="px-6 pt-6 pr-12 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <Badge variant="outline" className="text-xs">
                {audienceLabels[announcement.target_audience] ?? announcement.target_audience}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto" data-testid="announcement-detail-stats">
                {announcement.published_at ? formatDateIT(announcement.published_at) : "—"} · {announcement.sent_count} invii
                {readStats && (
                  <> · {readStats.read} letti ({readStats.openRate}%)</>
                )}
              </span>
            </div>
            <DialogTitle className="text-base font-semibold leading-snug">
              {announcement.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Dettaglio annuncio: {announcement.title}
            </DialogDescription>
          </div>

          {/* Body scrollabile */}
          <div
            className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed select-text overflow-y-auto px-6 py-4"
            style={{ minHeight: 0, flex: "1 1 0%" }}
          >
            {announcement.body}
          </div>

          {/* Action URL se presente */}
          {announcement.action_url && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-6 py-2 border-t shrink-0">
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{announcement.action_label || announcement.action_url}</span>
            </div>
          )}

          {/* Footer con bottoni Re-invia + Copia */}
          <div className="px-6 pb-6 pt-3 border-t shrink-0 flex gap-2">
            {onResend && (announcement as any).target_type !== "individual" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                onClick={() => onResend(announcement)}
                data-testid="announcement-resend-btn"
              >
                <RefreshCcw className="h-4 w-4" />
                Re-invia
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={
                onResend && (announcement as any).target_type !== "individual"
                  ? "flex-1 gap-2"
                  : "w-full gap-2"
              }
              onClick={handleCopy}
              data-testid="announcement-copy-btn"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiato!" : "Copia testo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminAnnouncementSection({
  announcementReadCounts,
}: {
  announcementReadCounts?: Record<string, AnnouncementReadStats>;
} = {}) {
  const { data: announcements = [], isLoading } = useAdminAnnouncements();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AdminAnnouncementRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(announcements.length / PAGE_SIZE));
  const paginatedAnnouncements = useMemo(
    () => announcements.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [announcements, currentPage],
  );
  const [resendData, setResendData] = useState<{
    defaultValues: ResendDefaults;
    resendTitle: string;
  } | null>(null);

  const handleRowClick = (a: AdminAnnouncementRow) => {
    setSelectedAnnouncement(a);
    setDetailOpen(true);
  };

  const handleResend = (a: AdminAnnouncementRow) => {
    setResendData({
      defaultValues: {
        title: a.title,
        body: a.body,
        actionUrl: a.action_url ?? "",
        actionLabel: a.action_label ?? "",
        targetAudience: a.target_audience as "all" | "pro" | "free",
      },
      resendTitle: a.title,
    });
    setDetailOpen(false);
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Annunci Broadcast
          </CardTitle>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuovo Annuncio
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          )}

          {!isLoading && announcements.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="empty-state">
              Nessun annuncio inviato
            </p>
          )}

          {!isLoading && announcements.length > 0 && (
            <>
              <div className="space-y-3" data-testid="announcements-list">
                {paginatedAnnouncements.map((a) => {
                  const rs = announcementReadCounts?.[a.id];
                  return (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-start justify-between gap-2 sm:gap-4 border-b pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-accent/50 rounded-md transition-colors -mx-2 px-2 py-2"
                      onClick={() => handleRowClick(a)}
                      data-testid={`announcement-row-${a.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-2 sm:line-clamp-1">{a.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {a.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {audienceLabels[a.target_audience] ?? a.target_audience}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {a.sent_count} inv.
                          {rs && (
                            <> · <MailOpen className="inline h-3 w-3 align-text-bottom" /> {rs.read} letti ({rs.openRate}%)</>
                          )}
                          {" · "}{a.published_at ? formatDateIT(a.published_at) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col items-center sm:flex-row sm:justify-between gap-2 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Pagina {currentPage} di {totalPages} ({announcements.length} annunci totali)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((p) => p - 1)}
                      disabled={currentPage === 1}
                    >
                      Precedente
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Successiva
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <NewAnnouncementDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setResendData(null);
        }}
        defaultValues={resendData?.defaultValues}
        resendTitle={resendData?.resendTitle}
      />
      <AnnouncementDetailDialog
        announcement={selectedAnnouncement}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        readStats={selectedAnnouncement ? announcementReadCounts?.[selectedAnnouncement.id] : undefined}
        onResend={handleResend}
      />
    </>
  );
}
