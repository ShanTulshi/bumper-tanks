// PeerJS transport. The PeerJS public cloud brokers the WebRTC handshake only;
// all game traffic flows peer-to-peer. Star topology: guests connect to host.
import { PEER_PREFIX } from '../game/constants.js';
// No 0/O/1/I/L/S/5/B/8 — codes get read out loud and typed on phones.
const CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXYZ23467';
export function generateLobbyCode() {
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
}
export function joinURL(code) {
    const base = location.origin === 'null' ? location.href.split('#')[0] : location.origin + location.pathname;
    return `${base}#join=${code}`;
}
export class HostLobby {
    code;
    handlers;
    conns = new Map();
    peer;
    constructor(code, handlers) {
        this.code = code;
        this.handlers = handlers;
        this.peer = new window.Peer(PEER_PREFIX + code, { debug: 1 });
        this.peer.on('open', () => handlers.onOpen?.());
        this.peer.on('disconnected', () => {
            // The broker socket dropped (idle timeout, network blip, phone sleep).
            // Existing games keep flowing P2P, but new joins need the broker —
            // re-register the lobby code. PeerJS does not do this by itself.
            if (!this.peer.destroyed)
                this.peer.reconnect();
        });
        this.peer.on('error', (err) => handlers.onError?.(err));
        this.peer.on('connection', (conn) => {
            conn.on('open', () => {
                this.conns.set(conn.peer, conn);
                handlers.onJoin?.(conn.peer);
            });
            conn.on('data', (msg) => handlers.onMessage?.(conn.peer, msg));
            const drop = () => {
                if (this.conns.delete(conn.peer))
                    handlers.onLeave?.(conn.peer);
            };
            conn.on('close', drop);
            conn.on('error', drop);
        });
    }
    broadcast(msg) {
        for (const conn of this.conns.values()) {
            if (conn.open)
                conn.send(msg);
        }
    }
    sendTo(peerId, msg) {
        const conn = this.conns.get(peerId);
        if (conn?.open)
            conn.send(msg);
    }
    kick(peerId) {
        this.conns.get(peerId)?.close();
        this.conns.delete(peerId);
    }
    destroy() {
        this.peer.destroy();
        this.conns.clear();
    }
}
export class GuestConnection {
    handlers;
    conn = null;
    peer;
    constructor(code, handlers) {
        this.handlers = handlers;
        this.peer = new window.Peer({ debug: 1 });
        this.peer.on('disconnected', () => {
            if (!this.peer.destroyed)
                this.peer.reconnect();
        });
        this.peer.on('error', (err) => handlers.onError?.(err));
        this.peer.on('open', () => {
            this.conn = this.peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
            this.conn.on('open', () => handlers.onOpen?.());
            this.conn.on('data', (msg) => handlers.onMessage?.(msg));
            this.conn.on('close', () => handlers.onClose?.());
            this.conn.on('error', (err) => handlers.onError?.(err));
        });
    }
    send(msg) {
        if (this.conn?.open)
            this.conn.send(msg);
    }
    destroy() {
        this.peer.destroy();
    }
}
