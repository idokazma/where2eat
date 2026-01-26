'use client';

import { Mic } from 'lucide-react';

interface EpisodeBadgeProps {
  episodeNumber?: number;
  showName?: string;
  videoUrl?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function EpisodeBadge({
  episodeNumber,
  showName = 'פודי',
  videoUrl,
  className = '',
  size = 'md',
}: EpisodeBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-1 gap-1',
    md: 'text-xs px-3 py-2 gap-2',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  const content = (
    <>
      <Mic className={iconSize} />
      <span>
        {episodeNumber ? `פרק ${episodeNumber}` : showName}
        {episodeNumber && showName && ` • ${showName}`}
      </span>
    </>
  );

  const baseClasses = `episode-badge ${sizeClasses[size]} ${className}`;

  if (videoUrl) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} hover:opacity-90 transition-opacity`}
      >
        {content}
      </a>
    );
  }

  return <span className={baseClasses}>{content}</span>;
}
