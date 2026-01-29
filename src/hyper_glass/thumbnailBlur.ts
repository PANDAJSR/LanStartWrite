export type RgbaImage = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type ThumbnailBlurOptions = {
  maxSide?: number
  radius?: number
  passes?: number
}

type Size = { width: number; height: number }

function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v | 0))
}

function computeThumbnailSize(input: Size, maxSide: number): Size {
  const maxInputSide = Math.max(input.width, input.height)
  if (maxInputSide <= maxSide) return { width: input.width, height: input.height }
  const scale = maxSide / maxInputSide
  return { width: Math.max(1, Math.round(input.width * scale)), height: Math.max(1, Math.round(input.height * scale)) }
}

function downsampleAreaAverage(input: RgbaImage, outSize: Size): RgbaImage {
  const out = new Uint8ClampedArray(outSize.width * outSize.height * 4)
  const ratioX = input.width / outSize.width
  const ratioY = input.height / outSize.height

  for (let oy = 0; oy < outSize.height; oy++) {
    const sy0 = Math.floor(oy * ratioY)
    const sy1 = Math.min(input.height, Math.floor((oy + 1) * ratioY))
    const sampleH = Math.max(1, sy1 - sy0)

    for (let ox = 0; ox < outSize.width; ox++) {
      const sx0 = Math.floor(ox * ratioX)
      const sx1 = Math.min(input.width, Math.floor((ox + 1) * ratioX))
      const sampleW = Math.max(1, sx1 - sx0)

      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = sy0; sy < sy0 + sampleH; sy++) {
        const row = sy * input.width * 4
        for (let sx = sx0; sx < sx0 + sampleW; sx++) {
          const i = row + sx * 4
          r += input.data[i]
          g += input.data[i + 1]
          b += input.data[i + 2]
          a += input.data[i + 3]
        }
      }

      const denom = sampleW * sampleH
      const o = (oy * outSize.width + ox) * 4
      out[o] = Math.round(r / denom)
      out[o + 1] = Math.round(g / denom)
      out[o + 2] = Math.round(b / denom)
      out[o + 3] = Math.round(a / denom)
    }
  }

  return { width: outSize.width, height: outSize.height, data: out }
}

function boxBlurHorizontal(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number, radius: number) {
  const windowSize = radius * 2 + 1

  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4
    let sumR = 0
    let sumG = 0
    let sumB = 0
    let sumA = 0

    for (let k = -radius; k <= radius; k++) {
      const x = clampInt(k, 0, width - 1)
      const i = rowStart + x * 4
      sumR += src[i]
      sumG += src[i + 1]
      sumB += src[i + 2]
      sumA += src[i + 3]
    }

    for (let x = 0; x < width; x++) {
      const o = rowStart + x * 4
      dst[o] = Math.round(sumR / windowSize)
      dst[o + 1] = Math.round(sumG / windowSize)
      dst[o + 2] = Math.round(sumB / windowSize)
      dst[o + 3] = Math.round(sumA / windowSize)

      const xOut = clampInt(x - radius, 0, width - 1)
      const xIn = clampInt(x + radius + 1, 0, width - 1)
      const iOut = rowStart + xOut * 4
      const iIn = rowStart + xIn * 4
      sumR += src[iIn] - src[iOut]
      sumG += src[iIn + 1] - src[iOut + 1]
      sumB += src[iIn + 2] - src[iOut + 2]
      sumA += src[iIn + 3] - src[iOut + 3]
    }
  }
}

