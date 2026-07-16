import sharp from 'sharp'
import fs from 'fs'

const svg = fs.readFileSync('public/favicon.svg')

// maskable needs padding so icon isn't clipped by mask
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f59e0b"/>
  <g transform="translate(112 96) scale(4.5)">
    <rect width="64" height="64" rx="14" fill="#fff"/>
    <rect x="14" y="22" width="36" height="6" rx="3" fill="#f59e0b"/>
    <rect x="14" y="34" width="36" height="6" rx="3" fill="#fbbf24"/>
    <rect x="14" y="46" width="24" height="6" rx="3" fill="#fcd34d"/>
  </g>
</svg>`

await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile('public/icon-512-maskable.png')
console.log('icons generated')
