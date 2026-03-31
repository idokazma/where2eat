import { NextResponse } from 'next/server';
import { getAllRestaurants } from '@/lib/data/extractor-loader';

export async function GET() {
  try {
    const restaurants = getAllRestaurants();
    return NextResponse.json({ restaurants, count: restaurants.length });
  } catch (error) {
    console.error('Error loading restaurants:', error);
    return NextResponse.json({ restaurants: [], count: 0 });
  }
}
