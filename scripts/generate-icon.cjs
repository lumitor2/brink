// Generate the Brink app icon (build/icon.png, 1024×1024): a white clock on an
// indigo rounded-square. electron-builder turns this into .icns/.ico/.png.
// Run: ./node_modules/.bin/electron scripts/_icon.cjs   (safe to delete after)
const { app, nativeImage } = require('electron')
const { join } = require('path')
const { promises: fs } = require('fs')

const S = 1024
const C = S / 2

// Rounded-square background bounds + corner radius (Apple-ish proportions).
const M = 100 // margin
const X0 = M
const Y0 = M
const X1 = S - M
const Y1 = S - M
const R = 200

function inRoundRect(x, y) {
  const cx = Math.min(Math.max(x, X0 + R), X1 - R)
  const cy = Math.min(Math.max(y, Y0 + R), Y1 - R)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= R * R
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const l = dx * dx + dy * dy
  let t = l === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function inClock(x, y) {
  const d = Math.hypot(x - C, y - C)
  if (d <= 300 && d >= 232) return true // ring
  if (d <= 44) return true // hub
  const hand = (deg, len, hw) => {
    const a = (deg * Math.PI) / 180
    return distToSeg(x, y, C, C, C + Math.sin(a) * len, C - Math.cos(a) * len) <= hw
  }
  if (hand(60, 250, 28)) return true // minute → "2"
  if (hand(-60, 168, 32)) return true // hour → "10"
  return false
}

// Vertical indigo gradient.
function bg(y) {
  const tnorm = (y - Y0) / (Y1 - Y0)
  const top = [123, 165, 255]
  const bot = [74, 108, 240]
  return [0, 1, 2].map((i) =>
    Math.round(top[i] + (bot[i] - top[i]) * Math.min(1, Math.max(0, tnorm)))
  )
}

app.whenReady().then(async () => {
  const buf = Buffer.alloc(S * S * 4)
  const SS = 3
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (inClock(px, py)) {
            r += 255
            g += 255
            b += 255
            a += 255
          } else if (inRoundRect(px, py)) {
            const [cr, cg, cb] = bg(py)
            r += cr
            g += cg
            b += cb
            a += 255
          }
          // else transparent (adds 0)
        }
      }
      const n = SS * SS
      const i = (y * S + x) * 4
      // Premultiplied BGRA (values already averaged ⇒ premultiplied by coverage).
      buf[i] = Math.round(b / n)
      buf[i + 1] = Math.round(g / n)
      buf[i + 2] = Math.round(r / n)
      buf[i + 3] = Math.round(a / n)
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: S, height: S })
  await fs.writeFile(join(__dirname, '..', 'build', 'icon.png'), img.toPNG())
  console.log('saved build/icon.png')
  app.quit()
})
