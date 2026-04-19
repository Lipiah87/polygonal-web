import jsPDF from "jspdf"
import type { Point } from "./types"

function mathToPage(
  mx: number,
  my: number,
  pageWidth: number,
  pageHeight: number,
  scale: number
) {
  return {
    x: pageWidth / 2 + mx * scale,
    y: pageHeight / 2 - my * scale,
  }
}

export function exportCurvesPdf(
  curves: Point[][],
  unitPerGrid: number = 1,
  printMmPerGrid: number = 10,
  showGrid: boolean = true,
  showPoints: boolean = true,
  showLabels: boolean = true
) {
  const validCurves = curves.filter((curve) => curve.length >= 3)
  if (validCurves.length === 0) return

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, pageWidth, pageHeight, "F")

  if (showGrid) {
    const mmToPt = 72 / 25.4
    const gridStep = printMmPerGrid * mmToPt

    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.5)

    for (let x = pageWidth / 2; x <= pageWidth; x += gridStep) {
      pdf.line(x, 0, x, pageHeight)
    }
    for (let x = pageWidth / 2 - gridStep; x >= 0; x -= gridStep) {
      pdf.line(x, 0, x, pageHeight)
    }
    for (let y = pageHeight / 2; y <= pageHeight; y += gridStep) {
      pdf.line(0, y, pageWidth, y)
    }
    for (let y = pageHeight / 2 - gridStep; y >= 0; y -= gridStep) {
      pdf.line(0, y, pageWidth, y)
    }

    pdf.setDrawColor(140, 140, 140)
    pdf.setLineWidth(0.8)
    pdf.line(0, pageHeight / 2, pageWidth, pageHeight / 2)
    pdf.line(pageWidth / 2, 0, pageWidth / 2, pageHeight)

    pdf.setTextColor(102, 102, 102)
    pdf.setFontSize(10)

    for (let x = pageWidth / 2 + gridStep, k = 1; x <= pageWidth; x += gridStep, k++) {
      pdf.text(String(k * unitPerGrid), x + 2, pageHeight / 2 + 12)
    }
    for (let x = pageWidth / 2 - gridStep, k = 1; x >= 0; x -= gridStep, k++) {
      pdf.text(String(-k * unitPerGrid), x + 2, pageHeight / 2 + 12)
    }
    for (let y = pageHeight / 2 - gridStep, k = 1; y >= 0; y -= gridStep, k++) {
      pdf.text(String(k * unitPerGrid), pageWidth / 2 + 6, y - 4)
    }
    for (let y = pageHeight / 2 + gridStep, k = 1; y <= pageHeight; y += gridStep, k++) {
      pdf.text(String(-k * unitPerGrid), pageWidth / 2 + 6, y - 4)
    }

    pdf.text("0", pageWidth / 2 + 6, pageHeight / 2 + 12)
  }

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(1.5)

  const mmToPt = 72 / 25.4
  const pointsPerUnit = (printMmPerGrid * mmToPt) / unitPerGrid
  const exportScale = pointsPerUnit

  for (let curveIndex = 0; curveIndex < validCurves.length; curveIndex++) {
    const curve = validCurves[curveIndex]
    const shiftedPoints = curve.map((p) => ({
      ...p,
      x: (p.x / 25) * unitPerGrid,
      y: (p.y / 25) * unitPerGrid,
    }))

    const first = mathToPage(
      shiftedPoints[0].x,
      shiftedPoints[0].y,
      pageWidth,
      pageHeight,
      exportScale
    )

    for (let i = 1; i < shiftedPoints.length; i++) {
      const p1 = mathToPage(
        shiftedPoints[i - 1].x,
        shiftedPoints[i - 1].y,
        pageWidth,
        pageHeight,
        exportScale
      )
      const p2 = mathToPage(
        shiftedPoints[i].x,
        shiftedPoints[i].y,
        pageWidth,
        pageHeight,
        exportScale
      )
      pdf.line(p1.x, p1.y, p2.x, p2.y)
    }

    const last = mathToPage(
      shiftedPoints[shiftedPoints.length - 1].x,
      shiftedPoints[shiftedPoints.length - 1].y,
      pageWidth,
      pageHeight,
      exportScale
    )
    pdf.line(last.x, last.y, first.x, first.y)

    if (showPoints || showLabels) {
      for (let i = 0; i < shiftedPoints.length; i++) {
        const pagePoint = mathToPage(
          shiftedPoints[i].x,
          shiftedPoints[i].y,
          pageWidth,
          pageHeight,
          exportScale
        )

        if (showPoints) {
          pdf.setFillColor(229, 57, 53)
          pdf.circle(pagePoint.x, pagePoint.y, 3.5, "F")
        }

        if (showLabels) {
          pdf.setTextColor(0, 0, 0)
          pdf.setFontSize(10)
          pdf.text(
            `C${curveIndex + 1}-P${i + 1}`,
            pagePoint.x + 6,
            pagePoint.y - 6
          )
        }
      }
    }
  }

  pdf.save("curves.pdf")
}
