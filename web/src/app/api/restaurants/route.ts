import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * Resolve the data directory with fallback paths.
 * process.cwd() may vary between local dev (web/) and Vercel deployment.
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

export async function GET() {
  try {
    const dataDir = await resolveDataDir();
    if (!dataDir) {
      console.warn('[API] No data directory found');
      return NextResponse.json({ restaurants: [], count: 0 });
    }

    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const restaurants = [];
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        restaurants.push(JSON.parse(content));
      } catch {
        console.warn(`Failed to read ${file}`);
      }
    }

    return NextResponse.json({ restaurants, count: restaurants.length });
  } catch (error) {
    console.error('Error loading restaurants:', error);
    return NextResponse.json({ error: 'Failed to load restaurants' }, { status: 500 });
  }
}
