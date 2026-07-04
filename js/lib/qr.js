// Thin wrapper over the vendored qrcode-generator UMD global.
export function qrDataURL(text, cellSize = 5) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(cellSize, 2);
}
