// All audio is synthesized with WebAudio — no assets. Unlocked on first tap.
const STORAGE_KEY = 'bumper-tanks-muted';
class Sound {
    ctx = null;
    master = null;
    noiseBuf = null;
    muted = localStorage.getItem(STORAGE_KEY) === '1';
    unlock() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC)
                return;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.5;
            this.master.connect(this.ctx.destination);
            const len = this.ctx.sampleRate * 0.5;
            this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++)
                data[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended')
            this.ctx.resume();
    }
    setMuted(muted) {
        this.muted = muted;
        localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
        if (this.master)
            this.master.gain.value = muted ? 0 : 0.5;
    }
    tone({ type = 'sine', from = 440, to = from, dur = 0.15, gain = 0.25, when = 0 }) {
        if (!this.ctx || !this.master || this.muted)
            return;
        const t = this.ctx.currentTime + when;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }
    noise({ dur = 0.2, gain = 0.2, filterFrom = 4000, filterTo = 300, when = 0 }) {
        if (!this.ctx || !this.master || !this.noiseBuf || this.muted)
            return;
        const t = this.ctx.currentTime + when;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFrom, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filter).connect(g).connect(this.master);
        src.start(t);
        src.stop(t + dur + 0.02);
    }
    fire() {
        this.tone({ type: 'sine', from: 150, to: 55, dur: 0.14, gain: 0.35 });
        this.noise({ dur: 0.08, gain: 0.12, filterFrom: 6000, filterTo: 800 });
    }
    hit() {
        this.tone({ type: 'square', from: 260, to: 70, dur: 0.12, gain: 0.22 });
        this.noise({ dur: 0.1, gain: 0.15, filterFrom: 5000, filterTo: 500 });
    }
    explode() {
        this.tone({ type: 'sine', from: 90, to: 35, dur: 0.4, gain: 0.4 });
        this.noise({ dur: 0.45, gain: 0.28, filterFrom: 3500, filterTo: 120 });
    }
    bump(intensity = 0.5) {
        this.tone({ type: 'sine', from: 120, to: 60, dur: 0.08, gain: 0.1 + intensity * 0.2 });
    }
    fall() {
        this.tone({ type: 'triangle', from: 700, to: 120, dur: 0.5, gain: 0.2 });
    }
    ko() {
        this.tone({ type: 'sawtooth', from: 340, to: 90, dur: 0.35, gain: 0.2 });
        this.noise({ dur: 0.3, gain: 0.2, filterFrom: 2500, filterTo: 150, when: 0.02 });
    }
    shieldPop() {
        this.tone({ type: 'triangle', from: 900, to: 500, dur: 0.08, gain: 0.15 });
    }
    countdown(n) {
        this.tone({ type: 'square', from: 520, to: 520, dur: 0.09, gain: 0.12 });
        if (n <= 1)
            this.tone({ type: 'square', from: 660, to: 660, dur: 0.09, gain: 0.1, when: 0.1 });
    }
    roundStart() {
        this.tone({ type: 'square', from: 780, to: 780, dur: 0.18, gain: 0.16 });
    }
    win() {
        [523, 659, 784, 1046].forEach((f, i) => {
            this.tone({ type: 'triangle', from: f, to: f, dur: 0.16, gain: 0.16, when: i * 0.11 });
        });
    }
}
export const sound = new Sound();
