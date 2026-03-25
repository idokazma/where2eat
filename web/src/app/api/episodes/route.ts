import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';

    const res = await fetch(`${FASTAPI_URL}/api/episodes?limit=${limit}`, {
      headers: { 'Origin': 'http://localhost:3003' },
    });

    if (!res.ok) {
      return NextResponse.json({ episodes: [], count: 0 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return NextResponse.json({ episodes: [], count: 0 });
  }
}
