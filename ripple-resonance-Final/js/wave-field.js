/*
 * It adds damped radial waves and draws contours of their combined value.
 * Wave superposition inspiration: https://www.feynmanlectures.caltech.edu/I_29.html
 * Contour technique: https://scikit-image.org/docs/stable/api/skimage.measure.html#skimage.measure.find_contours
 * The JavaScript below was written for this project, not copied from scikit-image.
 * This is an artistic field, not a numerical simulation of water.
 */

class WaveSource {
  constructor(id, nx, ny, amplitude = 0.85, phase = 0) {
    this.id = id;
    // Normalised positions preserve the layout when the browser resizes.
    this.nx = nx;
    this.ny = ny;
    this.amplitude = amplitude;
    this.phase = phase;
  }

  reversePhase() { this.phase = this.phase === 0 ? Math.PI : 0; }

  moveTo(nx, ny) {
    this.nx = Math.max(0.025, Math.min(0.975, nx));
    this.ny = Math.max(0.025, Math.min(0.975, ny));
  }
}

class WaveField {
  constructor() {
    this.sources = [];
    this.nextId = 1;
    this.maxSources = 6;
    this.spacing = 0.18;
    this.speed = 1.6;
    this.decay = 1.75;
    this.audioBoost = 1;
    this.grid = null;
    this.columns = 0;
    this.rows = 0;
  }

  addSource(nx, ny, amplitude = 0.85, phase = 0) {
    if (this.sources.length >= this.maxSources) return null;
    const source = new WaveSource(this.nextId++, nx, ny, amplitude, phase);
    source.moveTo(nx, ny);
    this.sources.push(source);
    return source;
  }

  removeSource(id) {
    this.sources = this.sources.filter(source => source.id !== id);
  }

  restore() {
    this.sources = [];
    this.nextId = 1;
    this.spacing = 0.18;
    this.addSource(0.37, 0.52, 0.85, 0);
    this.addSource(0.65, 0.43, 0.85, Math.PI);
  }

  // The field is a sum, so equal opposite sources at the same point cancel.
  sample(x, y, time, width, height) {
    const unit = Math.min(width, height);
    const waveNumber = Math.PI * 2 / this.spacing;
    let value = 0;
    for (const source of this.sources) {
      const dx = (x - source.nx * width) / unit;
      const dy = (y - source.ny * height) / unit;
      const distance = Math.hypot(dx, dy);
      const envelope = source.amplitude * Math.exp(-this.decay * distance);
      value += envelope * Math.sin(waveNumber * distance - this.speed * time + source.phase);
    }
    return value * this.audioBoost;
  }

  resize(width, height) {
    // Bound the grid size rather than sampling every physical screen pixel.
    this.columns = Math.max(36, Math.min(150, Math.ceil(width / 8)));
    this.rows = Math.max(30, Math.min(110, Math.ceil(height / 8)));
    this.grid = new Float32Array((this.columns + 1) * (this.rows + 1));
    this.width = width;
    this.height = height;
    this.cellWidth = width / this.columns;
    this.cellHeight = height / this.rows;
  }

  update(time) {
    const stride = this.columns + 1;
    for (let row = 0; row <= this.rows; row++) {
      for (let column = 0; column <= this.columns; column++) {
        this.grid[row * stride + column] = this.sample(
          column * this.cellWidth, row * this.cellHeight,
          time, this.width, this.height
        );
      }
    }
  }

  // Bilinear interpolation gives particles a smooth value between grid points.
  valueAt(x, y) {
    const gx = Math.max(0, Math.min(this.columns - 0.001, x / this.cellWidth));
    const gy = Math.max(0, Math.min(this.rows - 0.001, y / this.cellHeight));
    const column = Math.floor(gx), row = Math.floor(gy);
    const tx = gx - column, ty = gy - row;
    const stride = this.columns + 1, index = row * stride + column;
    const a = this.grid[index], b = this.grid[index + 1];
    const d = this.grid[index + stride], c = this.grid[index + stride + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) +
           (d * (1 - tx) + c * tx) * ty;
  }

