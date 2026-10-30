/* AI-assisted regression tests. These exercise real controller behaviour. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {WaveField} = require('../js/wave-field.js');
const InputController = vm.runInNewContext(
  fs.readFileSync(require.resolve('../js/input-controls.js'), 'utf8') + '\nInputController;',
  {document: {getElementById: () => ({textContent: ''})}}
);
function fixture() {
  const listeners = {}, captured = new Set();
  const canvas = {
    addEventListener: (name, fn) => {listeners[name] = fn;},
    getBoundingClientRect: () => ({left: 0, top: 0, width: 600, height: 400}),
    focus() {}, setPointerCapture: id => captured.add(id),
    hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id)
  };
  const field = new WaveField(); field.restore();
  const controller = new InputController(canvas, field, () => {});
  const event = (id, x = 100, y = 100) => ({pointerId: id, button: 0,
    clientX: x, clientY: y, preventDefault() {}});
  return {listeners, field, controller, event};
}
test('a second pointer ending does not stop the active drag', () => {
  const {listeners, controller, field, event} = fixture();
  listeners.pointerdown(event(7));
  const id = controller.selectedId;
  listeners.pointerup(event(8));
  listeners.pointercancel(event(8));
  listeners.lostpointercapture(event(8));
  listeners.pointermove(event(7, 300, 240));
  assert.equal(controller.pointerId, 7);
  assert.equal(field.sources.find(s => s.id === id).nx, 0.5);
  listeners.pointerup(event(7));
  listeners.pointermove(event(7, 400, 200));
  assert.equal(field.sources.find(s => s.id === id).nx, 0.5);
  assert.equal(controller.pointerId, null);
});
test('keyboard add stops at six and selects each newly added source', () => {
  const {controller, field} = fixture();
  for(let i = 0; i < 9; i++) controller.addSource();
  assert.equal(field.sources.length, 6);
  assert.equal(controller.selectedId, field.sources.at(-1).id);
  assert.equal(new Set(field.sources.map(s => `${s.nx},${s.ny}`)).size, 6);
});
test('source list can choose either of two overlapping sources', () => {
  const {controller, field} = fixture();
  field.sources[0].moveTo(.5, .5); field.sources[1].moveTo(.5, .5);
  controller.selectSource(field.sources[0].id);
  controller.moveSelected(.01, 0);
  assert.equal(field.sources[0].nx, .51);
  assert.equal(field.sources[1].nx, .5);
  controller.selectSource(999);
  assert.equal(controller.selectedId, field.sources[0].id);
});
test('empty field can be rebuilt without a pointer', () => {
  const {controller, field} = fixture();
  field.sources = []; controller.selectedId = null;
  controller.addSource();
  assert.equal(field.sources.length, 1);
  assert.equal(field.sources[0].nx, .5);
  controller.removeSelected();
  assert.equal(field.sources.length, 0);
  assert.equal(controller.selectedId, null);
});
