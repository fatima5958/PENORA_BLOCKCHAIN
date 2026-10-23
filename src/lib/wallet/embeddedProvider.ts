/**
 * Session-scoped EIP-1193 bridge; no private signing material stored by PENORA.
 */
export interface PenoraEip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, callback: (...args: any[]) => void): unknown;
  removeListener?(event: string, callback: (...args: any[]) => void): unknown;
}
let active: PenoraEip1193Provider | null = null;
export const getEmbeddedWalletProvider = () => active;
export function setEmbeddedWalletProvider(provider: PenoraEip1193Provider | null): void {
  active = provider;
}
export function clearEmbeddedWalletProvider(provider?: PenoraEip1193Provider): void {
  if (!provider || active === provider) active = null;
}
