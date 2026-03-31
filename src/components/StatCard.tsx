import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  colorClass: string;
  icon?: LucideIcon;
}

export function StatCard({ label, value, colorClass, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[100px] flex-1">
      <span className="text-slate-400 text-xs mb-1">{label}</span>
      <div className={cn('text-xl font-bold mb-1', colorClass)}>{value}</div>
      {Icon && <Icon size={16} className="text-slate-300" />}
    </div>
  );
}
