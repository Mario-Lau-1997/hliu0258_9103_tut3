// Mathematical properties that protect the meaning of the interaction.
const test = require('node:test');
const assert = require('node:assert/strict');
const {WaveField, contourSegments} = require('../js/wave-field.js');

test('equal opposite sources cancel across the field', () => {
  const field = new WaveField();
  field.addSource(.4, .6, .9, 0);
  field.addSource(.4, .6, .9, Math.PI);
  for (const time of [0, 1, 4]) {
    for (const [x, y] of [[0, 0], [400, 300], [920, 550]]) {
      assert.ok(Math.abs(field.sample(x, y, time, 1000, 600)) < 1e-12);
    }
  }
});

test('reversing one source changes its sign, not its position or strength', () => {
  const field = new WaveField();
  const source = field.addSource(.3, .5, .8);
  const before = field.sample(200, 180, .7, 800, 600);
  source.reversePhase();
  const after = field.sample(200, 180, .7, 800, 600);
  assert.ok(Math.abs(before + after) < 1e-12);
  assert.equal(source.nx, .3); assert.equal(source.amplitude, .8);
});

test('source count is bounded and positions stay within the artwork', () => {
  const field = new WaveField();
  for (let i = 0; i < 12; i++) field.addSource(-2, 5);
  assert.equal(field.sources.length, 6);
  assert.equal(field.sources[0].nx, .025);
  assert.equal(field.sources[0].ny, .975);
});

test('simple contour crosses the correct two cell edges', () => {
  const lines = contourSegments(0, 1, 1, 0, .5);
  assert.deepEqual(lines, [[.5, 0, .5, 1]]);
  assert.deepEqual(contourSegments(1, 1, 1, 1, .5), []);
});

test('saddle cells produce two finite segments inside the cell', () => {
  const lines = contourSegments(1, -1, 1, -1, 0);
  assert.equal(lines.length, 2);
  assert.ok(lines.flat().every(value => Number.isFinite(value) && value >= 0 && value <= 1));
});

test('grid interpolation preserves finite values after resize', () => {
  const field = new WaveField(); field.restore();
  for (const [w,h] of [[1000,600],[330,400],[1500,600]]) {
    field.resize(w,h);field.update(1);
    assert.ok(Number.isFinite(field.valueAt(w/2,h/2)));
    assert.ok(Number.isFinite(field.valueAt(-10,h+5)));
    assert.ok(field.grid.length <= 151*111);
  }
});
