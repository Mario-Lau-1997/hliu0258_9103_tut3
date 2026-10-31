/*
 * Pointer Events handle mouse, touch and pen through one path.
 * Pointer capture keeps dragging reliable when the pointer leaves the canvas.
 * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
 * https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
 */
class InputController {
  constructor(canvas, field, onChange, edit = {begin() {}, end() {}}, playSound = () => {}) {
    this.edit = edit;
    this.playSound = playSound;
    this.canvas = canvas;
    this.field = field;
    this.onChange = onChange;
    this.selectedId = field.sources.at(-1)?.id ?? null;
    this.dragId = null;
    this.pointerId = null;
    canvas.addEventListener('pointerdown', event => this.pointerDown(event));
    canvas.addEventListener('pointermove', event => this.pointerMove(event));
    // End only the pointer that owns this drag (important for multi-touch).
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, event => {
        if (event.pointerId === this.pointerId) this.cancelDrag();
      });
    }
    canvas.addEventListener('contextmenu', event => event.preventDefault());
  }

  position(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {nx: (event.clientX - rect.left) / rect.width,
            ny: (event.clientY - rect.top) / rect.height,
            width: rect.width, height: rect.height};
  }

  hitTest(position) {
    let nearest = null, nearestDistance = Infinity;
    for (const source of this.field.sources) {
      const distance = Math.hypot((source.nx - position.nx) * position.width,
                                  (source.ny - position.ny) * position.height);
      if (distance < 25 && distance < nearestDistance) {
        nearest = source; nearestDistance = distance;
      }
    }
    return nearest;
  }

  pointerDown(event) {
    if (event.button !== 0 || this.pointerId !== null) return;
    event.preventDefault();
    this.canvas.focus({preventScroll: true});
    const position = this.position(event);
    let source = this.hitTest(position);
    if (!source && this.field.sources.length >= this.field.maxSources) {
      document.getElementById('scene-status').textContent = 'Six sources in this field. Move or remove one to make space.';
      return;
    }
    this.edit.begin(source ? 'Move source' : 'Add source');
    if (!source) {
      const phase = event.shiftKey ? Math.PI : 0;
      source = this.field.addSource(position.nx, position.ny, 0.85, phase);
    }
    if (!source) {
      document.getElementById('scene-status').textContent = 'Six sources in this field. Move or remove one to make space.';
      return;
    }
    this.selectedId = source.id;
    this.dragId = source.id;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.playSound('add', source.nx);
    this.onChange();
  }

  pointerMove(event) {
    if (this.pointerId !== event.pointerId || this.dragId === null) return;
    const source = this.field.sources.find(item => item.id === this.dragId);
    if (!source) return this.cancelDrag();
    const position = this.position(event);
    source.moveTo(position.nx, position.ny);
    this.playSound('move', source.nx);
    this.onChange();
  }

  cancelDrag() {
    const pointerId = this.pointerId;
    this.pointerId = null;
    this.dragId = null;
    if (pointerId !== null && this.canvas.hasPointerCapture(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
    if (pointerId !== null) this.edit.end();
  }

  removeSelected() {
    this.cancelDrag();
    this.edit.begin('Remove source');
    this.field.removeSource(this.selectedId);
    this.selectedId = this.field.sources.at(-1)?.id ?? null;
    this.edit.end();
    this.onChange();
  }

  selectSource(id) {
    if (!this.field.sources.some(source => source.id === id)) return;
    this.cancelDrag();
    this.selectedId = id;
    this.onChange();
  }

  addSource() {
    this.cancelDrag();
    if (this.field.sources.length >= this.field.maxSources) return;
    // Choose a free area so keyboard-added sources are easy to find.
    const positions = [[.5,.5],[.2,.25],[.8,.75],[.8,.25],[.2,.75],[.5,.2],[.5,.8]];
    const {width, height} = this.canvas.getBoundingClientRect();
    let best = positions[0], bestDistance = -1;
    for (const position of positions) {
      const distance = this.field.sources.length ? Math.min(...this.field.sources.map(source =>
        Math.hypot((source.nx-position[0])*width, (source.ny-position[1])*height))) : Infinity;
      if (distance > bestDistance) { best = position; bestDistance = distance; }
    }
    this.edit.begin('Add source');
    const source = this.field.addSource(best[0], best[1]);
    this.selectedId = source.id;
    this.edit.end();
    this.playSound('add', source.nx);
    this.onChange();
  }

  moveSelected(dx, dy) {
    const source = this.field.sources.find(item => item.id === this.selectedId);
    if (!source) return;
    this.edit.begin('Move source');
    source.moveTo(source.nx + dx, source.ny + dy);
    this.edit.end();
    this.playSound('move', source.nx);
    this.onChange();
  }
}
