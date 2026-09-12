import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";

interface ExplanationSheetProps {
    title: string;
    description: string; // Plain language explanation
    formula?: React.ReactNode; // The math formula
    inputs: Array<{ label: string; value: string; note?: string }>; // Current values used
    tldr?: React.ReactNode; // "Too long; didn't read" summary or bottom line
    children?: React.ReactNode; // Custom content if needed
}

export function ExplanationSheet({
    title,
    description,
    formula,
    inputs,
    tldr,
    children
}: ExplanationSheetProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-muted text-muted-foreground transition-colors ml-1"
                    onClick={(e) => e.stopPropagation()} // Prevent card expansion
                    aria-label="Spiegazione calcolo"
                >
                    <HelpCircle className="h-4 w-4" />
                    <span className="sr-only">Spiegazione calcolo</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[400px] overflow-hidden flex flex-col pt-10">
                <SheetHeader className="mb-4">
                    <SheetTitle className="text-xl">{title}</SheetTitle>
                    <SheetDescription className="text-base text-foreground mt-2 font-normal">
                        {description}
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1 -mr-6 pr-6 h-full">
                    <div className="space-y-6 pb-6">

                        {/* Input / Variables Section */}
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Input Reali (Oggi)
                            </h4>
                            <div className="space-y-3">
                                {inputs.map((input, i) => (
                                    <div key={i} className="flex flex-col text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">{input.label}</span>
                                            <span className="font-mono font-medium">{input.value}</span>
                                        </div>
                                        {input.note && (
                                            <span className="text-xs text-muted-foreground/70 mt-0.5 italic">{input.note}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Formula Section */}
                        {formula && (
                            <div className="bg-muted/40 p-4 rounded-lg border border-border/50">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                    La Formula
                                </h4>
                                <div className="font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {formula}
                                </div>
                            </div>
                        )}

                        {/* TLDR / Conclusion */}
                        {tldr && (
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <div className="text-sm text-blue-800 dark:text-blue-300">
                                    <span className="font-semibold block mb-1">In sintesi:</span>
                                    {tldr}
                                </div>
                            </div>
                        )}

                        {children}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
