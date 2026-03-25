'use client';

import { UtensilsCrossed, MessageCircle } from 'lucide-react';

interface MentionLevelBadgeProps {
  mentionLevel: 'נטעם' | 'הוזכר';
  size?: 'sm' | 'md';
  className?: string;
}

export function MentionLevelBadge({
  mentionLevel,
  size = 'sm',
  className = '',
}: MentionLevelBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
  };

  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  if (mentionLevel === 'נטעם') {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ${sizeClasses[size]} ${className}`}
      >
        <UtensilsCrossed className={iconSize} />
        <span>נטעם</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800 ${sizeClasses[size]} ${className}`}
    >
      <MessageCircle className={iconSize} />
      <span>הוזכר</span>
    </span>
  );
}
