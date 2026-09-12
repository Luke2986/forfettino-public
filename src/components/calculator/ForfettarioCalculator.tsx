import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCurrency,
  calculateTaxableAmount,
  calculateTax,
  calculateInps,
  calculateTaxAdvances,
  calculateInpsAdvances,
  subtractMoney,
  sumMoney,
} from "@/lib/money";
import {
  Calculator,
  ArrowRight,
  Wallet,
  TrendingDown,
  Info,
  Landmark,
  Receipt,
  CalendarClock,
} from "lucide-react";

const ATECO_PRESETS = [
  { code: "62.01", description: "Produzione software", coefficient: 67 },
  { code: "62.02", description: "Consulenza informatica", coefficient: 78 },
  { code: "70.22", description: "Consulenza gestionale", coefficient: 78 },
  { code: "73.11", description: "Agenzie pubblicitarie", coefficient: 78 },
  { code: "74.10", description: "Design e comunicazione visiva", coefficient: 78 },
  { code: "74.20", description: "Attività fotografiche", coefficient: 78 },
  { code: "74.90", description: "Altre attività professionali", coefficient: 78 },
  { code: "85.59", description: "Formazione e corsi", coefficient: 78 },
  { code: "63.11", description: "Elaborazione dati e hosting", coefficient: 67 },
  { code: "47.91", description: "Commercio elettronico", coefficient: 40 },
  { code: "96.09", description: "Altri servizi alla persona", coefficient: 67 },
  { code: "custom", description: "Inserisci manualmente", coefficient: 0 },
];

type Variant = "teaser" | "full";

interface ForfettarioCalculatorProps {
  variant: Variant;
}

