import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const iconsDir = path.join(process.cwd(), 'public', 'icons')
const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots')
fs.mkdirSync(iconsDir, { recursive: true })
fs.mkdirSync(screenshotsDir, { recursive: true })

function hexToRgb(hex) {
    const h = hex.replace('#', '')
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
}

function crc32(buf) {
    let table = crc32.table
    if (!table) {
        table = new Uint32Array(256)
        for (let i = 0; i < 256; i++) {
            let c = i
            for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1))
            table[i] = c >>> 0
        }
        crc32.table = table
    }
    let crc = 0xffffffff
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
    return (crc ^ 0xffffffff) >>> 0
}

function writeChunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const chunk = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(chunk), 0)
    return Buffer.concat([len, chunk, crc])
}

function createPng(width, height, rgb) {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0)
    ihdr.writeUInt32BE(height, 4)
    ihdr[8] = 8 // bit depth
    ihdr[9] = 6 // color type RGBA
    ihdr[10] = 0
    ihdr[11] = 0
    ihdr[12] = 0
    const ihdrChunk = writeChunk('IHDR', ihdr)

    // raw pixel data with filter byte per scanline
    const rowBytes = width * 4
    const raw = Buffer.alloc((rowBytes + 1) * height)
    for (let y = 0; y < height; y++) {
        const rowStart = y * (rowBytes + 1)
        raw[rowStart] = 0 // no filter
        for (let x = 0; x < width; x++) {
            const px = rowStart + 1 + x * 4
            raw[px] = rgb[0]
            raw[px + 1] = rgb[1]
            raw[px + 2] = rgb[2]
            raw[px + 3] = 255
        }
    }
    const idat = zlib.deflateSync(raw)
    const idatChunk = writeChunk('IDAT', idat)
    const iendChunk = writeChunk('IEND', Buffer.alloc(0))
    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const bg = hexToRgb('#0f172a')
const png192 = createPng(192, 192, bg)
const png512 = createPng(512, 512, bg)
const pngSS = createPng(1280, 720, bg)

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192)
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512)
fs.writeFileSync(path.join(screenshotsDir, 'ss-wide-1.png'), pngSS)
console.log('Generated PNG icons and screenshot (solid color)')
