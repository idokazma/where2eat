import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const res = await fetch(`${FASTAPI_URL}/api/episodes/${videoId}`, {
      headers: { 'Origin': 'http://localhost:3003' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Episode ${videoId} not found` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching episode detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch episode' },
      { status: 500 }
    );
  }
}
