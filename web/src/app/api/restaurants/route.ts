import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), '..', 'data', 'restaurants');

export async function GET() {
  try {
    // Ensure directory exists
    try {
      await fs.access(dataDir);
    } catch {
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
      } catch (err) {
        console.warn(`Failed to read ${file}`);
      }
    }

    return NextResponse.json({ restaurants, count: restaurants.length });
  } catch (error) {
    console.error('Error loading restaurants:', error);
    return NextResponse.json({ error: 'Failed to load restaurants' }, { status: 500 });
  }
}
