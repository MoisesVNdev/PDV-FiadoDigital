import fs from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Instala sharp temporariamente se não houver
try {
  require.resolve('sharp');
} catch (e) {
  console.log("A biblioteca 'sharp' é necessária para gerar os PNGs. Instalando temporariamente...");
  execSync('npm install --no-save sharp', { stdio: 'inherit' });
}

const sharp = (await import('sharp')).default;

const ICONS_DIR = resolve(__dirname, '../apps/web/public/icons');

const sizes = [192, 512];
const bgColor = '#1e40af';
const textColor = '#ffffff';

async function generateIcons() {
  await fs.mkdir(ICONS_DIR, { recursive: true });

  for (const size of sizes) {
    const svgBuffer = Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${bgColor}"/>
        <text 
          x="50%" 
          y="50%" 
          font-family="system-ui, sans-serif" 
          font-size="${size * 0.3}px" 
          font-weight="bold" 
          fill="${textColor}" 
          dominant-baseline="central" 
          text-anchor="middle"
        >PDV</text>
      </svg>
    `);

    const destPath = resolve(ICONS_DIR, `icon-${size}x${size}.png`);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(destPath);
      
    console.log(`Ícone gerado com sucesso: ${destPath}`);
  }
}

generateIcons().catch(console.error);
