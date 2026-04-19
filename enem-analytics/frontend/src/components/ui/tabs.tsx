"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface TabDefinition {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabDefinition[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Seções da escola"
      className={cn(
        "flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white rounded-t-2xl px-2",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              "border-b-2 -mb-[1px]",
              isActive
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200"
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span
                className={cn(
                  "ml-0.5 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  active: string;
  children: React.ReactNode;
}

export function TabPanel({ id, active, children }: TabPanelProps) {
  if (id !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className="focus:outline-none"
    >
      {children}
    </div>
  );
}
