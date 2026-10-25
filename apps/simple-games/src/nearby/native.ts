import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type Transport = 'ble' | 'lan';
export type NativeEvent =
  | { type: 'peer'; id: string; name: string }
  | { type: 'connected' }
  | { type: 'data'; data: string }
  | { type: 'disconnected'; reason: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'status'; message: string };

export interface NearbyPlugin {
  start(options: {
    transport: Transport;
    role: 'advertise' | 'browse';
    label: string;
  }): Promise<void>;
  connect(options: { peerId: string }): Promise<void>;
  send(options: { data: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: 'nearbyEvent',
    listener: (event: NativeEvent) => void,
  ): Promise<PluginListenerHandle>;
  readHistory(): Promise<{ data: string | null }>;
  writeHistory(options: { data: string }): Promise<void>;
  clearHistory(): Promise<void>;
}

// Registration does not request permissions, start radios, or read history.
export const nearbyPlugin = registerPlugin<NearbyPlugin>('NearbyPlay');

export function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function randomDie(): number {
  const bytes = new Uint8Array(1);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0]! >= 252);
  return (bytes[0]! % 6) + 1;
}
