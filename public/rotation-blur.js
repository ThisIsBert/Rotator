// Keep the short exposure of the original renderer. Only sampling changes.
export const EXPOSURE_SECONDS = 0.006;
export const MAX_SAMPLES = 256;
export const MAX_BUFFER_SIZE = 1024;
export function blurPlan(speed, radiusPixels) {
  const sweep = speed * EXPOSURE_SECONDS;
  const travel = Math.abs(sweep) * radiusPixels;
  const samples = Math.min(MAX_SAMPLES, 2 ** Math.ceil(Math.log2(Math.max(1, travel))));
  return {sweep, samples, step: sweep / samples};
}

// Doubling the accumulated orientations each pass gives 2, 4, 8, ... samples
// with only two draws per pass. No previous display frames are retained.
export class RotationBlur {
  constructor() {
    this.buffers = Array.from({length:2}, () => {
      const canvas = document.createElement('canvas');
      return {canvas, ctx:canvas.getContext('2d', {alpha:false})};
    });
    this.cached = null;
  }

  frame(ink, speed, radiusPixels, revision) {
    // Bound fill-rate and memory on high-DPI tablets. This affects only the
    // motion-blurred preview; the original ink and the stopped view stay sharp.
    const size = Math.max(2, Math.min(ink.width, MAX_BUFFER_SIZE, Math.ceil(radiusPixels * 2)));
    const plan = blurPlan(speed, size / 2);
    if (plan.samples === 1) return {canvas:ink, offset:0, samples:1};
    const old = this.cached;
    // Reuse only while the change at the outer edge is subpixel. The current
    // rotation is applied independently every frame, so motion stays smooth.
    if (old && old.revision === revision && old.size === size &&
        old.samples === plan.samples && Math.abs(old.sweep-plan.sweep)*size/2 < 0.25) return old;

    for (const buffer of this.buffers) {
      if (buffer.canvas.width !== size) buffer.canvas.width = buffer.canvas.height = size;
    }
    let source = this.buffers[0], target = this.buffers[1];
    const initial = source.ctx;
    initial.setTransform(1,0,0,1,0,0);
    initial.globalAlpha=1;initial.fillStyle='#000';initial.fillRect(0,0,size,size);
    initial.drawImage(ink,0,0,size,size);
    for (let count=1; count<plan.samples; count*=2) {
      const ctx=target.ctx;
      ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
      ctx.drawImage(source.canvas,0,0);
      ctx.translate(size/2,size/2);ctx.rotate(-plan.step*count);
      // Both buffers are opaque. Source-over at 1/2 is an equal-weight mean,
      // preserving brightness without hundreds of tiny alpha contributions.
      ctx.globalAlpha=0.5;
      ctx.drawImage(source.canvas,-size/2,-size/2);
      [source,target]=[target,source];
    }
    this.cached={canvas:source.canvas,offset:-plan.step/2,samples:plan.samples,sweep:plan.sweep,size,revision};
    return this.cached;
  }
}
