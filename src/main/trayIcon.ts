import { nativeImage } from 'electron'

/**
 * Build the menu-bar tray icon — a small clock glyph drawn at ~10:10.
 *
 * It is generated in code (no external asset) as a macOS *template image*:
 * only the alpha channel carries the shape, RGB is left black, and macOS
 * recolours it automatically for light/dark menu bars. We rasterise a 1x and
 * a 2x (Retina) representation with simple 4×4 supersampled anti-aliasing.
 */

/** Squared distance from point (px,py) to the segment (ax,ay)-(bx,by). */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** Is a sub-sampled point inside the clock shape (ring or one of the hands)? */
function inside(x: number, y: number, s: number): boolean {
  const c = s / 2
  const dist = Math.hypot(x - c, y - c)

  // Clock ring.
  const rOuter = s * 0.44
  const rInner = s * 0.34
  if (dist <= rOuter && dist >= rInner) return true

  // Hands originate at the centre. Angles measured clockwise from 12 o'clock.
  const hand = (angleDeg: number, len: number, halfWidth: number): boolean => {
    const a = (angleDeg * Math.PI) / 180
    const bx = c + Math.sin(a) * len
    const by = c - Math.cos(a) * len
    return distToSegment(x, y, c, c, bx, by) <= halfWidth
  }

  // Minute hand to "2", hour hand to "10" — the classic 10:10 pose.
  if (hand(60, s * 0.3, s * 0.05)) return true
  if (hand(-60, s * 0.2, s * 0.055)) return true

  return false
}

/**
 * Rasterise the clock into a premultiplied BGRA buffer of size s×s.
 *
 * `mono` (macOS template image): RGB stays black, only alpha carries the
 * shape, and macOS recolours it for the menu bar. Otherwise the glyph is drawn
 * in white (premultiplied) so it stays visible on Windows/Linux dark trays.
 */
function rasterize(s: number, mono: boolean): Buffer {
  const buf = Buffer.alloc(s * s * 4)
  const SS = 4 // supersampling factor per axis
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let hits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (inside(px, py, s)) hits++
        }
      }
      const alpha = Math.round((hits / (SS * SS)) * 255)
      const channel = mono ? 0 : alpha // premultiplied white when colored
      const i = (y * s + x) * 4
      buf[i] = channel // B
      buf[i + 1] = channel // G
      buf[i + 2] = channel // R
      buf[i + 3] = alpha // A
    }
  }
  return buf
}

export function buildTrayIcon(): Electron.NativeImage {
  const mono = process.platform === 'darwin'
  const base = 16
  const img = nativeImage.createFromBitmap(rasterize(base, mono), {
    width: base,
    height: base,
    scaleFactor: 1
  })
  img.addRepresentation({
    width: base * 2,
    height: base * 2,
    scaleFactor: 2,
    buffer: rasterize(base * 2, mono)
  })
  if (mono) img.setTemplateImage(true)
  return img
}
