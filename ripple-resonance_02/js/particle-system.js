/*
 * AI assistance: ChatGPT/Codex helped implement the particles and trail buffer.
 * General flow-field idea: Shiffman, The Nature of Code, chapter 5.
 * https://natureofcode.com/autonomous-agents/#flow-fields
 * This project combines a wave gradient with Perlin drift using original code.
 * The paths are an artistic response to the field, not simulated water motion.
 */
class TraceParticle {
  constructor(p, width, height) { this.reset(p, width, height, true); }

  reset(p, width, height, initial = false) {
    this.x = p.random(width);
    this.y = p.random(height);
    this.vx = 0;
    this.vy = 0;
    this.life = p.random(3.5, 8);
    this.age = initial ? p.random(this.life) : 0;
    this.weight = p.random(0.45, 0.95);
    this.brightness = p.random(0.32, 0.74);
  }
}

class ParticleSystem {
  constructor(p, width, height) {
    this.p = p;
    this.gradient = {x: 0, y: 0};
    this.drift = {x: 0, y: 0};
    this.resize(width, height);
  }

  resize(width, height) {
    if (this.layer) this.layer.remove();
    this.width = width;
    this.height = height;
    this.layer = this.p.createGraphics(width, height);
    this.layer.pixelDensity(1);
    this.layer.clear();
    const count = Math.min(1500, Math.max(450, Math.round(width * height / 480)));
    this.particles = Array.from({length: count}, () => new TraceParticle(this.p, width, height));
  }

  restart() {
    this.layer.clear();
    this.particles.forEach(particle => particle.reset(this.p, this.width, this.height, true));
  }

  update(field, flow, time, dt) {
    const context = this.layer.drawingContext;
    // Erase some alpha, leaving a temporary memory of earlier paths.
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt * 1.45)})`;
    context.fillRect(0, 0, this.width, this.height);
    context.globalCompositeOperation = 'source-over';
    context.lineCap = 'round';
    const unit = Math.min(this.width, this.height);
    const follow = 1 - Math.exp(-dt * 5);
    for (const particle of this.particles) {
      particle.age += dt;
      if (particle.age > particle.life || particle.x < 0 || particle.y < 0 ||
          particle.x > this.width || particle.y > this.height) {
        particle.reset(this.p, this.width, this.height);
        continue;
      }
      field.gradientAt(particle.x, particle.y, this.gradient);
      flow.directionAt(particle.x, particle.y, time, unit, this.drift);
      // Rotate the gradient by 90 degrees to follow, rather than cross, contours.
      let targetX = -this.gradient.y * 290 + this.drift.x;
      let targetY = this.gradient.x * 290 + this.drift.y;
      const speed = Math.hypot(targetX, targetY);
      if (speed > 94) { targetX *= 94 / speed; targetY *= 94 / speed; }
      particle.vx += (targetX - particle.vx) * follow;
      particle.vy += (targetY - particle.vy) * follow;
      const oldX = particle.x, oldY = particle.y;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      const value = field.valueAt(oldX, oldY);
      const fade = Math.min(1, particle.age * 2, (particle.life - particle.age) * 1.5);
      const alpha = Math.max(0, fade) * particle.brightness;
      context.strokeStyle = value >= 0 ? `rgba(149,226,209,${alpha})` : `rgba(242,186,154,${alpha})`;
      context.lineWidth = particle.weight;
      context.beginPath(); context.moveTo(oldX, oldY); context.lineTo(particle.x, particle.y); context.stroke();
    }
    context.restore();
  }

  display(p) { p.image(this.layer, 0, 0); }
}
