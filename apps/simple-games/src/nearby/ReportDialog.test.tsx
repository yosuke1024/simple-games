import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUPPORT_EMAIL } from '@simple-games/brand';
import { ReportDialog } from './ReportDialog';
import { en } from './i18n/en';

vi.mock('../state/SettingsContext', () => ({ useSettings: () => ({ locale: 'en' }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('selected-content report', () => {
  it('requires a reason and explicit review before an email draft or copy, with only selected content', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(
      <ReportDialog
        target={{ title: 'Yacht · Pixel', content: 'Selected message & only this' }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: en.report })).toHaveFocus();
    const copy = screen.getByRole('button', { name: en.reportCopy });
    expect(copy).toBeDisabled();
    expect(screen.getByText(en.reportEmail)).not.toHaveAttribute('href');
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(copy).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: en.reportHarassment } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    const preview = (screen.getByRole('textbox') as HTMLTextAreaElement).value;
    const link = new URL(screen.getByRole('link', { name: en.reportEmail }).getAttribute('href')!);
    expect(link.pathname).toBe(SUPPORT_EMAIL);
    expect(link.searchParams.get('body')).toBe(preview);
    expect(preview).toBe(
      'Simple Games — Yacht · Pixel\n\nHarassment or threats\n\nSelected message & only this',
    );
    fireEvent.click(copy);
    expect(await screen.findByRole('status')).toHaveTextContent(en.reportCopied);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(`${SUPPORT_EMAIL}\n\n${preview}`);
  });

  it('keeps selectable evidence on clipboard failure and closes without sending on Escape', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('clipboard unavailable');
    });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const close = vi.fn();
    render(
      <ReportDialog
        target={{ title: 'History', content: 'Unfiltered selected evidence' }}
        onClose={close}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: en.reportOther } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: en.reportCopy }));
    expect(await screen.findByRole('status')).toHaveTextContent(en.reportCopyFailed);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain(
      'Unfiltered selected evidence',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
});
