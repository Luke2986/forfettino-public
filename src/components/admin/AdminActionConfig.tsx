import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings2, Pencil } from "lucide-react";
import { useActionConfig } from "@/hooks/useActionConfig";
import { AdminActionConfigEditor } from "./AdminActionConfigEditor";
import type { ActionConfig } from "@/lib/contribution-helpers";

export function AdminActionConfig() {
  const { data: configs, isLoading } = useActionConfig();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ActionConfig | null>(null);

  const headerCellClass =
    "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  const handleEdit = (config: ActionConfig) => {
    setEditingConfig(config);
    setEditorOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-5 w-5 text-teal-500" />
            Configurazione Punti
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded" />
              ))}
            </div>
          ) : !configs || configs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessuna configurazione trovata.
            </p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Configurazione azioni e punteggi</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className={headerCellClass}>Azione</TableHead>
                  <TableHead className={`${headerCellClass} text-right`}>Punti</TableHead>
                  <TableHead className={headerCellClass}>Frequenza</TableHead>
                  <TableHead className={`${headerCellClass} text-right`}>Modifica</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.actionType}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-sm ${config.colorBg}`}
                        />
                        {config.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      +{config.points} pt
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {config.frequencyLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEdit(config)}
                        title="Modifica punti"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Editor dialog — key forces remount when switching configs */}
      {editorOpen && editingConfig && (
        <AdminActionConfigEditor
          key={editingConfig.actionType}
          config={editingConfig}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}
    </>
  );
}
