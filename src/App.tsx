import { useEffect, useRef, useState } from "react"
import "./styles.css"
import type { Point } from "./types"
import {
  distanceSquared,
  isClosed,
  mathToScreen,
  screenToMath,
  signedArea,
} from "./geometry"
import { exportCurvesPdf } from "./exportPdf"

function makePoint(x: number, y: number): Point {
  return {
    id: crypto.randomUUID(),
    x,
    y,
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [mode, setMode] = useState<"single" | "multi">("multi")
  const [points, setPoints] = useState<Point[]>([])
  const [multiCurves, setMultiCurves] = useState<Point[][]>([[]])
  const [currentCurveIndex, setCurrentCurveIndex] = useState(0)
  const [desiredPointCount, setDesiredPointCount] = useState(6)
  const [showGrid, setShowGrid] = useState(true)
  const [exportShowGrid, setExportShowGrid] = useState(true)
  const [exportShowPoints, setExportShowPoints] = useState(true)
  const [exportShowLabels, setExportShowLabels] = useState(true)
  const [scale, setScale] = useState(1)
  const [unitPerGrid, setUnitPerGrid] = useState(1)
  const [unitPerGridInput, setUnitPerGridInput] = useState("1")
  const [printMmPerGrid, setPrintMmPerGrid] = useState(10)
  const [printMmPerGridInput, setPrintMmPerGridInput] = useState("10")
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 700 })
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null)

  const closed = isClosed(points, desiredPointCount)

  const toDisplayCoords = (curve: Point[]) =>
    curve.map((p) => ({
      x: (p.x / (25 * scale)) * unitPerGrid,
      y: (p.y / (25 * scale)) * unitPerGrid,
    }))

  const area = closed ? signedArea(toDisplayCoords(points)) : 0
  const multiCurveAreas = multiCurves.map((curve) =>
    curve.length >= 3 ? signedArea(toDisplayCoords(curve)) : 0
  )

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setCanvasSize({
        width: Math.max(400, Math.floor(rect.width)),
        height: Math.max(400, Math.floor(rect.height)),
      })
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.floor(canvasSize.width * dpr)
    canvas.height = Math.floor(canvasSize.height * dpr)
    canvas.style.width = `${canvasSize.width}px`
    canvas.style.height = `${canvasSize.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    drawBackground(ctx, canvasSize.width, canvasSize.height, showGrid, scale, unitPerGrid)

    if (mode === "single") {
      drawPolyline(ctx, points, canvasSize.width, canvasSize.height, closed, scale)
      drawPoints(ctx, points, canvasSize.width, canvasSize.height, scale)
    } else {
      for (const curve of multiCurves) {
        const curveClosed = curve.length >= 3
        drawPolyline(ctx, curve, canvasSize.width, canvasSize.height, curveClosed, scale)
        drawPoints(ctx, curve, canvasSize.width, canvasSize.height, scale)
      }
    }
  }, [points, multiCurves, mode, canvasSize, showGrid, closed, scale, unitPerGrid])

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const hitRadius = 10
    const activePoints = mode === "single" ? points : (multiCurves[currentCurveIndex] ?? [])

    for (const p of activePoints) {
      const sp = mathToScreen(p.x, p.y, canvasSize.width, canvasSize.height, scale)
      if (distanceSquared(sx, sy, sp.x, sp.y) <= hitRadius * hitRadius) {
        setDraggingPointId(p.id)
        return
      }
    }

    const mp = screenToMath(sx, sy, canvasSize.width, canvasSize.height, scale)

    if (mode === "single") {
      if (points.length >= desiredPointCount) return
      setPoints((prev) => [...prev, makePoint(mp.x, mp.y)])
      return
    }

    setMultiCurves((prev) =>
      prev.map((curve, index) =>
        index === currentCurveIndex ? [...curve, makePoint(mp.x, mp.y)] : curve
      )
    )
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draggingPointId) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const mp = screenToMath(sx, sy, canvasSize.width, canvasSize.height, scale)

    if (mode === "single") {
      setPoints((prev) =>
        prev.map((p) =>
          p.id === draggingPointId ? { ...p, x: mp.x, y: mp.y } : p
        )
      )
      return
    }

    setMultiCurves((prev) =>
      prev.map((curve, index) =>
        index === currentCurveIndex
          ? curve.map((p) =>
              p.id === draggingPointId ? { ...p, x: mp.x, y: mp.y } : p
            )
          : curve
      )
    )
  }

  function handlePointerUp() {
    setDraggingPointId(null)
  }

  function clearAll() {
    setPoints([])
  }

  function deleteLastPoint() {
    if (mode === "single") {
      setPoints((prev) => prev.slice(0, -1))
      return
    }

    setMultiCurves((prev) =>
      prev.map((curve, index) =>
        index === currentCurveIndex ? curve.slice(0, -1) : curve
      )
    )
  }

  function deleteCurrentCurve() {
    if (mode !== "multi") return

    setMultiCurves((prev) => {
      if (prev.length <= 1) return [[]]

      const next = prev.filter((_, index) => index !== currentCurveIndex)
      return next.length > 0 ? next : [[]]
    })

    setCurrentCurveIndex((i) => Math.max(0, i - 1))
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <h1>Polygonal</h1>


        <div className="section">
          <h2>設定</h2>

          {mode === "single" && (
            <div className="row">
              <label>
                總點數
                <input
                  type="number"
                  min={3}
                  max={200}
                  value={desiredPointCount}
                  onChange={(e) => {
                    const v = Math.max(3, Number(e.target.value) || 3)
                    setDesiredPointCount(v)
                    setPoints((prev) => prev.slice(0, v))
                  }}
                />
              </label>
            </div>
          )}

          <div className="row">
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              顯示坐標方格
            </label>
          </div>

          <div className="row">
            <label>
              縮放
              <input
                type="range"
                min="0.2"
                max="5"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
              <span>{scale.toFixed(1)}x</span>
            </label>
          </div>

          <div className="row">
            <label>
              每格代表
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(0.01, Number((unitPerGrid - 0.25).toFixed(2)))
                  setUnitPerGrid(next)
                  setUnitPerGridInput(String(next))
                }}
              >
                -
              </button>
              <input
                type="number"
                min="0.01"
                step="0.25"
                value={unitPerGridInput}
                onChange={(e) =>
                  setUnitPerGridInput(e.target.value)
                }
                onBlur={() => {
                  const parsed = Number(unitPerGridInput)
                  const next = Math.max(0.01, Number.isFinite(parsed) ? parsed : unitPerGrid)
                  setUnitPerGrid(next)
                  setUnitPerGridInput(String(next))
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = Number((unitPerGrid + 0.25).toFixed(2))
                  setUnitPerGrid(next)
                  setUnitPerGridInput(String(next))
                }}
              >
                +
              </button>
            </label>
          </div>

          <div className="row">
            <label>
              每格印刷長度（mm）
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(0.1, Number((printMmPerGrid - 0.5).toFixed(2)))
                  setPrintMmPerGrid(next)
                  setPrintMmPerGridInput(String(next))
                }}
              >
                -
              </button>
              <input
                type="number"
                min="0"
                step="any"
                value={printMmPerGridInput}
                onChange={(e) =>
                  setPrintMmPerGridInput(e.target.value)
                }
                onBlur={() => {
                  const parsed = Number(printMmPerGridInput)
                  const next = Math.max(0.1, Number.isFinite(parsed) ? parsed : printMmPerGrid)
                  setPrintMmPerGrid(next)
                  setPrintMmPerGridInput(String(next))
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = Number((printMmPerGrid + 0.5).toFixed(2))
                  setPrintMmPerGrid(next)
                  setPrintMmPerGridInput(String(next))
                }}
              >
                +
              </button>
            </label>
          </div>
        </div>

        <div className="section">
          <h2>資訊</h2>
          {mode === "single" ? (
            <>
              <div className="row">目前點數：{points.length} / {desiredPointCount}</div>
              <div className="row">
                Signed area：{area.toFixed(3)}
              </div>
            </>
          ) : (
            <>
              <div className="row">目前曲線：{currentCurveIndex + 1} / {multiCurves.length}</div>
              <div className="row">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentCurveIndex((i) => Math.max(0, i - 1))
                  }
                  disabled={currentCurveIndex === 0}
                >
                  上一條
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentCurveIndex((i) => Math.min(multiCurves.length - 1, i + 1))
                  }
                  disabled={currentCurveIndex >= multiCurves.length - 1}
                >
                  下一條
                </button>
              </div>
              <div className="row">
                目前曲線點數：{multiCurves[currentCurveIndex]?.length ?? 0}
              </div>
              {multiCurveAreas.map((area, i) => (
                <div className="row" key={i}>
                  Curve {i + 1} signed area：{area.toFixed(3)}
                </div>
              ))}
              <div className="row">
                多曲線 signed area 總和：{multiCurveAreas.reduce((a, b) => a + b, 0).toFixed(3)}
              </div>
              <div className="row">
              </div>
            </>
          )}
        </div>

        <div className="section">
          <h2>輸出選項</h2>
          <div className="row">
            <label>
              <input
                type="checkbox"
                checked={exportShowGrid}
                onChange={(e) => setExportShowGrid(e.target.checked)}
              />
              匯出時顯示坐標格線
            </label>
          </div>
          <div className="row">
            <label>
              <input
                type="checkbox"
                checked={exportShowPoints}
                onChange={(e) => setExportShowPoints(e.target.checked)}
              />
              匯出時顯示控制點
            </label>
          </div>
          <div className="row">
            <label>
              <input
                type="checkbox"
                checked={exportShowLabels}
                onChange={(e) => setExportShowLabels(e.target.checked)}
              />
              匯出時顯示點標籤
            </label>
          </div>
        </div>

        <div className="section">
          <h2>操作</h2>
          <>
            <button
              onClick={deleteLastPoint}
              disabled={(multiCurves[currentCurveIndex]?.length ?? 0) === 0}
            >
              刪除最後一點
            </button>
            <button
              onClick={deleteCurrentCurve}
              disabled={multiCurves.length === 0}
            >
              刪除目前曲線
            </button>
            <button
              onClick={() => {
                setMultiCurves((prev) => [...prev, []])
                setCurrentCurveIndex(multiCurves.length)
              }}
            >
              新增曲線
            </button>
            <button
              onClick={() =>
                exportCurvesPdf(
                  multiCurves,
                  unitPerGrid,
                  printMmPerGrid,
                  exportShowGrid,
                  exportShowPoints,
                  exportShowLabels
                )
              }
              disabled={multiCurves.every((curve) => curve.length < 3)}
            >
              輸出 PDF
            </button>
          </>
        </div>

        <div className="section">
          <h2>點座標（數學座標）</h2>
          <div className="point-list">
            {mode === "single" ? (
              <>
                {points.length === 0 && <div>尚未加入任何點</div>}
                {points.map((p, i) => (
                  <div className="point-item" key={p.id}>
                    P{i + 1} = ({p.x.toFixed(1)}, {p.y.toFixed(1)})
                  </div>
                ))}
              </>
            ) : (
              <>
                {(multiCurves[currentCurveIndex]?.length ?? 0) === 0 && <div>目前曲線尚未加入任何點</div>}
                {(multiCurves[currentCurveIndex] ?? []).map((p, i) => (
                  <div className="point-item" key={p.id}>
                    C{currentCurveIndex + 1}-P{i + 1} = ({p.x.toFixed(1)}, {p.y.toFixed(1)})
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="canvas-panel">
        <div className="canvas-wrap" ref={containerRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>
    </div>
  )
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  showGrid: boolean,
  scale: number,
  unitPerGrid: number
) {
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2
  const spacing = 25 * scale

  if (showGrid) {
    ctx.strokeStyle = "#e2e2e2"
    ctx.lineWidth = 1

    for (let x = cx; x <= width; x += spacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let x = cx - spacing; x >= 0; x -= spacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let y = cy; y <= height; y += spacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    for (let y = cy - spacing; y >= 0; y -= spacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.strokeStyle = "#999"
    ctx.lineWidth = 1.3

    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(width, cy)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx, height)
    ctx.stroke()

    ctx.fillStyle = "#666"
    ctx.font = "12px sans-serif"

    for (let x = cx + spacing, k = 1; x <= width; x += spacing, k++) {
      ctx.fillText(String(k * unitPerGrid), x + 2, cy + 14)
    }

    for (let x = cx - spacing, k = 1; x >= 0; x -= spacing, k++) {
      ctx.fillText(String(-k * unitPerGrid), x + 2, cy + 14)
    }

    for (let y = cy - spacing, k = 1; y >= 0; y -= spacing, k++) {
      ctx.fillText(String(k * unitPerGrid), cx + 6, y - 4)
    }

    for (let y = cy + spacing, k = 1; y <= height; y += spacing, k++) {
      ctx.fillText(String(-k * unitPerGrid), cx + 6, y - 4)
    }

    ctx.fillText("0", cx + 6, cy + 14)
  }
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  height: number,
  closed: boolean,
  scale: number
) {
  if (points.length < 2) return

  ctx.strokeStyle = "#1976d2"
  ctx.lineWidth = 2.8

  ctx.beginPath()
  const p0 = mathToScreen(points[0].x, points[0].y, width, height, scale)
  ctx.moveTo(p0.x, p0.y)

  for (let i = 1; i < points.length; i++) {
    const sp = mathToScreen(points[i].x, points[i].y, width, height, scale)
    ctx.lineTo(sp.x, sp.y)
  }

  if (closed) {
    ctx.closePath()
  }

  ctx.stroke()
}

function drawPoints(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  height: number,
  scale: number
) {
  ctx.font = "14px sans-serif"
  ctx.fillStyle = "#e53935"

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const sp = mathToScreen(p.x, p.y, width, height, scale)

    ctx.beginPath()
    ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillText(`P${i + 1}`, sp.x + 12, sp.y - 10)
  }
}
