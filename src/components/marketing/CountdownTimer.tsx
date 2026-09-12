import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetDate: Date | null;
  fallbackLabel?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const LABELS = ["Giorni", "Ore", "Minuti", "Secondi"] as const;

export function CountdownTimer({
  targetDate,
  fallbackLabel = "Lancio previsto primavera 2026 — iscriviti per essere avvisato",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(
    targetDate ? calcTimeLeft(targetDate) : null,
  );

  useEffect(() => {
    if (!targetDate) return;
    setTimeLeft(calcTimeLeft(targetDate));
    const id = setInterval(() => {
      setTimeLeft(calcTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate || !timeLeft) {
    return (
      <p className="text-sm text-slate-600 text-center">{fallbackLabel}</p>
    );
  }

  const values = [timeLeft.days, timeLeft.hours, timeLeft.minutes, timeLeft.seconds];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {values.map((val, i) => (
        <div
          key={LABELS[i]}
          className="flex flex-col items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] p-4"
        >
          <span className="text-3xl font-bold tabular-nums text-slate-900">
            {String(val).padStart(2, "0")}
          </span>
          <span className="text-sm text-slate-600">{LABELS[i]}</span>
        </div>
      ))}
    </div>
  );
}
