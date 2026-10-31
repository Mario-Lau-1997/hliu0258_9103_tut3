const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {audioRms, audioPulse, AudioMechanic} = require('../js/audio-mechanic.js');
const {WaveField} = require('../js/wave-field.js');

test('RMS detects silence and the energy of a sampled sine', () => {
  assert.equal(audioRms(new Float32Array(1024)), 0);
  const sine = Float32Array.from({length:1024}, (_, i) => .2 * Math.sin(i * 2 * Math.PI / 128));
  assert.ok(Math.abs(audioRms(sine) - .2 / Math.sqrt(2)) < 1e-7);
  assert.equal(audioRms([]), 0);
});

test('audio response stays finite and bounded for bad or extreme samples', () => {
  for (const rms of [-1, 0, .01, .1, 100, Infinity, NaN]) {
    const pulse = audioPulse(rms);
    assert.ok(Number.isFinite(pulse) && pulse >= 0 && pulse <= 1);
    assert.ok(1 + .3 * pulse >= 1 && 1 + .3 * pulse <= 1.3);
  }
  assert.ok(audioPulse(.01) < audioPulse(.02));
  assert.ok(Number.isFinite(audioRms([NaN, Infinity, .5])));
});

test('a shared audio gain changes strength while preserving phase cancellation', () => {
  const field = new WaveField();
  field.addSource(.5, .5, .8, 0);
  const before = field.sample(100, 200, 1, 800, 600);
  field.audioBoost = 1.3;
  assert.ok(Math.abs(field.sample(100, 200, 1, 800, 600) - before * 1.3) < 1e-12);
  field.addSource(.5, .5, .8, Math.PI);
  for (const time of [0, 1, 4]) {
    assert.ok(Math.abs(field.sample(100, 200, time, 800, 600)) < 1e-12);
  }
});

test('constructing the audio module creates no playback resources', () => {
  const audio = new AudioMechanic('');
  assert.equal(audio.context, null);
  assert.equal(audio.enabled, false);
  assert.equal(audio.update(.03), 1);
  audio.setVolume(2); assert.equal(audio.volume, 1);
  audio.setVolume(-1); assert.equal(audio.volume, 0);
});

test('offline audio bytes match the WAV and contain 24 seconds without clipping', () => {
  const root = path.resolve(__dirname, '..');
  const wave = fs.readFileSync(path.join(root, 'assets/ripple-ambience.wav'));
  const embedded = fs.readFileSync(path.join(root, 'assets/audio-track.js'), 'utf8');
  const base64 = JSON.parse(embedded.match(/const RIPPLE_AMBIENCE_DATA = (.*);/)[1]);
  assert.deepEqual(Buffer.from(base64, 'base64'), wave);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wave.readUInt32LE(24), 22050);
  assert.equal(wave.readUInt16LE(22), 1);
  assert.equal(wave.readUInt16LE(34), 16);
  assert.equal(wave.readUInt32LE(40) / (22050 * 2), 24);
  let peak = 0;
  for (let i = 44; i < wave.length; i += 2) peak = Math.max(peak, Math.abs(wave.readInt16LE(i)));
  assert.ok(peak > 10000 && peak < 16000);
  assert.equal(wave.readInt16LE(44), 0);
  assert.equal(wave.readInt16LE(wave.length - 2), 0);
});
