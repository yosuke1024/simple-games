/**
 * WebChromeSlot outside the web-mode build: always null. This is what every
 * native and test bundle sees — the header integration only exists behind the
 * build-time `--mode web` gate, and the two built artifacts are checked in CI
 * (.github/scripts/check-dist-ads-separation.sh). The web-mode behaviour is
 * covered by services/chrome/web/host.test.ts plus a `pnpm dev:web` session.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WebChromeSlot } from './WebChromeSlot';

describe('WebChromeSlot in a non-web-mode bundle', () => {
  it('renders nothing', () => {
    const { container } = render(<WebChromeSlot />);
    expect(container).toBeEmptyDOMElement();
  });

  it('leaves no header behind after unmounting', () => {
    const { unmount, container } = render(<WebChromeSlot />);
    unmount();
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('header[data-global-header]')).toBeNull();
  });
});
