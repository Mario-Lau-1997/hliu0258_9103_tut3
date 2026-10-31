# Audio source

`ripple-ambience.wav` is a 24-second, mono, 22,050 Hz, 16-bit PCM sound texture
synthesised for this project. It combines band-pass filtered noise with decaying
sine chirps. It is not a field recording and contains no external audio samples.
The repeatable generator uses seed 7321: see `tools/make_audio.py`.
The start and end are faded to zero to avoid a discontinuity at the loop join.

`audio-track.js` contains the same WAV bytes as base64. This lets a locally opened
page decode the track without fetching a file across browser security boundaries.
Playback does not require Python, NumPy or SciPy.

Live interaction sounds are created by oscillators in `js/audio-mechanic.js`.
Their envelopes, pitch and stereo position change with the interaction. There is
no microphone recording and no external music service.

To rebuild both copies, install NumPy and SciPy in a development environment and
run `python tools/make_audio.py` from the project folder. `docs/audio-asset.json`
records the generated asset's duration, sample rate and peak level.
