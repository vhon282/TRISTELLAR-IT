import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  Archive,
  Clock,
  ShieldAlert,
  BookmarkCheck,
} from 'lucide-react';

interface StatusBadgeProps {
  value: string;
  size?: 'sm' | 'md';
}

const BADGE_MAP: Record<
  string,
  { classes: string; icon?: React.ReactNode; label?: string }
> = {
  // Operational Statuses
  OPERATIONAL: {
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  DEGRADED: {
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70',
    icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  },
  MAINTENANCE: {
    classes:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/70',
    icon: <Wrench className="w-3.5 h-3.5 shrink-0" />,
  },
  DOWN: {
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70',
    icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  RETIRED: {
    classes:
      'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800/70 dark:text-stone-300 dark:border-stone-700',
    icon: <Archive className="w-3.5 h-3.5 shrink-0" />,
  },

  // Conditions
  GOOD: {
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70',
  },
  FAIR: {
    classes:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/70',
  },
  POOR: {
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70',
  },
  BAD: {
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70',
  },

  // Maintenance / Voucher / Disposal
  Done: {
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  Pending: {
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70',
    icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
  },
  Used: {
    classes:
      'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
  },
  Available: {
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70',
  },
  Expired: {
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70',
  },
  'For Disposal': {
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70',
    icon: <Archive className="w-3.5 h-3.5 shrink-0" />,
  },
  Defective: {
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70',
    icon: <ShieldAlert className="w-3.5 h-3.5 shrink-0" />,
  },
  Keep: {
    classes:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/70',
    icon: <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />,
  },
  Urgent: {
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70',
    icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  },
  'From Jack': {
    classes:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/70',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ value, size = 'sm' }) => {
  const style = BADGE_MAP[value] ?? {
    classes:
      'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap shrink-0 ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${style.classes}`}
    >
      {style.icon}
      <span>{style.label ?? value}</span>
    </span>
  );
};
