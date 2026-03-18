import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * Resolve the data directory with fallback paths.
 */
async function resolveDataDir(): Promise<string | null> {
  const possiblePaths = [
    path.join(process.cwd(), '..', 'data', 'restaurants'),
    path.join(process.cwd(), 'data', 'restaurants'),
  ];

  for (const dir of possiblePaths) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      // Try next path
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const dataDir = await resolveDataDir();
    if (!dataDir) {
      return NextResponse.json({ error: 'Data directory not found' }, { status: 500 });
    }

    const files = await fs.readdir(dataDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        const restaurant = JSON.parse(content);
        if (restaurant.google_places?.place_id === id || restaurant.id === id) {
          return NextResponse.json(restaurant);
        }
      } catch {
        // Skip unreadable files
      }
    }
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Failed to load restaurant' }, { status: 500 });
  }
}
