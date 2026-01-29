import { describe, expect, test } from 'vitest'
import { computeBlurredImage, computeThumbnailBlur } from '../thumbnailBlur'

function makeImage(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
  return { width, height, data }
}

describe('hyper_glass thumbnail blur', () => {
  test('computeThumbnailBlur respects maxSide', () => {
    const img = makeImage(200, 100, () => [10, 20, 30, 255])
    const { image, scaleX, scaleY } = computeThumbnailBlur(img, { maxSide: 64, radius: 20 })
    expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(64)
    expect(scaleX).toBeGreaterThan(0)
    expect(scaleY).toBeGreaterThan(0)
  })

  test('blur spreads energy to neighbors', () => {
    const img = makeImage(9, 9, (x, y) => (x === 4 && y === 4 ? [255, 0, 0, 255] : [0, 0, 0, 255]))
    const blurred = computeBlurredImage(img, { maxSide: 9, radius: 2, passes: 2 })
    const center = blurred.data[(4 * blurred.width + 4) * 4]
    const neighbor = blurred.data[(4 * blurred.width + 5) * 4]
    expect(center).toBeGreaterThan(0)
    expect(neighbor).toBeGreaterThan(0)
    expect(neighbor).toBeLessThan(center)
  })
})

