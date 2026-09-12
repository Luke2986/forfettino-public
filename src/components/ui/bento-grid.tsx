import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const BentoGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-1 lg:grid-cols-3 gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href: _href,
  cta: _cta,
}: {
  name: string;
  className: string;
  background: ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
  href?: string;
  cta?: string;
}) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-1 lg:col-span-3 flex flex-col justify-between overflow-hidden rounded-xl",
      "bg-white/[0.05] [box-shadow:0_0_0_1px_rgba(255,255,255,.06),0_2px_4px_rgba(0,0,0,.2),0_12px_24px_rgba(0,0,0,.15)]",
      className,
    )}
  >
    <div>{background}</div>
    <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-4 lg:p-6 transition-all duration-300">
      <Icon className="h-8 w-8 lg:h-12 lg:w-12 origin-left transform-gpu text-slate-300 transition-all duration-300 ease-in-out group-hover:scale-75" />
      <h3 className="text-lg lg:text-xl font-semibold text-slate-200">
        {name}
      </h3>
      <p className="max-w-lg text-sm text-slate-300">{description}</p>
    </div>
    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-white/[.03]" />
  </div>
);

export { BentoCard, BentoGrid };
