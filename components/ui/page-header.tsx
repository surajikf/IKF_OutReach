import { cn } from "@/lib/shared/utils";
import * as React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  belowTitle?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, eyebrow, actions, belowTitle, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col md:flex-row md:items-end justify-between gap-4 px-2 mb-8",
        className
      )}
    >
      <div className="space-y-1">
        {eyebrow && (
          <p className="text-[10px] font-medium text-blue-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {belowTitle && <div className="mt-2">{belowTitle}</div>}
        {subtitle && (
          <p className="text-sm font-medium text-slate-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-3">{actions}</div>}
    </header>
  );
}


