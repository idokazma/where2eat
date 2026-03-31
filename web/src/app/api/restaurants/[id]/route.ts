import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantById } from '@/lib/data/extractor-loader';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const restaurant = getRestaurantById(id);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }
    return NextResponse.json(restaurant);
  } catch (error) {
    console.error('Error loading restaurant:', error);
    return NextResponse.json({ error: 'Failed to load restaurant' }, { status: 500 });
  }
}
