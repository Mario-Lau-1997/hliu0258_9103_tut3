/*
 * Snapshots hold scene settings only, not canvas pixels or particle arrays.
 * Each drag/slider gesture becomes one edit. The newest 30 edits are retained.
 */
class SceneHistory {
  constructor(read, apply, onChange = () => {}, limit = 30) {
    this.read = read; this.apply = apply; this.onChange = onChange;
    this.limit = limit; this.past = []; this.future = []; this.pending = null;
  }
  copy(value) { return JSON.parse(JSON.stringify(value)); }
  content(state) {
    // Choosing a source is navigation, not an artwork edit.
    const {selectedId, ...content} = state;
    return JSON.stringify(content);
  }
  begin(label) {
    if (this.pending?.label === label) return;
    this.commit();
    this.pending = {label, state: this.copy(this.read())};
  }
  commit() {
    if (!this.pending) return false;
    const entry = this.pending; this.pending = null;
    if (this.content(entry.state) === this.content(this.read())) return false;
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.onChange();
    return true;
  }
  perform(label, change) {
    this.commit(); this.begin(label); change(); this.commit();
  }
  undo() {
    this.commit();
    const entry = this.past.pop();
    if (!entry) return;
    this.future.push({label: entry.label, state: this.copy(this.read())});
    this.apply(this.copy(entry.state));
    this.onChange();
  }
  redo() {
    this.commit();
    const entry = this.future.pop();
    if (!entry) return;
    this.past.push({label: entry.label, state: this.copy(this.read())});
    this.apply(this.copy(entry.state));
    this.onChange();
  }
  status() {
    return {undoCount: this.past.length, redoCount: this.future.length,
      undoLabel: this.past.at(-1)?.label || '', redoLabel: this.future.at(-1)?.label || ''};
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = {SceneHistory};
