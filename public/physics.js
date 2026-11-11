export const TAU = Math.PI * 2;
export const MAX_SPEED = TAU * 8;
export const DRAG = 0.075;
export function angleDelta(a, b) { return Math.atan2(Math.sin(a-b), Math.cos(a-b)); }
export function advance(angle, speed, dt, drag = DRAG) {
  const decay = Math.exp(-drag * dt);
  return { angle: angle + (drag ? speed * (1-decay)/drag : speed*dt), speed: speed*decay };
}
export function toDisc(x, y, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: x*c + y*s, y: -x*s + y*c };
}
// Sample the rotating surface, not just pointer events. Even a stationary pen draws.
export function strokeSamples(from, to, a0, a1, radius, spacing = 0.002) {
  const distance = Math.hypot(to.x-from.x,to.y-from.y) + Math.abs(a1-a0)*radius;
  const count = Math.max(1, Math.ceil(distance/spacing));
  return Array.from({length:count+1}, (_,i) => {
    const t=i/count;
    return toDisc(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,a0+(a1-a0)*t);
  });
}
