import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { PlayTogetherButton } from './PlayTogetherButton';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it.each(['en', 'ja'] as const)('shows a disabled app-only notice in Web (%s)', (language) => {
  vi.stubEnv('MODE', 'web');
  const onPlayTogether = vi.fn();
  render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language }}>
      <PlayTogetherButton onPlayTogether={onPlayTogether} playTogetherActive />
    </SettingsProvider>,
  );
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent(language === 'ja' ? '誰かと遊ぶ' : 'Play with someone');
  expect(button).toHaveTextContent(
    language === 'ja' ? 'アプリ専用の機能です' : 'Available in the app only.',
  );
  fireEvent.click(button);
  expect(onPlayTogether).not.toHaveBeenCalled();
});

it('keeps the native resume action available', () => {
  vi.stubEnv('MODE', 'production');
  const onPlayTogether = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PlayTogetherButton onPlayTogether={onPlayTogether} playTogetherActive />
    </SettingsProvider>,
  );
  const button = screen.getByRole('button', { name: /Back to multiplayer/ });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(onPlayTogether).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Available in the app only.')).not.toBeInTheDocument();
});
