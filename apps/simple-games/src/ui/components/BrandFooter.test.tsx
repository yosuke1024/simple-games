/**
 * The footer's one action: the publisher's name opens the PixApps site's top
 * page, through the same quiet-when-offline door as every other external link
 * (ui/openExternal.ts). Pinned so the by-line cannot silently go back to
 * plain text, or start pointing somewhere else.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { openExternalMock } = vi.hoisted(() => ({ openExternalMock: vi.fn() }));
vi.mock('../openExternal', () => ({ openExternal: openExternalMock }));

import { PUBLISHER_NAME, PUBLISHER_URL, SERIES_NAME } from '@simple-games/brand';
import { BrandFooter } from './BrandFooter';

afterEach(() => {
  cleanup();
  openExternalMock.mockReset();
});

describe('BrandFooter', () => {
  it('shows the series name and the by-line with the publisher as a button', () => {
    render(<BrandFooter />);
    // The name and the by-line are siblings set apart by a flex gap, not by
    // whitespace, so they are read one at a time.
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(SERIES_NAME);
    expect(footer).toHaveTextContent(`by ${PUBLISHER_NAME}`);
    expect(screen.getByRole('button', { name: PUBLISHER_NAME })).toBeInTheDocument();
  });

  it('opens the PixApps site top page when the publisher is tapped', async () => {
    render(<BrandFooter />);
    await userEvent.click(screen.getByRole('button', { name: PUBLISHER_NAME }));
    expect(openExternalMock).toHaveBeenCalledTimes(1);
    expect(openExternalMock).toHaveBeenCalledWith(PUBLISHER_URL);
  });
});