function boxBlurVertical(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number, radius: number) {
  const windowSize = radius * 2 + 1

  for (let x = 0; x < width; x++) {
    let sumR = 0
    let sumG = 0
    let sumB = 0
    let sumA = 0

    for (let k = -radius; k <= radius; k++) {
      const y = clampInt(k, 0, height - 1)
      const i = (y * width + x) * 4
      sumR += src[i]
      sumG += src[i + 1]
      sumB += src[i + 2]
      sumA += src[i + 3]
    }

    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4
      dst[o] = Math.round(sumR / windowSize)
      dst[o + 1] = Math.round(sumG / windowSize)
      dst[o + 2] = Math.round(sumB / windowSize)
      dst[o + 3] = Math.round(sumA / windowSize)

      const yOut = clampInt(y - radius, 0, height - 1)
      const yIn = clampInt(y + radius + 1, 0, height - 1)
      const iOut = (yOut * width + x) * 4
      const iIn = (yIn * width + x) * 4
      sumR += src[iIn] - src[iOut]
      sumG += src[iIn + 1] - src[iOut + 1]
      sumB += src[iIn + 2] - src[iOut + 2]
      sumA += src[iIn + 3] - src[iOut + 3]
    }
  }
}

function boxBlur(src: Uint8ClampedArray, width: number, height: number, radius: number, passes: number) {
  if (radius <= 0 || passes <= 0) return src.slice()
  let a = src.slice()
  let b = new Uint8ClampedArray(a.length)
  let c = new Uint8ClampedArray(a.length)

  for (let p = 0; p < passes; p++) {
    boxBlurHorizontal(a, b, width, height, radius)
    boxBlurVertical(b, c, width, height, radius)
    if (p < passes - 1) {
      const tmp = a
      a = c
      c = tmp
    }
  }

  return c
}

export function computeThumbnailBlur(input: RgbaImage, options: ThumbnailBlurOptions = {}) {
  const maxSide = typeof options.maxSide === 'number' ? Math.max(1, Math.floor(options.maxSide)) : 64
  const passes = typeof options.passes === 'number' ? Math.max(1, Math.floor(options.passes)) : 3
  const outSize = computeThumbnailSize(input, maxSide)
  const thumb = downsampleAreaAverage(input, outSize)

  const radiusOriginal = typeof options.radius === 'number' ? Math.max(0, options.radius) : 32
  const ratioX = input.width / thumb.width
  const ratioY = input.height / thumb.height
  const radiusThumb = Math.max(1, Math.round(radiusOriginal / Math.max(ratioX, ratioY)))

  const blurred = boxBlur(thumb.data, thumb.width, thumb.height, radiusThumb, passes)
  return {
    image: { width: thumb.width, height: thumb.height, data: blurred },
    scaleX: thumb.width / input.width,
    scaleY: thumb.height / input.height
  }
}

export function upscaleBilinear(input: RgbaImage, width: number, height: number): RgbaImage {
  const out = new Uint8ClampedArray(width * height * 4)
  const sx = input.width / width
  const sy = input.height / height

  for (let y = 0; y < height; y++) {
    const gy = (y + 0.5) * sy - 0.5
    const y0 = clampInt(Math.floor(gy), 0, input.height - 1)
    const y1 = clampInt(y0 + 1, 0, input.height - 1)
    const wy = gy - Math.floor(gy)

    for (let x = 0; x < width; x++) {
      const gx = (x + 0.5) * sx - 0.5
      const x0 = clampInt(Math.floor(gx), 0, input.width - 1)
      const x1 = clampInt(x0 + 1, 0, input.width - 1)
      const wx = gx - Math.floor(gx)

      const i00 = (y0 * input.width + x0) * 4
      const i10 = (y0 * input.width + x1) * 4
      const i01 = (y1 * input.width + x0) * 4
      const i11 = (y1 * input.width + x1) * 4

      const o = (y * width + x) * 4
      for (let c = 0; c < 4; c++) {
        const v0 = input.data[i00 + c] * (1 - wx) + input.data[i10 + c] * wx
        const v1 = input.data[i01 + c] * (1 - wx) + input.data[i11 + c] * wx
        out[o + c] = Math.round(v0 * (1 - wy) + v1 * wy)
      }
    }
  }

  return { width, height, data: out }
}

export function computeBlurredImage(input: RgbaImage, options: ThumbnailBlurOptions = {}) {
  const { image: thumb } = computeThumbnailBlur(input, options)
  return upscaleBilinear(thumb, input.width, input.height)
}