  gradientAt(x, y, result) {
    // Central differences estimate the direction of greatest change.
    const step = Math.min(this.cellWidth, this.cellHeight);
    result.x = (this.valueAt(x + step, y) - this.valueAt(x - step, y)) / 2;
    result.y = (this.valueAt(x, y + step) - this.valueAt(x, y - step)) / 2;
    return result;
  }

  drawContours(p) {
    if (!this.sources.length) return;
    const levels = [-0.44, -0.14, 0.14, 0.44];
    const context = p.drawingContext;
    const stride = this.columns + 1;
    context.save();
    context.lineWidth = 0.85;
    for (const level of levels) {
      context.beginPath();
      for (let row = 0; row < this.rows; row++) {
        for (let column = 0; column < this.columns; column++) {
          const index = row * stride + column;
          const a = this.grid[index], b = this.grid[index + 1];
          const c = this.grid[index + stride + 1], d = this.grid[index + stride];
          // Uniform cells have no contour at this level.
          const minimum = Math.min(a, b, c, d), maximum = Math.max(a, b, c, d);
          if (level <= minimum || level >= maximum) continue;
          const segments = contourSegments(a, b, c, d, level);
          const x = column * this.cellWidth, y = row * this.cellHeight;
          for (const segment of segments) {
            context.moveTo(x + segment[0] * this.cellWidth, y + segment[1] * this.cellHeight);
            context.lineTo(x + segment[2] * this.cellWidth, y + segment[3] * this.cellHeight);
          }
        }
      }
      const opacity = Math.abs(level) > 0.3 ? 0.64 : 0.31;
      context.strokeStyle = level > 0 ? `rgba(114,216,199,${opacity})` : `rgba(237,166,139,${opacity})`;
      context.stroke();
    }
    context.restore();
  }

  drawWash(p) {
    if (!this.texture || this.texture.width !== this.columns + 1 || this.texture.height !== this.rows + 1) {
      this.texture = p.createImage(this.columns + 1, this.rows + 1);
    }
    this.texture.loadPixels();
    for (let i = 0; i < this.grid.length; i++) {
      const value = this.grid[i];
      const amount = Math.min(1, Math.abs(value) * 0.68);
      const offset = i * 4;
      // Opposite signs use different colours, independently of source labels.
      this.texture.pixels[offset] = 7 + amount * (value > 0 ? 13 : 54);
      this.texture.pixels[offset + 1] = 24 + amount * (value > 0 ? 56 : 17);
      this.texture.pixels[offset + 2] = 32 + amount * (value > 0 ? 49 : 9);
      this.texture.pixels[offset + 3] = 255;
    }
    this.texture.updatePixels();
    p.image(this.texture, 0, 0, this.width, this.height);
  }
}

// Marching squares: find edge crossings of a value in one four-corner cell.
// Corner order is clockwise: a=top-left, b=top-right, c=bottom-right, d=bottom-left.
// In saddle cells, the average centre value selects a consistent connection.
function contourSegments(a, b, c, d, level) {
  const points = [];
  function crossing(v1, v2, x1, y1, x2, y2, edge) {
    if ((v1 >= level) === (v2 >= level)) return;
    const t = (level - v1) / (v2 - v1);
    points.push({x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, edge});
  }
  crossing(a, b, 0, 0, 1, 0, 0);
  crossing(b, c, 1, 0, 1, 1, 1);
  crossing(c, d, 1, 1, 0, 1, 2);
  crossing(d, a, 0, 1, 0, 0, 3);
  function pair(i, j) { return [points[i].x, points[i].y, points[j].x, points[j].y]; }
  if (points.length === 2) return [pair(0, 1)];
  if (points.length !== 4) return [];
  const centreHigh = (a + b + c + d) / 4 >= level;
  const cornerAHigh = a >= level;
  return centreHigh === cornerAHigh
    ? [pair(0, 1), pair(2, 3)]
    : [pair(0, 3), pair(1, 2)];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {WaveSource, WaveField, contourSegments};
}
