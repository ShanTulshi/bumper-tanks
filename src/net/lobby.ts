// PeerJS transport. The PeerJS public cloud brokers the WebRTC handshake only;
// all game traffic flows peer-to-peer. Star topology: guests connect to host.

import { PEER_PREFIX } from '../game/constants.js';
import type { GuestMsg, HostMsg } from './protocol.js';

// No 0/O/1/I/L/S/5/B/8 — codes get read out loud and typed on phones.
const CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXYZ23467';

export function generateLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function joinURL(code: string): string {
  const base = location.origin === 'null' ? location.href.split('#')[0] : location.origin + location.pathname;
  return `${base}#join=${code}`;
}

export interface HostLobbyHandlers {
  onOpen?: () => void;
  onError?: (err: PeerJSError) => void;
  onJoin?: (peerId: string) => void;
  onLeave?: (peerId: string) => void;
  onMessage?: (peerId: string, msg: GuestMsg) => void;
}

export class HostLobby {
  code: string;
  handlers: HostLobbyHandlers;
  conns = new Map<string, PeerJSDataConnection>();
  peer: PeerJSPeer;

  constructor(code: string, handlers: HostLobbyHandlers) {
    this.code = code;
    this.handlers = handlers;
    this.peer = new window.Peer(PEER_PREFIX + code, { debug: 1 });
    this.peer.on('open', () => handlers.onOpen?.());
    this.peer.on('disconnected', () => {
      // The broker socket dropped (idle timeout, network blip, phone sleep).
      // Existing games keep flowing P2P, but new joins need the broker —
      // re-register the lobby code. PeerJS does not do this by itself.
      if (!this.peer.destroyed) this.peer.reconnect();
    });
    this.peer.on('error', (err) => handlers.onError?.(err));
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.conns.set(conn.peer, conn);
        handlers.onJoin?.(conn.peer);
      });
      conn.on('data', (msg) => handlers.onMessage?.(conn.peer, msg as GuestMsg));
      const drop = (): void => {
        if (this.conns.delete(conn.peer)) handlers.onLeave?.(conn.peer);
      };
      conn.on('close', drop);
      conn.on('error', drop);
    });
  }

  broadcast(msg: HostMsg): void {
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  sendTo(peerId: string, msg: HostMsg): void {
    const conn = this.conns.get(peerId);
    if (conn?.open) conn.send(msg);
  }

  kick(peerId: string): void {
    this.conns.get(peerId)?.close();
    this.conns.delete(peerId);
  }

  destroy(): void {
    this.peer.destroy();
    this.conns.clear();
  }
}

export interface GuestConnectionHandlers {
  onOpen?: () => void;
  onMessage?: (msg: HostMsg) => void;
  onClose?: () => void;
  onError?: (err: PeerJSError) => void;
}

export class GuestConnection {
  handlers: GuestConnectionHandlers;
  conn: PeerJSDataConnection | null = null;
  peer: PeerJSPeer;

  constructor(code: string, handlers: GuestConnectionHandlers) {
    this.handlers = handlers;
    this.peer = new window.Peer({ debug: 1 });
    this.peer.on('disconnected', () => {
      if (!this.peer.destroyed) this.peer.reconnect();
    });
    this.peer.on('error', (err) => handlers.onError?.(err));
    this.peer.on('open', () => {
      this.conn = this.peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
      this.conn.on('open', () => handlers.onOpen?.());
      this.conn.on('data', (msg) => handlers.onMessage?.(msg as HostMsg));
      this.conn.on('close', () => handlers.onClose?.());
      this.conn.on('error', (err) => handlers.onError?.(err));
    });
  }

  send(msg: GuestMsg): void {
    if (this.conn?.open) this.conn.send(msg);
  }

  destroy(): void {
    this.peer.destroy();
  }
}
