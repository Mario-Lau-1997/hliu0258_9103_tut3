/*
 * noise() gives spatially smooth directions. Seeded random() sets particle data.
 * References: https://p5js.org/reference/p5/noise/
 * https://p5js.org/reference/p5/noiseSeed/ and https://p5js.org/reference/p5/randomSeed/
 * Flow-field inspiration: https://natureofcode.com/autonomous-agents/#flow-fields
 */
class PerlinFlow {
  constructor(p, seed = 7321) {
    this.p = p;
    this.amount = 0.28;
    this.reseed(seed);
  }

  reseed(seed) {
    this.seed = seed;
    this.p.noiseSeed(seed);
    this.p.randomSeed(seed);
  }

  directionAt(x, y, time, unit, result) {
    const angle = this.p.noise(x / unit * 1.8, y / unit * 1.8, time * 0.075) * Math.PI * 4;
    result.x = Math.cos(angle) * this.amount * 32;
    result.y = Math.sin(angle) * this.amount * 32;
    return result;
  }
}
