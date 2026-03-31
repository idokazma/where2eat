import { NextResponse } from 'next/server';
import { getAllEpisodes } from '@/lib/data/extractor-loader';

export async function GET() {
  try {
    const episodes = getAllEpisodes();
    return NextResponse.json({ episodes, count: episodes.length });
  } catch (error) {
    console.error('Error loading episodes:', error);
    return NextResponse.json({ episodes: [], count: 0 });
  }
}
