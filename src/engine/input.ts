// One-finger input: pointerdown anywhere on the canvas is a tap.
// CSS `touch-action: none` on the canvas kills scroll/zoom gestures.

export function attachInput(canvas: HTMLCanvasElement, onTap: (x: number, y: number) => void): () => void {
  function handle(e: PointerEvent): void {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    onTap(e.clientX - rect.left, e.clientY - rect.top);
    e.preventDefault();
  }
  canvas.addEventListener('pointerdown', handle);
  return () => canvas.removeEventListener('pointerdown', handle);
}
