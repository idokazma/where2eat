import {
  formatRelativeTime,
  formatRelativeScheduled,
  formatDuration,
  formatDurationCompact,
  formatDate,
  formatProcessingDuration,
  priorityDotClass,
  priorityCardColor,
} from '../formatters';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns dash for empty string', () => {
    expect(formatRelativeTime('')).toBe('—');
  });

  it('returns "just now" for less than 1 minute ago', () => {
    expect(formatRelativeTime('2026-03-12T11:59:30Z')).toBe('just now');
  });

  it('returns minutes ago for less than 60 minutes', () => {
    expect(formatRelativeTime('2026-03-12T11:30:00Z')).toBe('30m ago');
  });

  it('returns hours ago for less than 24 hours', () => {
    expect(formatRelativeTime('2026-03-12T06:00:00Z')).toBe('6h ago');
  });

  it('returns days ago for less than 7 days', () => {
    expect(formatRelativeTime('2026-03-10T12:00:00Z')).toBe('2d ago');
  });

  it('returns formatted date for older than 7 days', () => {
    const result = formatRelativeTime('2026-02-01T12:00:00Z');
    // toLocaleDateString with month:'short', day:'numeric'
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/1/);
  });
});

describe('formatRelativeScheduled', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns dash for empty string', () => {
    expect(formatRelativeScheduled('')).toBe('—');
  });

  it('returns "overdue" for times slightly in the past (< 60 min)', () => {
    expect(formatRelativeScheduled('2026-03-12T11:50:00Z')).toBe('overdue');
  });

  it('returns hours ago for times more than 60 min in the past', () => {
    expect(formatRelativeScheduled('2026-03-12T09:00:00Z')).toBe('3h ago');
  });

  it('returns days ago for times more than 24 hours in the past', () => {
    expect(formatRelativeScheduled('2026-03-10T12:00:00Z')).toBe('2d ago');
  });

  it('returns minutes for near-future times', () => {
    expect(formatRelativeScheduled('2026-03-12T12:30:00Z')).toBe('30m');
  });

  it('returns hours for future times less than 24 hours', () => {
    expect(formatRelativeScheduled('2026-03-12T15:00:00Z')).toBe('3h');
  });

  it('returns days for future times more than 24 hours', () => {
    expect(formatRelativeScheduled('2026-03-14T12:00:00Z')).toBe('2d');
  });
});

describe('formatDuration', () => {
  it('returns dash for 0 seconds', () => {
    expect(formatDuration(0)).toBe('—');
  });

  it('returns dash for falsy value', () => {
    expect(formatDuration(undefined as unknown as number)).toBe('—');
  });

  it('returns seconds for less than 60', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('returns minutes and seconds for less than 60 minutes', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('returns hours and minutes for 60+ minutes', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
  });
});

describe('formatDurationCompact', () => {
  it('returns dash for 0 seconds', () => {
    expect(formatDurationCompact(0)).toBe('—');
  });

  it('returns dash for falsy value', () => {
    expect(formatDurationCompact(undefined as unknown as number)).toBe('—');
  });

  it('returns seconds for less than 60', () => {
    expect(formatDurationCompact(45)).toBe('45s');
  });

  it('returns only minutes (no seconds) for less than 60 minutes', () => {
    expect(formatDurationCompact(125)).toBe('2m');
  });

  it('returns hours and minutes for 60+ minutes', () => {
    expect(formatDurationCompact(5400)).toBe('1h 30m');
  });
});

describe('formatDate', () => {
  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });

  it('returns locale string for valid date', () => {
    const result = formatDate('2026-03-12T12:00:00Z');
    // Should be a non-empty string representing the date
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
  });
});

describe('formatProcessingDuration', () => {
  it('returns dash when startedAt is empty', () => {
    expect(formatProcessingDuration('', '2026-03-12T12:00:00Z')).toBe('—');
  });

  it('returns dash when completedAt is empty', () => {
    expect(formatProcessingDuration('2026-03-12T12:00:00Z', '')).toBe('—');
  });

  it('returns formatted duration for valid date range', () => {
    const result = formatProcessingDuration(
      '2026-03-12T12:00:00Z',
      '2026-03-12T12:02:30Z'
    );
    expect(result).toBe('2m 30s');
  });

  it('returns seconds for short durations', () => {
    const result = formatProcessingDuration(
      '2026-03-12T12:00:00Z',
      '2026-03-12T12:00:45Z'
    );
    expect(result).toBe('45s');
  });
});

describe('priorityDotClass', () => {
  it('returns gray for priority 1', () => {
    expect(priorityDotClass(1)).toBe('bg-gray-400');
  });

  it('returns blue for priority 2', () => {
    expect(priorityDotClass(2)).toBe('bg-blue-400');
  });

  it('returns yellow for priority 3', () => {
    expect(priorityDotClass(3)).toBe('bg-yellow-500');
  });

  it('returns orange for priority 4', () => {
    expect(priorityDotClass(4)).toBe('bg-orange-500');
  });

  it('returns red for priority 5', () => {
    expect(priorityDotClass(5)).toBe('bg-red-500');
  });

  it('returns red for priority above 5', () => {
    expect(priorityDotClass(10)).toBe('bg-red-500');
  });
});

describe('priorityCardColor', () => {
  it('returns red for priority 1', () => {
    expect(priorityCardColor(1)).toBe('bg-red-500');
  });

  it('returns red for priority 2', () => {
    expect(priorityCardColor(2)).toBe('bg-red-500');
  });

  it('returns yellow for priority 3', () => {
    expect(priorityCardColor(3)).toBe('bg-yellow-500');
  });

  it('returns yellow for priority 4', () => {
    expect(priorityCardColor(4)).toBe('bg-yellow-500');
  });

  it('returns blue for priority 5', () => {
    expect(priorityCardColor(5)).toBe('bg-blue-500');
  });

  it('returns blue for priority above 5', () => {
    expect(priorityCardColor(8)).toBe('bg-blue-500');
  });
});
