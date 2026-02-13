import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_PLACES_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
  '';

/**
 * Detect whether a photo reference is from the new Places API.
 * New API references look like: "places/PLACE_ID/photos/PHOTO_ID"
 */
function isNewApiReference(reference: string): boolean {
  return reference.startsWith('places/') && reference.includes('/photos/');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  if (!reference) {
    return NextResponse.json({ error: 'Missing photo reference' }, { status: 400 });
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const maxWidth = searchParams.get('maxwidth') || '800';

  // Build the correct Google URL based on API format
  const googleUrl = isNewApiReference(reference)
    ? `https://places.googleapis.com/v1/${reference}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`
    : `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${encodeURIComponent(reference)}&key=${GOOGLE_PLACES_API_KEY}`;

  try {
    const response = await fetch(googleUrl, { redirect: 'follow' });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch photo' },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 502 });
  }
}
