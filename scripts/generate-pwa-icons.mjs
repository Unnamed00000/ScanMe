import QRCode from 'qrcode';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const iconsDir = resolve('public', 'icons');
await mkdir(iconsDir, { recursive: true });

for (const size of [192, 512]) {
  await QRCode.toFile(resolve(iconsDir, `icon-${size}.png`), 'https://unnamed00000.github.io/ScanMe/', {
    width: size,
    margin: 3,
    errorCorrectionLevel: 'H',
    color: { dark: '#c9ff38', light: '#090b10' },
  });
}
