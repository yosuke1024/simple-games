/**
 * Ephemeral P-256 ECDH, HKDF-SHA-256 and directional AES-256-GCM using WebCrypto.
 * No keys persist. The short public-key hash is an accidental-misconnection aid,
 * not authentication: it has no commitment step or active-MITM guarantee.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const bytes = (value: string) => encoder.encode(value);
const b64 = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value)));
function unb64(value: unknown, max: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length > max || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw new Error('Invalid encrypted frame');
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function iv(sequence: number): Uint8Array<ArrayBuffer> {
  const buffer = new Uint8Array(12);
  new DataView(buffer.buffer).setUint32(8, sequence, false);
  return buffer;
}
export class Channel {
  code = '';
  private outgoing = 0;
  private incoming = 0;
  private peerKey = '';
  private started = false;
  private sendKey: CryptoKey | null = null;
  private receiveKey: CryptoKey | null = null;
  private pendingFrame: string | null = null;
  private work = Promise.resolve();
  private sealed = false;

  private constructor(
    private readonly host: boolean,
    private readonly key: CryptoKeyPair,
    private readonly publicKey: string,
    private readonly sendRaw: (raw: string) => Promise<void>,
    private readonly ready: () => void,
    private readonly message: (plain: string) => void,
  ) {}

  static async create(
    host: boolean,
    send: (raw: string) => Promise<void>,
    ready: () => void,
    message: (plain: string) => void,
  ): Promise<Channel> {
    const key = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
      'deriveBits',
    ]);
    const publicKey = b64(await crypto.subtle.exportKey('raw', key.publicKey));
    return new Channel(host, key, publicKey, send, ready, message);
  }
  close() {
    this.sealed = true;
    this.sendKey = this.receiveKey = null;
    this.pendingFrame = null;
  }
  async start() {
    if (this.started || this.sealed) return;
    this.started = true;
    await this.sendRaw(
      JSON.stringify({ channel: 1, type: 'key', host: this.host, key: this.publicKey }),
    );
    if (this.peerKey) await this.derive();
  }
  private async derive() {
    if (this.sendKey || this.sealed || !this.started || !this.peerKey) return;
    const peer = await crypto.subtle.importKey(
      'raw',
      unb64(this.peerKey, 100),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const shared = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: peer },
      this.key.privateKey,
      256,
    );
    const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    const transcript = bytes(
      `NearbyPlay/1/${this.host ? this.publicKey : this.peerKey}/${this.host ? this.peerKey : this.publicKey}`,
    );
    const salt = await crypto.subtle.digest('SHA-256', transcript);
    const derive = (direction: string) =>
      crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info: bytes(`NearbyPlay/${direction}`) },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    const [hostKey, guestKey] = await Promise.all([derive('host'), derive('guest')]);
    if (this.sealed) return;
    this.sendKey = this.host ? hostKey : guestKey;
    this.receiveKey = this.host ? guestKey : hostKey;
    this.code = String(new DataView(salt).getUint32(0) % 1000000).padStart(6, '0');
    this.ready();
    if (this.pendingFrame) {
      const frame = this.pendingFrame;
      this.pendingFrame = null;
      await this.receive(frame);
    }
  }
  async receive(raw: string) {
    if (this.sealed) return;
    if (bytes(raw).length > 4096 || /[\r\n]/.test(raw)) throw new Error('Invalid encrypted frame');
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid encrypted frame');
    const v = value as Record<string, unknown>;
    if (v.channel !== 1) throw new Error('Channel version mismatch');
    if (v.type === 'key') {
      if (
        this.peerKey ||
        v.host !== !this.host ||
        v.key === this.publicKey ||
        typeof v.key !== 'string' ||
        unb64(v.key, 100).length !== 65
      )
        throw new Error('Invalid key exchange');
      this.peerKey = v.key;
      await this.derive();
      return;
    }
    if (v.type !== 'sealed') throw new Error('Invalid encrypted frame');
    if (!this.receiveKey) {
      if (!this.peerKey || this.pendingFrame !== null) throw new Error('Key exchange incomplete');
      this.pendingFrame = raw;
      return;
    }
    if (v.seq !== this.incoming + 1 || this.incoming >= 1000000)
      throw new Error('Invalid encrypted sequence');
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv(v.seq as number), additionalData: bytes('NearbyPlay/1') },
      this.receiveKey,
      unb64(v.data, 3800),
    );
    if (this.sealed) return;
    if (plaintext.byteLength > 2800) throw new Error('Message too large');
    this.incoming++;
    this.message(decoder.decode(plaintext));
  }
  send(plain: string): Promise<void> {
    // Serialise encrypt + native submission, not just native submission: WebCrypto
    // promises may otherwise finish out of order and reuse an IV/sequence.
    const run = this.work.then(async () => {
      if (this.sealed) return;
      if (!this.sendKey || bytes(plain).length > 2800 || this.outgoing >= 1000000)
        throw new Error('Channel unavailable');
      const seq = ++this.outgoing;
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv(seq), additionalData: bytes('NearbyPlay/1') },
        this.sendKey,
        bytes(plain),
      );
      if (!this.sealed)
        await this.sendRaw(
          JSON.stringify({ channel: 1, type: 'sealed', seq, data: b64(encrypted) }),
        );
    });
    this.work = run;
    return run;
  }
}
