export function screenToMath(
  sx: number,
  sy: number,
  width: number,
  height: number,
  scale: number
) {
  return {
    x: (sx - width / 2) / scale,
    y: (height / 2 - sy) / scale,
  }
}

export function mathToScreen(
  mx: number,
  my: number,
  width: number,
  height: number,
  scale: number
) {
  return {
    x: width / 2 + mx * scale,
    y: height / 2 - my * scale,
  }
}

export function signedArea(points: { x: number; y: number }[]) {
  if (points.length < 3) return 0

  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    sum += p1.x * p2.y - p2.x * p1.y
  }
  return sum / 2
}

export function isClosed(points: { x: number; y: number }[], desiredCount: number) {
  return points.length >= 3 && points.length === desiredCount
}

export function distanceSquared(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx = x1 - x2
  const dy = y1 - y2
  return dx * dx + dy * dy
}