export function ForfettarioCalculator({ variant }: ForfettarioCalculatorProps) {
  const [grossRevenue, setGrossRevenue] = useState<string>("30000");
  const [selectedAteco, setSelectedAteco] = useState<string>("62.02");
  const [customCoefficient, setCustomCoefficient] = useState<string>("78");
  const [taxRate, setTaxRate] = useState<string>("15");
  const [inpsRate, setInpsRate] = useState<string>("26.07");

  const profitCoefficient = useMemo(() => {
    if (selectedAteco === "custom") {
      return parseFloat(customCoefficient) || 0;
    }
    return ATECO_PRESETS.find((p) => p.code === selectedAteco)?.coefficient ?? 78;
  }, [selectedAteco, customCoefficient]);

  const results = useMemo(() => {
    const gross = parseFloat(grossRevenue) || 0;
    const tax = parseFloat(taxRate) || 15;
    const inps = parseFloat(inpsRate) || 26.07;

    const taxableAmount = calculateTaxableAmount(gross, profitCoefficient);
    const taxAmount = calculateTax(taxableAmount, tax);
    const inpsAmount = calculateInps(taxableAmount, inps);
    const totalWithholding = sumMoney(taxAmount, inpsAmount);
    const netSpendable = subtractMoney(gross, totalWithholding);

    const taxAdvances = calculateTaxAdvances(taxAmount);
    const inpsAdvances = calculateInpsAdvances(inpsAmount);

    const juneTotal = sumMoney(taxAmount, inpsAmount, taxAdvances.first, inpsAdvances.first);
    const novemberTotal = sumMoney(
      taxAdvances.hasTwoPayments ? taxAdvances.second : taxAdvances.single,
      inpsAdvances.second
    );

    return {
      gross,
      taxableAmount,
      taxAmount,
      inpsAmount,
      totalWithholding,
      netSpendable,
      netPercentage: gross > 0 ? Math.round((netSpendable / gross) * 100) : 0,
      taxAdvances,
      inpsAdvances,
      juneTotal,
      novemberTotal,
      yearTotalPayments: sumMoney(juneTotal, novemberTotal),
    };
  }, [grossRevenue, profitCoefficient, taxRate, inpsRate]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs - 2 cols */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">I tuoi dati</CardTitle>
            <CardDescription>Inserisci ricavi e parametri fiscali</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="calc-gross">Ricavi lordi annui (EUR)</Label>
              <Input
                id="calc-gross"
                type="number"
                min="0"
                step="1000"
                value={grossRevenue}
                onChange={(e) => setGrossRevenue(e.target.value)}
                placeholder="30000"
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                La somma di tutti gli incassi lordi nell'anno fiscale
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calc-ateco">Codice ATECO</Label>
              <Select value={selectedAteco} onValueChange={setSelectedAteco}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona codice ATECO" />
                </SelectTrigger>
                <SelectContent>
                  {ATECO_PRESETS.map((preset) => (
                    <SelectItem key={preset.code} value={preset.code}>
                      {preset.code === "custom"
                        ? "Inserisci manualmente"
                        : `${preset.code} — ${preset.description} (${preset.coefficient}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAteco === "custom" && (
                <div className="mt-2">
                  <Label htmlFor="calc-custom-coeff">Coefficiente di redditività (%)</Label>
                  <Input
                    id="calc-custom-coeff"
                    type="number"
                    min="0"
                    max="100"
                    value={customCoefficient}
                    onChange={(e) => setCustomCoefficient(e.target.value)}
                    placeholder="78"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Coefficiente: {profitCoefficient}% — determina la quota di ricavi tassabile
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calc-tax-rate">Imposta sostitutiva</Label>
              <Select value={taxRate} onValueChange={setTaxRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5% — Primi 5 anni di attività</SelectItem>
                  <SelectItem value="15">15% — Aliquota ordinaria</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                L. 190/2014: 5% per i primi 5 anni, poi 15%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calc-inps">Aliquota INPS Gestione Separata</Label>
              <Input
                id="calc-inps"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={inpsRate}
                onChange={(e) => setInpsRate(e.target.value)}
                placeholder="26.07"
              />
              <p className="text-xs text-muted-foreground">
                26,07% nel 2026 per professionisti senza altra copertura previdenziale
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results - 3 cols */}
      <div className="lg:col-span-3 space-y-6">
        {/* Netto Spendibile hero */}
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Il tuo Netto Spendibile</p>
                <p className="text-xs text-muted-foreground">Quanto puoi davvero spendere, senza rischi</p>
              </div>
            </div>
            <div className="text-4xl font-bold text-primary md:text-5xl">
              {formatCurrency(results.netSpendable)}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">{results.netPercentage}%</strong> dei ricavi lordi — devi accantonare{" "}
              <strong className="text-destructive">{formatCurrency(results.totalWithholding)}</strong> per tasse e contributi
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Netto: puoi spendere
              </span>
              <span className="flex items-center gap-1.5 text-destructive">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                Accantonato: non toccarlo
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3 summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Reddito Imponibile</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(results.taxableAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(results.gross)} x {profitCoefficient}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <p className="text-xs font-medium text-muted-foreground">Imposta Sostitutiva</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(results.taxAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(results.taxableAmount)} x {taxRate}%
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1.5 leading-snug">
                Al primo anno non ci sono contributi INPS pregressi da dedurre. Dal secondo anno l'imposta si riduce.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="h-4 w-4 text-blue-500" />
                <p className="text-xs font-medium text-muted-foreground">Contributi INPS</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(results.inpsAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(results.taxableAmount)} x {inpsRate}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Teaser → CTA to standalone page */}
        {variant === "teaser" && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
            <p className="text-lg font-medium text-foreground">
              Vuoi lo <strong>scadenziario completo</strong> con importi di giugno e novembre?
            </p>
            <Button size="lg" className="mt-4" asChild>
              <Link to="/calcolatore-forfettario">
                Vedi il calcolo completo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {/* Full → Scadenziario + spiegazione (unblurred) */}
        {variant === "full" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Scadenziario Pagamenti
                  <span className="ml-1 inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
                    Primo anno
                  </span>
                </CardTitle>
                <CardDescription>
                  Questo è lo scenario del <strong>primo anno di attività</strong>: non hai versato acconti l'anno precedente, quindi a giugno paghi il saldo pieno più i primi acconti.
                  A giugno e novembre paghi due cose insieme: il <strong>saldo</strong> dell'anno appena chiuso e gli <strong>acconti</strong> sull'anno in corso. Non è un doppio conteggio — sono due anni fiscali diversi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Giugno — Scadenza 30/06 (2026: 20/07)</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo anno precedente</p>
                      <div className="space-y-1 text-sm pl-2 border-l-2 border-muted">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Imposta</span>
                          <span>{formatCurrency(results.taxAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">INPS</span>
                          <span>{formatCurrency(results.inpsAmount)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Acconti anno corrente</p>
                      <div className="space-y-1 text-sm pl-2 border-l-2 border-primary/30">
                        {results.taxAdvances.hasTwoPayments && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">1° acconto imposta (40%)</span>
                            <span>{formatCurrency(results.taxAdvances.first)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">1° acconto INPS (50%)</span>
                          <span>{formatCurrency(results.inpsAdvances.first)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Totale Giugno</span>
                      <span className="text-primary">{formatCurrency(results.juneTotal)}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Novembre — Scadenza 30/11</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Acconti anno corrente</p>
                      <div className="space-y-1 text-sm pl-2 border-l-2 border-primary/30">
                        {results.taxAdvances.hasTwoPayments ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">2° acconto imposta (60%)</span>
                            <span>{formatCurrency(results.taxAdvances.second)}</span>
                          </div>
                        ) : results.taxAdvances.single > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Acconto imposta unico</span>
                            <span>{formatCurrency(results.taxAdvances.single)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">2° acconto INPS (50%)</span>
                          <span>{formatCurrency(results.inpsAdvances.second)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Totale Novembre</span>
                      <span className="text-primary">{formatCurrency(results.novemberTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-muted/50 p-3 flex justify-between items-center">
                  <span className="text-sm font-medium">Totale annuo da versare</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(results.yearTotalPayments)}
                  </span>
                </div>

                <div className="mt-3 flex gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    <strong className="text-amber-300">Dal secondo anno in poi</strong> gli acconti già versati compensano quasi tutto il saldo: il totale annuo si stabilizza intorno a {formatCurrency(results.totalWithholding)}, non {formatCurrency(results.yearTotalPayments)}.
                    Il primo anno è più impegnativo perché parti senza acconti pregressi.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Come funziona il calcolo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Il Regime Forfettario (L. 190/2014, art. 1, commi 54-89) prevede una tassazione
                  semplificata per professionisti e imprese individuali con ricavi fino a 85.000 EUR annui.
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li><strong>Reddito imponibile</strong> = Ricavi lordi x Coefficiente di redditività ATECO</li>
                  <li>
                    <strong>Imposta sostitutiva</strong> = Reddito imponibile x Aliquota (5% o 15%)
                    <br />
                    <span className="text-muted-foreground/60 text-xs">Al primo anno: nessuna deduzione INPS pregressa. Dal 2° anno si deducono i contributi versati.</span>
                  </li>
                  <li><strong>Contributi INPS</strong> = Reddito imponibile x Aliquota Gestione Separata</li>
                  <li><strong>Netto spendibile</strong> = Ricavi lordi - Imposta - INPS</li>
                </ol>
                <div className="mt-3 rounded-lg bg-muted/60 p-3 space-y-1.5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground/80">Cosa copre:</strong>{" "}
                    professionisti iscritti alla Gestione Separata INPS con Regime Forfettario. Simulazione primo anno di attività (senza contributi INPS pregressi da dedurre).
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground/80">Cosa non copre:</strong>{" "}
                    casse professionali (Inarcassa, Cassa Forense, ENPAM, CIPAG, ecc.), INPS Artigiani/Commercianti, deducibilità contributi, rivalsa in fattura.
                  </p>
                  <p className="text-xs text-muted-foreground/70 italic leading-relaxed">
                    Stima indicativa — per la dichiarazione dei redditi rivolgersi a un commercialista. Aliquote e soglie aggiornate al 2026.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
