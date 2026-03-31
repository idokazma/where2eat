import { NextResponse } from 'next/server';
import { getEpisodeDetail } from '@/lib/data/extractor-loader';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const detail = getEpisodeDetail(videoId);

    if (!detail) {
      return NextResponse.json({ error: `Episode ${videoId} not found` }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error fetching episode detail:', error);
    return NextResponse.json({ error: 'Failed to fetch episode' }, { status: 500 });
  }
}
