'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Play, Youtube } from 'lucide-react';
import { pipelineApi } from '@/lib/api';
import { queryKeys } from '@/lib/constants';

export function AnalyzeInput() {
  const queryClient = useQueryClient();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const analyzeMutation = useMutation({
    mutationFn: (url: string) => pipelineApi.analyzeVideo(url),
    onSuccess: () => {
      setYoutubeUrl('');
      setSuccessMessage('Video queued for analysis.');
      setTimeout(() => setSuccessMessage(''), 3000);
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (youtubeUrl.trim()) {
        analyzeMutation.mutate(youtubeUrl.trim());
      }
    }
  };

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <Youtube className="size-3.5 text-red-500" />
        Analyze Video
      </h2>
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={youtubeUrl}
          onChange={(e) => {
            setYoutubeUrl(e.target.value);
            if (analyzeMutation.isError) analyzeMutation.reset();
          }}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm flex-1"
        />
        <Button
          onClick={() => analyzeMutation.mutate(youtubeUrl.trim())}
          disabled={!youtubeUrl.trim() || analyzeMutation.isPending}
          size="sm"
          className="h-8 px-3 shrink-0"
        >
          {analyzeMutation.isPending ? (
            <RefreshCw className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          <span className="ml-1.5">
            {analyzeMutation.isPending ? 'Starting...' : 'Analyze'}
          </span>
        </Button>
      </div>
      {analyzeMutation.isError && (
        <p className="text-xs text-red-600 mt-1">
          {(analyzeMutation.error as any)?.error || (analyzeMutation.error as any)?.detail || 'Failed to start analysis'}
        </p>
      )}
      {successMessage && (
        <p className="text-xs text-green-600 mt-1">{successMessage}</p>
      )}
    </section>
  );
}
