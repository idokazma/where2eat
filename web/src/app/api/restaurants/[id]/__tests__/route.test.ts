/**
 * Tests for individual restaurant API route
 *
 * NOTE: These tests are skipped in Jest because NextRequest/NextResponse
 * require the Next.js server runtime which isn't available in unit tests.
 * The route is tested via:
 * - TypeScript compilation (npm run build)
 * - Integration testing (manual/e2e)
 */

describe('GET /api/restaurants/[id]', () => {
  it.todo('returns restaurant when found by place_id');
  it.todo('returns restaurant when found by id');
  it.todo('returns 404 when restaurant not found');
  it.todo('returns 500 when data directory not found');
});
