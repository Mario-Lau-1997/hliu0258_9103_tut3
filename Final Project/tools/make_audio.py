"""Build a repeatable water-like sound texture and its offline browser copy.

Development only: requires NumPy and SciPy. Playback needs neither package.
"""
from pathlib import Path
import base64
import json
import wave
import numpy as np
from scipy.signal import butter, sosfilt

root = Path(__file__).resolve().parents[1]
sample_rate, seconds = 22050, 24
rng = np.random.default_rng(7321)
t = np.arange(sample_rate * seconds) / sample_rate
noise = sosfilt(butter(2, [320, 3800], btype='bandpass', fs=sample_rate, output='sos'),
                rng.normal(0, 1, len(t)))
noise /= np.std(noise)
track = .012 * noise * (.75 + .17*np.sin(2*np.pi*t/6) + .08*np.sin(2*np.pi*t/2.4))
starts = np.arange(.4, seconds-.5, 1.05)
for start in starts + rng.uniform(-.2, .2, len(starts)):
    local = np.arange(int(sample_rate*.35)) / sample_rate
    frequency = rng.uniform(520, 850) + rng.uniform(650, 950)*(1-np.exp(-local*14))
    phase = 2*np.pi*np.cumsum(frequency)/sample_rate
    envelope = (1-np.exp(-local*650))*np.exp(-local*18)
    drop = rng.uniform(.07, .14)*envelope*(np.sin(phase)+.13*np.sin(phase*2.13))
    index = int(start*sample_rate)
    track[index:index+len(drop)] += drop
fade = int(sample_rate*.03)
track[:fade] *= np.linspace(0, 1, fade)
track[-fade:] *= np.linspace(1, 0, fade)
track *= .44 / np.max(np.abs(track))
pcm = np.round(track*32767).astype('<i2')
target = root/'assets/ripple-ambience.wav'
with wave.open(str(target), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(sample_rate)
    output.writeframes(pcm.tobytes())
encoded = base64.b64encode(target.read_bytes()).decode('ascii')
(root/'assets/audio-track.js').write_text(
    '// Embedded copy of ripple-ambience.wav for playback without a server.\n'
    'const RIPPLE_AMBIENCE_DATA = '+json.dumps(encoded)+';\n', encoding='utf-8')
report = {'durationSeconds': seconds, 'sampleRate': sample_rate, 'channels': 1,
          'peak': float(np.max(np.abs(track))), 'rms': float(np.sqrt(np.mean(track**2))),
          'firstSample': int(pcm[0]), 'lastSample': int(pcm[-1]), 'seed': 7321,
          'source': 'Synthesised filtered noise and sine chirps; no external recording.'}
(root/'docs/audio-asset.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))
