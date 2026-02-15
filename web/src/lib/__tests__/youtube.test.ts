import { getTimedYouTubeUrl } from '../youtube';

describe('getTimedYouTubeUrl', () => {
  it('appends timestamp with & for URLs with existing params', () => {
    expect(getTimedYouTubeUrl('https://youtube.com/watch?v=abc', 332))
      .toBe('https://youtube.com/watch?v=abc&t=332');
  });

  it('appends timestamp with ? for URLs without params', () => {
    expect(getTimedYouTubeUrl('https://youtu.be/abc', 60))
      .toBe('https://youtu.be/abc?t=60');
  });

  it('returns original URL when timestamp is null', () => {
    expect(getTimedYouTubeUrl('https://youtube.com/watch?v=abc', null))
      .toBe('https://youtube.com/watch?v=abc');
  });

  it('returns original URL when timestamp is 0', () => {
    expect(getTimedYouTubeUrl('https://youtube.com/watch?v=abc', 0))
      .toBe('https://youtube.com/watch?v=abc');
  });

  it('returns original URL when timestamp is undefined', () => {
    expect(getTimedYouTubeUrl('https://youtube.com/watch?v=abc'))
      .toBe('https://youtube.com/watch?v=abc');
  });

  it('handles negative timestamps by returning original URL', () => {
    expect(getTimedYouTubeUrl('https://youtube.com/watch?v=abc', -10))
      .toBe('https://youtube.com/watch?v=abc');
  });

  it('handles various YouTube URL formats', () => {
    expect(getTimedYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 120))
      .toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120');

    expect(getTimedYouTubeUrl('https://youtu.be/dQw4w9WgXcQ', 120))
      .toBe('https://youtu.be/dQw4w9WgXcQ?t=120');

    expect(getTimedYouTubeUrl('https://youtube.com/embed/dQw4w9WgXcQ', 120))
      .toBe('https://youtube.com/embed/dQw4w9WgXcQ?t=120');
  });
});
