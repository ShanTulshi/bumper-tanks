// Ambient types for the vendored UMD globals (PeerJS, qrcode-generator) and
// the debug hooks that browser validation drives via `window.__game`.

interface PeerJSError extends Error {
  type?: string;
}

interface PeerJSDataConnection {
  peer: string;
  open: boolean;
  send(data: unknown): void;
  close(): void;
  on(event: 'open' | 'close', cb: () => void): void;
  on(event: 'data', cb: (data: unknown) => void): void;
  on(event: 'error', cb: (err: PeerJSError) => void): void;
}

interface PeerJSPeer {
  disconnected: boolean;
  destroyed: boolean;
  on(event: 'open', cb: (id: string) => void): void;
  on(event: 'connection', cb: (conn: PeerJSDataConnection) => void): void;
  on(event: 'disconnected', cb: () => void): void;
  on(event: 'error', cb: (err: PeerJSError) => void): void;
  connect(peerId: string, options?: { reliable?: boolean; serialization?: string }): PeerJSDataConnection;
  reconnect(): void;
  destroy(): void;
}

interface QRCodeGenerator {
  addData(data: string): void;
  make(): void;
  createDataURL(cellSize?: number, margin?: number): string;
}

interface Window {
  Peer: new (idOrOptions?: string | { debug?: number }, options?: { debug?: number }) => PeerJSPeer;
  qrcode: (typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H') => QRCodeGenerator;
  __game: unknown;
  webkitAudioContext?: typeof AudioContext;
}
