import fs from 'fs'
import path from 'path'

const iconsDir = path.join(process.cwd(), 'public', 'icons')
const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots')
fs.mkdirSync(iconsDir, { recursive: true })
fs.mkdirSync(screenshotsDir, { recursive: true })

// 1x1 transparent PNG (small placeholder) - base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
const buf = Buffer.from(pngBase64, 'base64')
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), buf)
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), buf)
fs.writeFileSync(path.join(screenshotsDir, 'ss-wide-1.png'), buf)
console.log('Generated placeholder icons and screenshot')
