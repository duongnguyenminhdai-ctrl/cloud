/**
 * CaseAudio: Web Audio API sound manager for FoodFast CS:GO Case Opening
 * Manages zero-latency playback of decoded AudioBuffers, volume gain, and mute toggle.
 */

const SOUND_NAMES = [
  'csgo_ui_crate_open',
  'csgo_ui_crate_item_scroll',
  'item_reveal3_rare',
  'item_reveal4_mythical',
  'item_reveal5_legendary',
  'item_reveal6_ancient'
];

export class CaseAudio {
  constructor(basePath = '') {
    this.base = basePath;
    this.context = null;
    this.gain = null;
    this.buffers = new Map();
    this.requests = new Map();
    this.decoding = new Map();
    this.sources = new Set();
    this.legacyRoute = null;
    this.muted = false;
    this.disposed = false;
    this.activated = false;
    this.generation = 0;
  }

  prepareContext() {
    if (this.context) return;
    const AudioContextClass = typeof window !== 'undefined' &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.gain = this.context.createGain();
    this.gain.gain.value = 0.65;
    this.gain.connect(this.context.destination);
  }

  preload() {
    try {
      this.prepareContext();
    } catch {}
    for (const name of SOUND_NAMES) {
      if (this.context) {
        this.decode(name).catch(() => {});
      } else {
        this.fetchSound(name).catch(() => {});
      }
    }
  }

  fetchSound(name) {
    let request = this.requests.get(name);
    if (!request) {
      const url = `${this.base}/sounds/${name}.mp3`.replace('//', '/');
      request = fetch(url).then((res) => {
        if (!res.ok) throw new Error(`SFX error ${name}: ${res.status}`);
        return res.arrayBuffer();
      });
      this.requests.set(name, request);
      request.catch(() => this.requests.delete(name));
    }
    return request;
  }

  decode(name) {
    const context = this.context;
    if (!context || this.buffers.has(name)) return Promise.resolve();
    let pending = this.decoding.get(name);
    if (!pending) {
      pending = this.fetchSound(name)
        .then((data) => context.decodeAudioData(data.slice(0)))
        .then((buffer) => {
          if (!this.disposed) {
            this.buffers.set(name, buffer);
          }
        });
      this.decoding.set(name, pending);
      pending.finally(() => this.decoding.delete(name)).catch(() => {});
    }
    return pending;
  }

  /**
   * Unlock Web Audio API on user gesture (click/tap)
   */
  unlock() {
    if (this.disposed || this.muted) return;
    this.activated = true;
    try {
      if (typeof navigator !== 'undefined' && navigator.audioSession) {
        navigator.audioSession.type = 'playback';
      }
      this.prepareContext();
      if (!this.context) return;

      // Older iOS devices route Web Audio through ringer unless a silent element is primed
      if (typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)) {
        if (!this.legacyRoute) {
          const silenceUrl = `${this.base}/sounds/silence.mp3`.replace('//', '/');
          this.legacyRoute = new Audio(silenceUrl);
          this.legacyRoute.loop = true;
          this.legacyRoute.play().catch(() => {});
        }
      }

      if (this.context.state === 'suspended') {
        this.context.resume().catch(() => {});
      }

      const pulse = this.context.createBufferSource();
      pulse.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
      if (this.gain) {
        pulse.connect(this.gain);
      }
      pulse.onended = () => pulse.disconnect();
      pulse.start();

      for (const name of SOUND_NAMES) {
        this.decode(name).catch(() => {});
      }
    } catch {}
  }

  play(name) {
    if (this.disposed || this.muted || (typeof document !== 'undefined' && document.hidden) || !this.context) {
      return;
    }
    const buffer = this.buffers.get(name);
    if (!buffer) {
      // For reveal fanfares or opening, decode and retry if ready within deadline
      if (name !== 'csgo_ui_crate_item_scroll') {
        const gen = this.generation;
        const deadline = performance.now() + 1200;
        this.decode(name)
          .then(() => {
            if (gen === this.generation && performance.now() < deadline) {
              this.play(name);
            }
          })
          .catch(() => {});
      }
      return;
    }
    if (this.context.state !== 'running') {
      this.context.resume().catch(() => {});
      return;
    }
    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gain);
      this.sources.add(source);
      source.onended = () => {
        source.disconnect();
        this.sources.delete(source);
      };
      source.start();
    } catch {}
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.gain) {
      this.gain.gain.value = this.muted ? 0 : 0.65;
    }
    if (this.muted) {
      this.pause();
    } else {
      this.unlock();
    }
  }

  pause() {
    this.generation++;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.sources.clear();
    if (this.legacyRoute) {
      try {
        this.legacyRoute.pause();
      } catch {}
    }
  }

  recover() {
    if (this.activated && this.context && !this.muted) {
      this.unlock();
    }
  }

  dispose() {
    this.disposed = true;
    this.pause();
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
