export const WIDTHS = [0.012, 0.024, 0.048, 0.09];
export function contactPressure(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}
export function strokeWidth(size, type, pressure, enabled = true, eraser = false) {
  const factor = type === 'pen' && enabled ? 0.25 + 1.5 * contactPressure(pressure) : 1;
  return WIDTHS[size] * factor * (eraser ? 5 : 1);
}
export function nextHue(hue, distance) { return (hue + distance * 240) % 360; }
export function recentColors(colors, color) {
  return [color, ...colors.filter(c => c !== color)].slice(0, 6);
}
