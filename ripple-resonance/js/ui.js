 //* DOM events are standard browser APIs. Reference: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
 //*/
class ArtworkUI {
  constructor(actions) {
    this.actions = actions;
    const find = id => document.getElementById(id);
    this.find = find;
    this.controls = ['strength','spacing','drift'].map(find);
    find('add-button').addEventListener('click', actions.add);
    find('source-select').addEventListener('change', event => actions.select(Number(event.target.value)));
    find('strength').addEventListener('input', event => {
      const selected = actions.getSelected();
      if (selected) selected.amplitude = Number(event.target.value);
      actions.onChange();
    });
    find('spacing').addEventListener('input', event => {
      actions.field.spacing = Number(event.target.value) / 100;
      actions.onChange();
    });
    find('drift').addEventListener('input', event => {
      actions.flow.amount = Number(event.target.value) / 100;
      actions.onChange();
    });
    find('phase-button').addEventListener('click', () => this.reverseSelected());
    find('remove-button').addEventListener('click', actions.remove);
    find('pause-button').addEventListener('click', actions.togglePause);
    find('save-button').addEventListener('click', actions.save);
    find('reset-button').addEventListener('click', actions.restore);
    find('clear-button').addEventListener('click', actions.clear);
    find('seed-button').addEventListener('click', actions.reseed);
    document.addEventListener('keydown', event => this.keyDown(event));
  }

  reverseSelected() {
    const selected = this.actions.getSelected();
    if (selected) selected.reversePhase();
    this.actions.onChange();
  }

  keyDown(event) {
    // Preserve normal form navigation, shortcuts and button activation.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.activeElement.isContentEditable ||
        ['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY'].includes(document.activeElement.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === 'a' && !event.repeat) this.actions.add();
    if (key === ' ') { event.preventDefault(); this.actions.togglePause(); }
    if (key === 'p') this.reverseSelected();
    if (key === 'r') this.actions.restore();
    if (key === 'n') this.actions.reseed();
    if (key === 's') this.actions.save();
    if (key === 'g') this.actions.toggleGuides();
    if (key === 'delete' || key === 'backspace') { event.preventDefault(); this.actions.remove(); }
    if (['arrowleft','arrowright','arrowup','arrowdown'].includes(key) &&
        document.activeElement.id === 'ripple-canvas') {
      event.preventDefault();
      const step = event.shiftKey ? 0.03 : 0.01;
      this.actions.move(key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
                        key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0);
    }
  }

  sync(field, flow, selected, paused) {
    const find = this.find;
    const selector = find('source-select');
    const signature = field.sources.map(source => `${source.id}:${source.phase}`).join(',');
    if (selector.dataset.sources !== signature) {
      selector.replaceChildren();
      for (const source of field.sources) {
        const option = document.createElement('option');
        option.value = source.id;
        option.textContent = `Source ${String(source.id).padStart(2,'0')} (${source.phase === 0 ? '+' : '−'})`;
        selector.append(option);
      }
      if (!field.sources.length) {
        const option = document.createElement('option');
        option.textContent = 'No sources'; selector.append(option);
      }
      selector.dataset.sources = signature;
    }
    selector.disabled = !field.sources.length;
    if (selected) selector.value = selected.id;
    find('add-button').disabled = field.sources.length >= field.maxSources;
    find('selected-source').textContent = selected ? String(selected.id).padStart(2,'0') : '—';
    find('strength').disabled = !selected;
    find('phase-button').disabled = !selected;
    find('remove-button').disabled = !selected;
    if (selected) find('strength').value = selected.amplitude;
    find('strength-output').value = selected ? selected.amplitude.toFixed(2) : '—';
    find('spacing').value = Math.round(field.spacing * 100);
    find('spacing-output').value = `${Math.round(field.spacing*100)}%`;
    find('drift').value = Math.round(flow.amount * 100);
    find('drift-output').value = `${Math.round(flow.amount*100)}%`;
    const reversed = selected?.phase === Math.PI;
    find('phase-button').setAttribute('aria-pressed', String(reversed));
    find('phase-button').textContent = reversed ? 'Phase reversed' : 'Reverse phase';
    find('phase-description').textContent = !selected ? 'Add a source to shape the field.' :
      reversed ? 'This source has the opposite phase.' : 'This source rises with the wave.';
    find('pause-button').textContent = paused ? 'Resume' : 'Pause';
    find('pause-button').setAttribute('aria-pressed', String(paused));
    find('source-count').textContent = `${field.sources.length} / ${field.maxSources} sources`;
    find('seed-label').textContent = flow.seed;
    find('scene-status').textContent = paused ? 'Time is paused. You can still reshape the field.' :
      `${field.sources.length} ${field.sources.length === 1 ? 'source' : 'sources'}. One shared field.`;
  }
}
