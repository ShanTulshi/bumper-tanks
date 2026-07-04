// One-finger input: pointerdown anywhere on the canvas is a tap.
// CSS `touch-action: none` on the canvas kills scroll/zoom gestures.

export function attachInput(canvas, onTap) {
  function handle(e) {
    if (e.button != null && e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    onTap(e.clientX - rect.left, e.clientY - rect.top);
    e.preventDefault();
  }
  canvas.addEventListener('pointerdown', handle);
  return () => canvas.removeEventListener('pointerdown', handle);
}
