// Thin wrapper over the vendored qrcode-generator UMD global.

export function qrDataURL(text: string, cellSize = 5): string {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize, 2);
}
