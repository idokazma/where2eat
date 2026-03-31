import { endpoints } from '../config';
import type { EpisodeSummary, EpisodeDetail } from '@/types/restaurant';

export interface EpisodesListResponse {
  episodes: EpisodeSummary[];
  count: number;
}

export async function fetchEpisodes(limit?: number): Promise<EpisodesListResponse> {
  const params = limit ? { limit: String(limit) } : undefined;
  const res = await fetch(endpoints.episodes.list(params));
  if (!res.ok) {
    throw new Error(`Failed to fetch episodes: ${res.status}`);
  }
  return res.json();
}

export async function fetchEpisodeDetail(videoId: string): Promise<EpisodeDetail> {
  const res = await fetch(endpoints.episodes.detail(videoId));
  if (!res.ok) {
    throw new Error(`Failed to fetch episode ${videoId}: ${res.status}`);
  }
  return res.json();
}
