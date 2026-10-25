import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { FindOpponentButton } from './FindOpponentButton';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it.each(['en', 'ja'] as const)('keeps collection discovery disabled on Web (%s)', (language) => {
  vi.stubEnv('MODE', 'web');
  const find = vi.fn();
  render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language }}>
      <FindOpponentButton onFindOpponent={find} active />
    </SettingsProvider>,
  );
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent(
    language === 'ja' ? '近くの対戦相手を探す' : 'Find nearby opponents',
  );
  expect(button).toHaveTextContent(
    language === 'ja' ? 'アプリ専用の機能です' : 'Available in the app only.',
  );
  fireEvent.click(button);
  expect(find).not.toHaveBeenCalled();
});
