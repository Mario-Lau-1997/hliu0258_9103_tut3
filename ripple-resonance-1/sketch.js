/*
 * Ripple: Resonance. Interactive p5.js artwork.
 * The main sketch coordinates modules. Mechanics stay in descriptive files.
 * See README.md for the full explanation and references.
 */
const RIPPLE_SETTINGS = Object.freeze({seed: 7321, maximumStep: 1 / 24});

new p5(function(p) {
  let field, flow, particles, controls, ui, canvas, backgroundImage;
  let backgroundReady = false;
  let sceneTime = 0;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let guidesVisible = true;
  let dirty = true;
  let resizeObserver;
  const host = document.getElementById('canvas-host');

  function selectedSource() {
    return controls ? field.sources.find(source => source.id === controls.selectedId) : field.sources.at(-1);
  }

  function sync() {
    dirty = true;
    if (ui) ui.sync(field, flow, selectedSource(), paused);
  }

  function restoreScene() {
    if (controls) controls.cancelDrag();
    field.restore(); flow.amount = 0.28; flow.reseed(RIPPLE_SETTINGS.seed);
    sceneTime = 0; particles.restart();
    if (controls) controls.selectedId = field.sources.at(-1).id;
    sync();
  }

  function resizeArtwork() {
    const width = Math.max(240, Math.round(host.clientWidth));
    const height = Math.max(240, Math.round(host.clientHeight));
    if (width === p.width && height === p.height) return;
    p.resizeCanvas(width, height);
    field.resize(width, height);
    particles.resize(width, height);
    sync();
  }

  // p5.js 1.11.11 waits for preload before setup. Embedded image bytes work offline.
  p.preload = function() {
    backgroundImage = p.loadImage(RIPPLE_BACKGROUND_DATA,
      () => { backgroundReady = true; },
      () => { backgroundReady = false; });
  };

  p.setup = function() {
    p.pixelDensity(1);
    canvas = p.createCanvas(host.clientWidth, host.clientHeight);
    canvas.parent(host);
    canvas.elt.id = 'ripple-canvas';
    canvas.elt.tabIndex = 0;
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'Interactive waves. Click or press A to add a source. Use the source list to select, then focus this canvas and use arrow keys to move. P reverses phase.');
    document.getElementById('loading-message').remove();
    p.frameRate(45);
    field = new WaveField(); field.restore(); field.resize(p.width, p.height);
    flow = new PerlinFlow(p, RIPPLE_SETTINGS.seed);
    particles = new ParticleSystem(p, p.width, p.height);
    controls = new InputController(canvas.elt, field, sync);
    ui = new ArtworkUI({
      field, flow, getSelected: selectedSource, onChange: sync,
      add: () => controls.addSource(),
      select: id => controls.selectSource(id),
      remove: () => controls.removeSelected(),
      move: (dx,dy) => controls.moveSelected(dx,dy),
      togglePause: () => { paused = !paused; sync(); },
      clear: () => { controls.cancelDrag(); field.sources = []; particles.restart(); controls.selectedId = null; sync(); },
      restore: restoreScene,
      reseed: () => { flow.reseed((flow.seed + 7919) % 100000); particles.restart(); sync(); },
      save: () => p.saveCanvas(canvas, 'ripple-resonance', 'png'),
      toggleGuides: () => { guidesVisible = !guidesVisible; dirty = true; }
    });
    resizeObserver = new ResizeObserver(resizeArtwork);
    resizeObserver.observe(host);
    document.addEventListener('visibilitychange', () => { if (document.hidden && controls) controls.cancelDrag(); });
    window.addEventListener('blur', () => { if (controls) controls.cancelDrag(); });
    sync();
    // Read-only diagnostics help repeatable testing without adding UI clutter.
    window.rippleDiagnostics = () => ({
      sourceCount: field.sources.length,
      sources: field.sources.map(source => ({id:source.id,nx:source.nx,ny:source.ny,phase:source.phase,amplitude:source.amplitude})),
      selectedId: controls ? controls.selectedId : null,
      seed: flow.seed, drift: flow.amount, spacing: field.spacing,
      width:p.width, height:p.height, particleCount:particles.particles.length,
      backgroundReady, backgroundWidth: backgroundImage?.width, backgroundHeight: backgroundImage?.height,
      sceneTime, paused, fps:p.frameRate(), canvasCount:host.querySelectorAll('canvas').length
    });
  };

  p.draw = function() {
    if (!field || (paused && !dirty)) return;
    const dt = paused ? 0 : Math.min(RIPPLE_SETTINGS.maximumStep, p.deltaTime / 1000);
    sceneTime += dt;
    field.update(sceneTime);
    drawBackdrop();
    if (!paused) particles.update(field, flow, sceneTime, dt);
    particles.display(p);
    field.drawContours(p);
    if (guidesVisible) drawGuides();
    if (!field.sources.length) drawEmptyState();
    dirty = false;
  };

  function drawBackdrop() {
    p.background(7, 24, 32);
    if (!backgroundReady) { field.drawWash(p); return; }
    // Cover the canvas without stretching the supplied square painting.
    const scale = Math.max(p.width / backgroundImage.width, p.height / backgroundImage.height);
    const width = backgroundImage.width * scale, height = backgroundImage.height * scale;
    p.image(backgroundImage, (p.width-width)/2, (p.height-height)/2, width, height);
    const context = p.drawingContext;
    context.save();
    // A light veil keeps moving contours readable; the image itself is unchanged.
    context.fillStyle = 'rgba(7,24,32,0.12)';
    context.fillRect(0,0,p.width,p.height);
    context.globalAlpha = 0.16;
    field.drawWash(p);
    context.restore();
  }

  function drawGuides() {
    p.push(); p.textFont('Arial'); p.textSize(10); p.textAlign(p.LEFT, p.CENTER);
    for (const source of field.sources) {
      const x = source.nx * p.width, y = source.ny * p.height;
      const selected = selectedSource()?.id === source.id;
      const colour = source.phase === 0 ? [133,215,202] : [236,162,138];
      p.fill(7,24,32,205); p.stroke(...colour, selected ? 255 : 200); p.strokeWeight(1);
      p.circle(x, y, selected ? 25 : 16);
      p.noStroke(); p.fill(...colour); p.circle(x, y, 4);
      p.fill(225,232,223,selected ? 240 : 155);
      // Overlapping example sources share one label; the source list exposes all IDs.
      const neighbours = field.sources.filter(other =>
        Math.hypot((other.nx-source.nx)*p.width, (other.ny-source.ny)*p.height) < 30);
      const labelled = neighbours.find(other => other.id === selectedSource()?.id) || neighbours.at(-1);
      if (labelled.id === source.id) {
        const label = `${String(source.id).padStart(2,'0')} ${source.phase === 0 ? '+' : '−'}`;
        p.fill(7,24,32,220); p.rect(x+14, y-25, p.textWidth(label)+8, 18, 3);
        p.fill(238,234,224); p.text(label, x+18, y-16);
      }
    }
    p.pop();
  }

  function drawEmptyState() {
    p.push(); p.textAlign(p.CENTER, p.CENTER); p.noStroke();
    p.fill(7,24,32,215);
    const panelWidth = Math.min(p.width-32,440);
    p.rect((p.width-panelWidth)/2,p.height/2-43,panelWidth,88,4);
    p.fill(218,235,226);
    p.textFont('Georgia'); p.textSize(Math.min(28, p.width / 18));
    p.text('Start with one small action.', p.width/2, p.height/2-12);
    p.textFont('Arial'); p.textSize(11); p.fill(130,161,162);
    p.text('Click anywhere to place a source.', p.width/2, p.height/2+22);p.pop();
  }

  p.windowResized = resizeArtwork;
});
