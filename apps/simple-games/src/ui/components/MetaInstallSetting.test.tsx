/**
 * The Settings row of the Meta install measurement (issue #204): absent in
 * every build without Meta, a switch plus one true sentence where it exists,
 * and — whatever the language — always there for a player who said yes, so a
 * change of language never hides the way back out.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetaInstallState } from '../../services/acquisition/plugin';

const { metaPlugin } = vi.hoisted(() => ({
  metaPlugin: {
    getState: vi.fn<() => Promise<MetaInstallState>>(),
    setConsent: vi.fn<(options: { granted: boolean }) => Promise<MetaInstallState>>(),
    reportInstall: vi.fn<() => Promise<{ started: boolean }>>(),
  },
}));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, getPlatform: () => 'android', isNativePlatform: () => true },
  };
});
vi.mock('@capacitor/network', () => ({
  Network: { getStatus: vi.fn(), addListener: vi.fn() },
}));
vi.mock('../../services/acquisition/plugin', () => ({ MetaInstall: metaPlugin }));

import {
  initMetaInstall,
  resetMetaInstallForTesting,
} from '../../services/acquisition/metaInstall';
import { setOnlineForTesting } from '../../services/network';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema, type LanguageSetting } from '../../storage/schemas';
import { MetaInstallSetting } from './MetaInstallSetting';

function state(overrides: Partial<MetaInstallState> = {}): MetaInstallState {
  return { available: true, consent: 'unset', reported: false, installedAt: 1, ...overrides };
}

async function renderRow(native: MetaInstallState, language: LanguageSetting = 'en') {
  metaPlugin.getState.mockResolvedValue(native);
  await initMetaInstall();
  return render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language }}>
      <MetaInstallSetting />
    </SettingsProvider>,
  );
}

const toggle = () => screen.queryByRole('switch', { name: 'Ad measurement (Meta)' });

beforeEach(() => {
  setOnlineForTesting(true);
  resetMetaInstallForTesting();
  metaPlugin.getState.mockReset();
  metaPlugin.setConsent
    .mockReset()
    .mockImplementation(({ granted }) =>
      Promise.resolve(state({ consent: granted ? 'granted' : 'declined' })),
    );
  metaPlugin.reportInstall.mockReset().mockResolvedValue({ started: true });
});

afterEach(() => {
  cleanup();
});

describe('where the row exists', () => {
  it('is absent in a build without Meta', async () => {
    const { container } = await renderRow({ available: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('is absent in a language the question is never asked in, until the player said yes', async () => {
    const { container } = await renderRow(state(), 'de');
    expect(container).toBeEmptyDOMElement();
  });

  it('stays, in English, for a player who said yes and then changed language', async () => {
    await renderRow(state({ consent: 'granted' }), 'de');
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
  });

  it('speaks Japanese in Japanese', async () => {
    await renderRow(state(), 'ja');
    expect(screen.getByRole('switch', { name: '広告の効果測定(Meta)' })).toBeInTheDocument();
    expect(screen.getByText('オフ。Meta には何も送りません。')).toBeInTheDocument();
  });
});

describe('what it says', () => {
  it('says off, and that nothing is sent, until the player says yes', async () => {
    await renderRow(state({ consent: 'declined' }));
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Off. Nothing is sent to Meta.')).toBeInTheDocument();
  });

  it('says, when off, that a report already sent cannot be recalled', async () => {
    await renderRow(state({ consent: 'declined', reported: true }));
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Meta was already told once/)).toBeInTheDocument();
  });

  it('does not claim nothing was sent, when off after a report was started but not yet confirmed', async () => {
    await renderRow(state({ consent: 'declined', attempted: true }));
    expect(screen.queryByText('Off. Nothing is sent to Meta.')).not.toBeInTheDocument();
    expect(screen.getByText(/may have reached Meta once/)).toBeInTheDocument();
  });

  it('says the report is still to go while it has not', async () => {
    await renderRow(state({ consent: 'granted' }));
    expect(screen.getByText(/When the app is online, it tells Meta once/)).toBeInTheDocument();
  });

  it('says it went, once, and that nothing more is sent', async () => {
    await renderRow(state({ consent: 'granted', reported: true }));
    expect(
      screen.getByText(
        'On. Meta has been told once that the app was installed. Nothing more is sent.',
      ),
    ).toBeInTheDocument();
  });

  it('stays, and says nothing more will be tried, once the native side has stopped', async () => {
    await renderRow(state({ consent: 'granted', stopped: true }));
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByText(
        /Meta did not confirm this install’s report, and the app will not try again/,
      ),
    ).toBeInTheDocument();
  });
});

describe('what the switch does', () => {
  it('turns a yes into the one report', async () => {
    const user = userEvent.setup();
    await renderRow(state());
    await user.click(toggle()!);

    expect(metaPlugin.setConsent).toHaveBeenCalledWith({ granted: true });
    expect(metaPlugin.reportInstall).toHaveBeenCalledTimes(1);
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
  });

  it('turns a no into an off switch and no report', async () => {
    const user = userEvent.setup();
    await renderRow(state({ consent: 'granted', reported: true }));
    await user.click(toggle()!);
    await act(async () => undefined);

    expect(metaPlugin.setConsent).toHaveBeenCalledWith({ granted: false });
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(metaPlugin.reportInstall).not.toHaveBeenCalled();
  });
});
