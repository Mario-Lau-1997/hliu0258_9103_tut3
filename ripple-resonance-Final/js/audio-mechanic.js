/*
 * Audio is opt-in. One reusable context plays an embedded ambience loop and
 * short oscillator drops. The measured output level changes the shared field.
 * https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
 */
function audioRms(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += Number.isFinite(sample) ? sample * sample : 0;
  return Math.sqrt(sum / samples.length);
}

function audioPulse(rms) {
  return Number.isFinite(rms) ? Math.max(0, Math.min(1, rms * 45)) : 0;
}

class AudioMechanic {
  constructor(encodedTrack, onChange = () => {}) {
    this.encodedTrack = encodedTrack;
    this.onChange = onChange;
    this.supported = Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
    this.context = null;
    this.enabled = false;
    this.loading = false;
    this.paused = false;
    this.hidden = false;
    this.volume = .45;
    this.rms = 0;
    this.pulse = 0;
    this.boost = 1;
    this.error = '';
    this.voices = new Set();
    this.effectsPlayed = 0;
    this.lastMove = -Infinity;
  }

  createContext() {
    if (this.context) return;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) throw new Error('Sound is not supported in this browser.');
    this.context = new Context();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume * .7;
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.samples = new Float32Array(this.analyser.fftSize);
    this.master.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.context.addEventListener('statechange', () => this.onChange());
  }

  wantsPlayback() { return this.enabled && !this.paused && !this.hidden; }

  async reconcile() {
    if (!this.context) return;
    const wanted = this.wantsPlayback();
    try {
      if (wanted) await this.context.resume();
      else {
        this.stopDrops();
        await this.context.suspend();
      }
      // A pause or mute can arrive while the browser is changing audio state.
      if (wanted !== this.wantsPlayback()) return this.reconcile();
    } catch (error) {
      this.error = 'Sound could not start. Turn sound off and try again.';
    }
    this.onChange();
  }

  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.error = '';
    if (!this.enabled) {
      this.resetSignal();
      await this.reconcile();
      this.onChange();
      return;
    }
    try {
      this.createContext();
      // Start unlocking audio in the click handler, before any awaited work.
      const unlocked = this.context.resume();
      this.loading = !this.loop;
      this.onChange();
      if (!this.loop) {
        const bytes = Uint8Array.from(atob(this.encodedTrack), character => character.charCodeAt(0));
        const [buffer] = await Promise.all([this.context.decodeAudioData(bytes.buffer), unlocked]);
        this.loop = this.context.createBufferSource();
        this.loop.buffer = buffer;
        this.loop.loop = true;
        this.ambience = this.context.createGain();
        this.ambience.gain.value = .6;
        this.loop.connect(this.ambience);
        this.ambience.connect(this.master);
        await this.reconcile();
        this.loop.start();
      } else await unlocked;
      this.loading = false;
      await this.reconcile();
    } catch (error) {
      this.enabled = false;
      this.loading = false;
      this.resetSignal();
      this.error = this.supported ? 'Sound could not load. Keep the assets folder and reload.' :
        'Sound is not supported in this browser. The artwork still works.';
      if (this.context) await this.context.suspend().catch(() => {});
    }
    this.onChange();
  }

  setPaused(paused) { this.paused = paused; return this.reconcile(); }
  setHidden(hidden) { this.hidden = hidden; return this.reconcile(); }

  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.setTargetAtTime(this.volume * .7, this.context.currentTime, .025);
    if (!this.volume) this.resetSignal();
    this.onChange();
  }

  resetSignal() { this.rms = 0; this.pulse = 0; this.boost = 1; }

  update(dt) {
    if (!this.wantsPlayback() || this.loading || !this.volume || this.context?.state !== 'running') {
      this.resetSignal();
      return 1;
    }
    this.analyser.getFloatTimeDomainData(this.samples);
    this.rms = audioRms(this.samples);
    const blend = 1 - Math.exp(-Math.max(0, Math.min(.1, dt)) / .12);
    this.pulse += (audioPulse(this.rms) - this.pulse) * blend;
    this.boost = 1 + .3 * this.pulse;
    return this.boost;
  }

  playDrop(kind = 'add', nx = .5) {
    if (!this.wantsPlayback() || this.loading || !this.volume || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    if ((kind === 'move' && now - this.lastMove < .12) || this.voices.size >= 6) return;
    if (kind === 'move') this.lastMove = now;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const position = Math.max(0, Math.min(1, nx));
    panner.pan.value = (position * 2 - 1) * .75;
    const base = 580 + position * 320;
    oscillator.frequency.setValueAtTime(kind === 'phase' ? base * 1.5 : base, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'phase' ? base * .6 : base * 2, now + .16);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(kind === 'move' ? .065 : .12, now + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .30);
    oscillator.connect(gain); gain.connect(panner); panner.connect(this.master);
    const voice = {oscillator, gain, panner};
    const clean = () => {
      oscillator.disconnect(); gain.disconnect(); panner.disconnect();
      this.voices.delete(voice);
    };
    voice.clean = clean;
    oscillator.onended = clean;
    this.voices.add(voice);
    oscillator.start(now); oscillator.stop(now + .32);
    this.effectsPlayed++;
  }

  stopDrops() {
    for (const voice of this.voices) {
      voice.oscillator.stop();
      voice.clean();
    }
    this.lastMove = -Infinity;
  }

  snapshot() {
    return {supported: this.supported, enabled: this.enabled, loading: this.loading,
      paused: this.paused, hidden: this.hidden, volume: this.volume, error: this.error,
      contextState: this.context?.state || 'not-created', currentTime: this.context?.currentTime || 0,
      duration: this.loop?.buffer.duration || 0, rms: this.rms, pulse: this.pulse,
      looping: Boolean(this.loop?.loop),
      boost: this.boost, activeVoices: this.voices.size, effectsPlayed: this.effectsPlayed};
  }
}

if (typeof module !== 'undefined') module.exports = {AudioMechanic, audioRms, audioPulse};
