import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatSignedCount, formatSignedDuration } from '../format';
import { BestDelta } from './BestDelta';

afterEach(cleanup);

describe('signed formatting', () => {
  it('signs a duration and keeps the clock shape', () => {
    expect(formatSignedDuration(18)).toBe('+0:18');
    expect(formatSignedDuration(-5)).toBe('−0:05');
    expect(formatSignedDuration(3725)).toBe('+1:02:05');
    expect(formatSignedDuration(0)).toBe('±0:00');
  });

  it('signs a count', () => {
    expect(formatSignedCount(120)).toBe('+120');
    expect(formatSignedCount(-3)).toBe('−3');
    expect(formatSignedCount(0)).toBe('±0');
  });
});

describe('BestDelta', () => {
  it('says how far behind the record a slower time is', () => {
    render(<BestDelta value={125} previous={100} kind="time" />);
    const delta = screen.getByText('+0:25');
    expect(delta).not.toHaveClass('result-delta-better');
  });

  it('marks a new record as the better one', () => {
    render(<BestDelta value={90} previous={100} kind="time" />);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('reads a score the other way round', () => {
    render(<BestDelta value={1200} previous={1000} kind="count" lowerIsBetter={false} />);
    expect(screen.getByText('+200')).toHaveClass('result-delta-better');
    cleanup();
    render(<BestDelta value={800} previous={1000} kind="count" lowerIsBetter={false} />);
    expect(screen.getByText('−200')).not.toHaveClass('result-delta-better');
  });

  it('says nothing on a first clear or an exact tie', () => {
    const { container } = render(<BestDelta value={100} previous={null} kind="time" />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    const tie = render(<BestDelta value={100} previous={100} kind="time" />);
    expect(tie.container).toBeEmptyDOMElement();
  });
});
