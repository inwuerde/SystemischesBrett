import { Canvas, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { Html } from '@react-three/drei/web/Html'
import { Suspense, useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from 'react'
import * as THREE from 'three'
import { useZoomApp } from './zoom'
import { ErrorBoundary } from './ErrorBoundary'

export type FigureType = 'tall' | 'medium' | 'small' | 'cube' | 'disc' | 'block'

export type FigureData = {
  id: string
  position: [number, number, number]
  rotationY: number
  color: string
  label: string
  type: FigureType
  onBlock?: boolean
}

const WOOD_TONES = ['#e8d4b0', '#d4b896', '#c9a66b', '#b8956a', '#a67c52', '#8b6914', '#d2b48c', '#c4a35a']
const FIGURE_TYPES: FigureType[] = ['tall', 'medium', 'small', 'cube', 'disc', 'block']
const SAVES_KEY = 'systemisches-brett-saves-v2'
const LAST_KEY = 'systemisches-brett-last-v2'
const LAST_KEY_LEGACY = 'systemisches-brett-last-v1'
const FILE_FORMAT = 'systemisches-brett'
const FILE_FORMAT_VERSION = 1
const PLACE_MIN_DIST = 0.75
const DRAG_THRESHOLD_PX = 8
const NOTICE_MS = 4500

const BOARD_SIZE = 11
const BOARD_HALF = BOARD_SIZE / 2
const SNAKE_WAVES = 6
const SNAKE_AMPLITUDE = 0.325
const SNAKE_SEGMENTS = 96
/** Brett ≈ 50 cm bei 11 Einheiten → 2 cm Abstand ≈ 0.44 */
const SPLIT_GAP = 0.44
const PEDESTAL_SIZE = 0.5
const CORNER_RADIUS = 0.62
const RIM_WIDTH = 0.34
const RIM_HEIGHT = 0.16
const BOARD_THICKNESS = 0.12
const SCENE_BG = '#0d1b2a'
const BOARD_EDGE_SEGS = 18
const BOARD_UV_SCALE = 2 / BOARD_SIZE

function snakeXAtT(t: number) {
  return Math.sin(t * Math.PI * 2 * SNAKE_WAVES) * SNAKE_AMPLITUDE
}

function snakeXAtZ(z: number) {
  return snakeXAtT((z + BOARD_HALF) / BOARD_SIZE)
}

function figureSplitSign(position: [number, number, number]): -1 | 1 {
  return position[0] < snakeXAtZ(position[2]) ? -1 : 1
}

function makeSnakePoints() {
  const pts: { x: number; z: number }[] = []
  for (let i = 0; i <= SNAKE_SEGMENTS; i++) {
    const t = i / SNAKE_SEGMENTS
    pts.push({ x: snakeXAtT(t), z: -BOARD_HALF + t * BOARD_SIZE })
  }
  return pts
}

function lineSegs(shape: THREE.Shape, x0: number, y0: number, x1: number, y1: number, segs: number) {
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    shape.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
  }
}

function makeHalfShape(side: 'left' | 'right') {
  const shape = new THREE.Shape()
  const snake = makeSnakePoints()
  const r = CORNER_RADIUS
  const zMin = -BOARD_HALF
  const zMax = BOARD_HALF
  if (side === 'left') {
    const x = -BOARD_HALF
    const cx = x + r
    shape.moveTo(snake[0].x, snake[0].z)
    for (let i = 1; i < snake.length; i++) shape.lineTo(snake[i].x, snake[i].z)
    lineSegs(shape, snake[snake.length - 1].x, snake[snake.length - 1].z, cx, zMax, 8)
    shape.absarc(cx, zMax - r, r, Math.PI / 2, Math.PI, false)
    lineSegs(shape, x, zMax - r, x, zMin + r, BOARD_EDGE_SEGS)
    shape.absarc(cx, zMin + r, r, Math.PI, Math.PI * 1.5, false)
    lineSegs(shape, cx, zMin, snake[0].x, snake[0].z, 8)
  } else {
    const x = BOARD_HALF
    const cx = x - r
    shape.moveTo(snake[0].x, snake[0].z)
    lineSegs(shape, snake[0].x, snake[0].z, cx, zMin, 8)
    shape.absarc(cx, zMin + r, r, -Math.PI / 2, 0, false)
    lineSegs(shape, x, zMin + r, x, zMax - r, BOARD_EDGE_SEGS)
    shape.absarc(cx, zMax - r, r, 0, Math.PI / 2, false)
    lineSegs(shape, cx, zMax, snake[snake.length - 1].x, snake[snake.length - 1].z, 8)
    for (let i = snake.length - 2; i >= 0; i--) shape.lineTo(snake[i].x, snake[i].z)
  }
  shape.closePath()
  return shape
}

function makeHalfRimShape(side: 'left' | 'right') {
  const shape = new THREE.Shape()
  const snake = makeSnakePoints()
  const w = RIM_WIDTH
  const rIn = CORNER_RADIUS
  const rOut = CORNER_RADIUS + w
  const zMin = -BOARD_HALF
  const zMax = BOARD_HALF
  const sx0 = snake[0].x
  const sx1 = snake[snake.length - 1].x
  if (side === 'left') {
    const xIn = -BOARD_HALF
    const xOut = -BOARD_HALF - w
    const cxIn = xIn + rIn
    const cxOut = xOut + rOut
    shape.moveTo(sx0, zMin)
    shape.lineTo(sx0, zMin - w)
    lineSegs(shape, sx0, zMin - w, cxOut, zMin - w, 8)
    shape.absarc(cxOut, zMin - w + rOut, rOut, -Math.PI / 2, Math.PI, true)
    lineSegs(shape, xOut, zMin - w + rOut, xOut, zMax + w - rOut, BOARD_EDGE_SEGS)
    shape.absarc(cxOut, zMax + w - rOut, rOut, Math.PI, Math.PI / 2, true)
    lineSegs(shape, cxOut, zMax + w, sx1, zMax + w, 8)
    shape.lineTo(sx1, zMax)
    lineSegs(shape, sx1, zMax, cxIn, zMax, 8)
    shape.absarc(cxIn, zMax - rIn, rIn, Math.PI / 2, Math.PI, false)
    lineSegs(shape, xIn, zMax - rIn, xIn, zMin + rIn, BOARD_EDGE_SEGS)
    shape.absarc(cxIn, zMin + rIn, rIn, Math.PI, Math.PI * 1.5, false)
    lineSegs(shape, cxIn, zMin, sx0, zMin, 8)
  } else {
    const xIn = BOARD_HALF
    const xOut = BOARD_HALF + w
    const cxIn = xIn - rIn
    const cxOut = xOut - rOut
    shape.moveTo(sx0, zMin)
    lineSegs(shape, sx0, zMin, cxIn, zMin, 8)
    shape.absarc(cxIn, zMin + rIn, rIn, -Math.PI / 2, 0, false)
    lineSegs(shape, xIn, zMin + rIn, xIn, zMax - rIn, BOARD_EDGE_SEGS)
    shape.absarc(cxIn, zMax - rIn, rIn, 0, Math.PI / 2, false)
    lineSegs(shape, cxIn, zMax, sx1, zMax, 8)
    shape.lineTo(sx1, zMax + w)
    lineSegs(shape, sx1, zMax + w, cxOut, zMax + w, 8)
    shape.absarc(cxOut, zMax + w - rOut, rOut, Math.PI / 2, 0, true)
    lineSegs(shape, xOut, zMax + w - rOut, xOut, zMin - w + rOut, BOARD_EDGE_SEGS)
    shape.absarc(cxOut, zMin - w + rOut, rOut, 0, -Math.PI / 2, true)
    lineSegs(shape, cxOut, zMin - w, sx0, zMin - w, 8)
    shape.lineTo(sx0, zMin)
  }
  shape.closePath()
  return shape
}

function boardUv(x: number, z: number) {
  return new THREE.Vector2((x + BOARD_HALF) * BOARD_UV_SCALE, (z + BOARD_HALF) * BOARD_UV_SCALE)
}

const boardUVGenerator = {
  generateTopUV: (_geometry: THREE.ExtrudeGeometry, vertices: number[], a: number, b: number, c: number) => [
    boardUv(vertices[a * 3], vertices[a * 3 + 1]),
    boardUv(vertices[b * 3], vertices[b * 3 + 1]),
    boardUv(vertices[c * 3], vertices[c * 3 + 1]),
  ],
  generateSideWallUV: (_geometry: THREE.ExtrudeGeometry, vertices: number[], a: number, b: number, c: number, d: number) => {
    const ax = vertices[a * 3]
    const ay = vertices[a * 3 + 1]
    const bx = vertices[b * 3]
    const by = vertices[b * 3 + 1]
    if (Math.abs(ay - by) < Math.abs(ax - bx)) {
      return [boardUv(ax, 0), boardUv(bx, 0), boardUv(vertices[c * 3], 0), boardUv(vertices[d * 3], 0)]
    }
    return [boardUv(0, ay), boardUv(0, by), boardUv(0, vertices[c * 3 + 1]), boardUv(0, vertices[d * 3 + 1])]
  },
}

function createWoodTexture(darker: boolean) {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context')
  const img = ctx.createImageData(size, size)
  const light = darker ? [210, 186, 148] : [232, 216, 186]
  const deep = darker ? [196, 170, 132] : [218, 198, 166]
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / size
      const y = j / size
      const wave = Math.sin(y * Math.PI * 7.5) * 0.03 + Math.sin(y * Math.PI * 21) * 0.012
      const g = x * 22 + wave * 6 + Math.sin(y * 28) * 0.18
      const rings = Math.sin(g) * 0.5 + 0.5
      const fine = Math.sin(g * 6.8 + y * 14) * 0.06
      const t = Math.min(1, Math.max(0, rings + fine))
      const mix = (1 - t) * 0.22
      const k = (i + j * size) * 4
      img.data[k] = light[0] + (deep[0] - light[0]) * mix
      img.data[k + 1] = light[1] + (deep[1] - light[1]) * mix
      img.data[k + 2] = light[2] + (deep[2] - light[2]) * mix
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function tessellateShapeGeometry(shape: THREE.Shape, maxEdge = 0.32) {
  const base = new THREE.ShapeGeometry(shape, 24)
  const src = base.index ? base.toNonIndexed() : base
  const pos = src.attributes.position
  type Tri = [number, number, number, number, number, number]
  let tris: Tri[] = []
  for (let i = 0; i < pos.count; i += 3) {
    tris.push([
      pos.getX(i), pos.getY(i),
      pos.getX(i + 1), pos.getY(i + 1),
      pos.getX(i + 2), pos.getY(i + 2),
    ])
  }
  src.dispose()
  const len = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay)
  for (let pass = 0; pass < 7; pass++) {
    const next: Tri[] = []
    let split = false
    for (const [ax, ay, bx, by, cx, cy] of tris) {
      if (len(ax, ay, bx, by) <= maxEdge && len(bx, by, cx, cy) <= maxEdge && len(cx, cy, ax, ay) <= maxEdge) {
        next.push([ax, ay, bx, by, cx, cy])
        continue
      }
      split = true
      const mx = (ax + bx + cx) / 3
      const my = (ay + by + cy) / 3
      next.push([ax, ay, bx, by, mx, my], [bx, by, cx, cy, mx, my], [cx, cy, ax, ay, mx, my])
    }
    tris = next
    if (!split) break
  }
  const positions = new Float32Array(tris.length * 9)
  const normals = new Float32Array(tris.length * 9)
  const uvs = new Float32Array(tris.length * 6)
  tris.forEach((t, i) => {
    for (let v = 0; v < 3; v++) {
      const x = t[v * 2]
      const y = t[v * 2 + 1]
      const p = i * 9 + v * 3
      positions[p] = x
      positions[p + 1] = y
      positions[p + 2] = 0
      normals[p + 2] = -1
      uvs[i * 6 + v * 2] = (x + BOARD_HALF) * BOARD_UV_SCALE
      uvs[i * 6 + v * 2 + 1] = (y + BOARD_HALF) * BOARD_UV_SCALE
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  return g
}

function flattenExtrudeCapNormals(geometry: THREE.BufferGeometry, depth: number) {
  const pos = geometry.attributes.position
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const norm = geometry.attributes.normal
  const eps = 1e-4
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    if (Math.abs(z) < eps) norm.setXYZ(i, 0, 0, -1)
    else if (Math.abs(z - depth) < eps) norm.setXYZ(i, 0, 0, 1)
  }
  norm.needsUpdate = true
}

let woodTextures: { surface: THREE.CanvasTexture; rim: THREE.CanvasTexture } | null = null
function getWoodTextures() {
  if (!woodTextures) woodTextures = { surface: createWoodTexture(false), rim: createWoodTexture(true) }
  return woodTextures
}

type SavedBoard = {
  id: string
  name: string
  version: number
  savedAt: string
  figures: FigureData[]
  split?: boolean
}

type BoardSnap = {
  figures: FigureData[]
  split: boolean
}

function cloneBoardSnap(figures: FigureData[], split: boolean): BoardSnap {
  return JSON.parse(JSON.stringify({ figures, split })) as BoardSnap
}

function boardSnapsEqual(a: BoardSnap, b: BoardSnap): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

type NoticeKind = 'info' | 'ok' | 'error'

type Notice = {
  id: number
  kind: NoticeKind
  text: string
}

function readSaves(): SavedBoard[] {
  try {
    let raw = localStorage.getItem(SAVES_KEY)
    if (!raw) {
      const legacy = localStorage.getItem('systemisches-brett-saves-v1')
      if (legacy) {
        const list = JSON.parse(legacy) as Array<Partial<SavedBoard> & { figures: FigureData[]; name: string; id: string; savedAt: string }>
        const migrated: SavedBoard[] = (Array.isArray(list) ? list : []).map((s, i) => ({
          id: s.id || crypto.randomUUID().slice(0, 10),
          name: s.name || `Stand ${i + 1}`,
          version: typeof s.version === 'number' ? s.version : 1,
          savedAt: s.savedAt || new Date().toISOString(),
          figures: s.figures || [],
          split: typeof s.split === 'boolean' ? s.split : false,
        }))
        localStorage.setItem(SAVES_KEY, JSON.stringify(migrated))
        return migrated
      }
      return []
    }
    const list = JSON.parse(raw) as Array<Partial<SavedBoard> & { figures: FigureData[]; name: string; id: string; savedAt: string }>
    if (!Array.isArray(list)) return []
    return list.map((s, i) => ({
      id: s.id || crypto.randomUUID().slice(0, 10),
      name: s.name || `Stand ${i + 1}`,
      version: typeof s.version === 'number' ? s.version : 1,
      savedAt: s.savedAt || new Date().toISOString(),
      figures: s.figures || [],
      split: typeof s.split === 'boolean' ? s.split : false,
    }))
  } catch {
    return []
  }
}

function writeSaves(saves: SavedBoard[]) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves))
  } catch {
    /* Zoom iframe may block storage */
  }
}

function nextVersionForName(saves: SavedBoard[], name: string): number {
  const same = saves.filter((s) => s.name.toLowerCase() === name.toLowerCase())
  if (same.length === 0) return 1
  return Math.max(...same.map((s) => s.version)) + 1
}

function latestVersionForName(saves: SavedBoard[], name: string): number {
  const same = saves.filter((s) => s.name.toLowerCase() === name.toLowerCase())
  if (same.length === 0) return 1
  return Math.max(...same.map((s) => s.version))
}

function normalizeFigure(f: Partial<FigureData>): FigureData | null {
  if (!f || !Array.isArray(f.position) || f.position.length < 3) return null
  return {
    id: typeof f.id === 'string' && f.id ? f.id : crypto.randomUUID().slice(0, 8),
    position: [Number(f.position[0]) || 0, Number(f.position[1]) || 0, Number(f.position[2]) || 0],
    rotationY: typeof f.rotationY === 'number' ? f.rotationY : 0,
    color: typeof f.color === 'string' ? f.color : WOOD_TONES[0],
    label: (f.label || '').trim(),
    type: FIGURE_TYPES.includes(f.type as FigureType) ? (f.type as FigureType) : 'tall',
    onBlock: !!f.onBlock,
  }
}

function normalizeFigures(list: unknown): FigureData[] {
  if (!Array.isArray(list)) return []
  return list.map((f) => normalizeFigure(f as Partial<FigureData>)).filter((f): f is FigureData => !!f)
}

function readLastBoard(): BoardSnap | null {
  try {
    const raw = localStorage.getItem(LAST_KEY) || localStorage.getItem(LAST_KEY_LEGACY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return { figures: normalizeFigures(parsed), split: false }
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { figures?: unknown }).figures)) {
      const obj = parsed as { figures: unknown; split?: unknown }
      return {
        figures: normalizeFigures(obj.figures),
        split: obj.split === true,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeLastBoard(figures: FigureData[], split: boolean) {
  try {
    const payload: BoardSnap = { figures, split }
    localStorage.setItem(LAST_KEY, JSON.stringify(payload))
  } catch {
    /* Zoom iframe may block storage */
  }
}

function labelAnchorY(type: FigureType, onBlock: boolean) {
  const blockH = onBlock ? PEDESTAL_SIZE : 0
  return (type === 'tall' ? 2.1 : type === 'medium' ? 1.6 : 1.2) + blockH
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr)
  } else {
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }
}

function paintLabelBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  scale: number,
  selected: boolean,
) {
  const fontPx = Math.max(15, 18 * scale)
  ctx.font = `${fontPx}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const padX = 12 * scale
  const padY = 3 * scale
  const tw = ctx.measureText(text).width
  const bw = tw + padX * 2
  const bh = fontPx + padY * 2
  const x = cx - bw / 2
  const y = cy - bh / 2
  fillRoundRect(ctx, x, y, bw, bh, 6 * scale)
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fill()
  if (selected) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(1, scale)
    ctx.stroke()
  }
  ctx.fillStyle = '#fff'
  ctx.fillText(text, cx, cy)
}

function paintImageCaption(
  ctx: CanvasRenderingContext2D,
  title: string,
  meta: string,
  scale: number,
) {
  const titlePx = Math.max(16, 20 * scale)
  const metaPx = Math.max(12, 14 * scale)
  const pad = 12 * scale
  const gap = 4 * scale
  const x = 12 * scale
  const y = 12 * scale
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `600 ${titlePx}px system-ui, sans-serif`
  const tw1 = ctx.measureText(title).width
  ctx.font = `${metaPx}px system-ui, sans-serif`
  const tw2 = ctx.measureText(meta).width
  const bw = Math.max(tw1, tw2) + pad * 2
  const bh = pad + titlePx + gap + metaPx + pad
  fillRoundRect(ctx, x, y, bw, bh, 8 * scale)
  ctx.fillStyle = 'rgba(13, 27, 42, 0.82)'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${titlePx}px system-ui, sans-serif`
  ctx.fillText(title, x + pad, y + pad)
  ctx.fillStyle = '#dce8df'
  ctx.font = `${metaPx}px system-ui, sans-serif`
  ctx.fillText(meta, x + pad, y + pad + titlePx + gap)
}

/** WebGL canvas + HTML nameplates (Drei Html is not part of the GL buffer). */
function composeBoardPng(
  pane: HTMLElement,
  source: HTMLCanvasElement,
  camera: THREE.Camera | null,
  figures: FigureData[],
  split: boolean,
  selectedId: string | null,
  caption?: { title: string; meta: string },
): string | null {
  if (!source.width || !source.height) return null
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, 0, 0)

  const srcRect = source.getBoundingClientRect()
  const sx = srcRect.width > 0 ? out.width / srcRect.width : 1
  const sy = srcRect.height > 0 ? out.height / srcRect.height : sx
  const scale = (sx + sy) / 2

  let badges = pane.querySelectorAll<HTMLElement>('[data-figure-label]')
  if (badges.length === 0) badges = document.querySelectorAll<HTMLElement>('[data-figure-label]')
  if (badges.length > 0) {
    badges.forEach((el) => {
      const text = (el.dataset.figureLabel || el.textContent || '').trim()
      if (!text) return
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      if (r.right < srcRect.left || r.left > srcRect.right || r.bottom < srcRect.top || r.top > srcRect.bottom) return
      const cx = (r.left + r.width / 2 - srcRect.left) * sx
      const cy = (r.top + r.height / 2 - srcRect.top) * sy
      paintLabelBadge(ctx, text, cx, cy, scale, el.dataset.selected === 'true')
    })
  } else if (camera) {
    for (const f of figures) {
      const text = (f.label || '').trim()
      if (!text) continue
      const offsetX = split ? figureSplitSign(f.position) * (SPLIT_GAP / 2) : 0
      const world = new THREE.Vector3(
        f.position[0] + offsetX,
        f.position[1] + labelAnchorY(f.type, !!f.onBlock),
        f.position[2],
      )
      const ndc = world.project(camera)
      if (ndc.z < -1 || ndc.z > 1) continue
      const cx = (ndc.x * 0.5 + 0.5) * out.width
      const cy = (-ndc.y * 0.5 + 0.5) * out.height
      paintLabelBadge(ctx, text, cx, cy, scale, selectedId === f.id)
    }
  }

  if (caption) paintImageCaption(ctx, caption.title, caption.meta, scale)

  const url = out.toDataURL('image/png')
  return !url || url === 'data:,' ? null : url
}

function findFreePosition(existing: FigureData[]): [number, number, number] {
  const margin = 0.45
  const spots: [number, number][] = [[0, 0]]
  for (let ring = 1; ring <= 10; ring++) {
    const count = ring * 6
    const radius = ring * PLACE_MIN_DIST
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      spots.push([Math.cos(a) * radius, Math.sin(a) * radius])
    }
  }
  const minDistSq = PLACE_MIN_DIST * PLACE_MIN_DIST
  for (const [x, z] of spots) {
    if (Math.abs(x) > BOARD_HALF - margin || Math.abs(z) > BOARD_HALF - margin) continue
    const taken = existing.some((f) => {
      const dx = f.position[0] - x
      const dz = f.position[2] - z
      return dx * dx + dz * dz < minDistSq
    })
    if (!taken) return [x, 0, z]
  }
  return [0, 0, 0]
}

function fileSafeName(name: string) {
  const cleaned = name.trim().replace(/[^\w\-äöüÄÖÜß ]+/g, '').replace(/\s+/g, '-')
  return cleaned || 'Aufstellung'
}

type BoardFile = {
  format: typeof FILE_FORMAT
  formatVersion: number
  name: string
  savedAt: string
  split: boolean
  figures: FigureData[]
}

function parseBoardFile(raw: string): { figures: FigureData[]; name?: string; split?: boolean } {
  const data = JSON.parse(raw) as unknown
  if (Array.isArray(data)) {
    const figures = data.map((f) => normalizeFigure(f as Partial<FigureData>)).filter((f): f is FigureData => !!f)
    if (figures.length === 0 && data.length > 0) throw new Error('empty')
    return { figures }
  }
  if (data && typeof data === 'object' && Array.isArray((data as { figures?: unknown }).figures)) {
    const obj = data as { figures: Partial<FigureData>[]; name?: string; split?: boolean }
    const figures = obj.figures.map((f) => normalizeFigure(f)).filter((f): f is FigureData => !!f)
    return {
      figures,
      name: typeof obj.name === 'string' ? obj.name : undefined,
      split: typeof obj.split === 'boolean' ? obj.split : undefined,
    }
  }
  throw new Error('unrecognized')
}

const initialFigures: FigureData[] = [
  { id: '1', position: [-3.2, 0, -1.8], rotationY: 0.3, color: '#e8d4b0', label: '', type: 'tall' },
  { id: '2', position: [-1.2, 0, -3.2], rotationY: -0.2, color: '#e0d0b0', label: '', type: 'tall' },
  { id: '3', position: [0.2, 0, -0.8], rotationY: 0.5, color: '#d4c4a0', label: '', type: 'medium' },
  { id: '4', position: [-0.9, 0, 0.6], rotationY: 0.1, color: '#e8d4b0', label: '', type: 'small', onBlock: true },
  { id: '5', position: [-1.8, 0, 1.2], rotationY: -0.4, color: '#ddd0b0', label: '', type: 'small' },
  { id: '6', position: [0.8, 0, -1.5], rotationY: 0, color: '#e0d0a8', label: '', type: 'medium' },
  { id: '7', position: [3.5, 0, -0.5], rotationY: -0.6, color: '#e8d4b0', label: '', type: 'tall' },
  { id: '8', position: [-2.5, 0, 0.3], rotationY: 0, color: '#8b6914', label: '', type: 'cube' },
  { id: '9', position: [-1.5, 0, 1.8], rotationY: 0, color: '#a67c52', label: '', type: 'disc' },
  { id: '10', position: [-4.5, 0, 3.5], rotationY: 0, color: '#c4a35a', label: '', type: 'cube' },
]

function readInitialBoard(): BoardSnap {
  return readLastBoard() ?? { figures: initialFigures, split: false }
}

function woodMat(color: string, roughness = 0.75) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={0.05} />
}

function SnakeGroove() {
  const curve = useMemo(() => {
    const pts = makeSnakePoints().map((p) => new THREE.Vector3(p.x, 0.13, p.z))
    return new THREE.CatmullRomCurve3(pts)
  }, [])
  return (
    <mesh>
      <tubeGeometry args={[curve, 128, 0.016, 8, false]} />
      <meshStandardMaterial color="#5c4a32" roughness={0.9} />
    </mesh>
  )
}

function BoardHalf({
  side,
  split,
  onPointerDown,
  showGroove,
}: {
  side: 'left' | 'right'
  split: boolean
  onPointerDown?: () => void
  showGroove: boolean
}) {
  const { surface: surfaceMap, rim: rimMap } = getWoodTextures()
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(makeHalfShape(side), {
      depth: BOARD_THICKNESS,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 20,
      UVGenerator: boardUVGenerator,
    })
    g.computeVertexNormals()
    flattenExtrudeCapNormals(g, BOARD_THICKNESS)
    return g
  }, [side])
  const surfaceGeometry = useMemo(() => tessellateShapeGeometry(makeHalfShape(side)), [side])
  const rimGeometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(makeHalfRimShape(side), {
      depth: RIM_HEIGHT,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 20,
      UVGenerator: boardUVGenerator,
    })
    g.computeVertexNormals()
    flattenExtrudeCapNormals(g, RIM_HEIGHT)
    return g
  }, [side])
  useEffect(() => () => {
    geometry.dispose()
    surfaceGeometry.dispose()
    rimGeometry.dispose()
  }, [geometry, surfaceGeometry, rimGeometry])

  const offsetX = split ? (side === 'left' ? -SPLIT_GAP / 2 : SPLIT_GAP / 2) : 0

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh
        geometry={geometry}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, BOARD_THICKNESS, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#e6d4b6" roughness={0.82} metalness={0.03} />
      </mesh>
      <mesh
        geometry={surfaceGeometry}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, BOARD_THICKNESS + 0.002, 0]}
        receiveShadow
        onPointerDown={onPointerDown}
        name={`board-${side}`}
      >
        <meshStandardMaterial
          map={surfaceMap}
          roughness={0.82}
          metalness={0.03}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh
        geometry={rimGeometry}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, RIM_HEIGHT, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial map={rimMap} roughness={0.78} metalness={0.04} />
      </mesh>
      {showGroove && <SnakeGroove />}
    </group>
  )
}

function Board({ split, onPointerDown }: { split: boolean; onPointerDown?: () => void }) {
  return (
    <group>
      <BoardHalf side="left" split={split} onPointerDown={onPointerDown} showGroove={split} />
      <BoardHalf side="right" split={split} onPointerDown={onPointerDown} showGroove={split} />
      {!split && <SnakeGroove />}
    </group>
  )
}

const BOARD_TOP = 0.12
const FOCUS_Y = BOARD_TOP + 0.008
const FOCUS_COLOR = '#d8c48a'
/** Abstand Figurkante → Innenkante des Rings (wie bei der großen Holzfigur). */
const FOCUS_GAP = 0.038
const FOCUS_THICKNESS = 0.10
const FOCUS_RING: Record<FigureType, [number, number]> = {
  tall: [0.34, 0.44],
  medium: [0.28, 0.38],
  small: [0.22, 0.32],
  cube: [0.38, 0.48],
  disc: [0.36, 0.46],
  block: [0.36, 0.46],
}

function focusMaterial() {
  return (
    <meshBasicMaterial
      color={FOCUS_COLOR}
      transparent
      opacity={0.8}
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={-1}
      polygonOffsetUnits={-1}
    />
  )
}

function makeSquareFrame(innerHalf: number, outerHalf: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-outerHalf, -outerHalf)
  shape.lineTo(outerHalf, -outerHalf)
  shape.lineTo(outerHalf, outerHalf)
  shape.lineTo(-outerHalf, outerHalf)
  shape.closePath()
  const hole = new THREE.Path()
  hole.moveTo(-innerHalf, -innerHalf)
  hole.lineTo(-innerHalf, innerHalf)
  hole.lineTo(innerHalf, innerHalf)
  hole.lineTo(innerHalf, -innerHalf)
  hole.closePath()
  shape.holes.push(hole)
  return shape
}

function FocusRing({ type, onPedestal }: { type: FigureType; onPedestal: boolean }) {
  const square = type === 'cube' || type === 'block'
  const geometry = useMemo(() => {
    if (!square) return null
    const half = (type === 'block' ? 0.55 : 0.5) / 2
    const innerHalf = half + FOCUS_GAP
    const outerHalf = innerHalf + FOCUS_THICKNESS
    return new THREE.ShapeGeometry(makeSquareFrame(innerHalf, outerHalf))
  }, [square, type])
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (square && geometry) {
    return (
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, FOCUS_Y, 0]} renderOrder={-1}>
        {focusMaterial()}
      </mesh>
    )
  }

  const [inner, outer] = FOCUS_RING[type]
  const pad = onPedestal ? 0.12 : 0
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FOCUS_Y, 0]} renderOrder={-1}>
      <ringGeometry args={[inner + pad, outer + pad, 48]} />
      {focusMaterial()}
    </mesh>
  )
}

function Eyes({
  left,
  right,
  radius,
}: {
  left: [number, number, number]
  right: [number, number, number]
  radius: number
}) {
  return (
    <>
      {[left, right].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[radius, 12, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.35} metalness={0} />
        </mesh>
      ))}
    </>
  )
}

function PegDoll({ height, color }: { height: number; color: string }) {
  const headR = height * 0.22
  const bodyH = height * 0.55
  const bodyR = height * 0.18
  const neckY = bodyH + headR * 0.3
  const headY = neckY + headR * 0.7
  const eyeX = headR * 0.32
  const eyeYOff = headR * 0.1
  const eyeZ = Math.sqrt(Math.max(0, headR * headR - eyeX * eyeX - eyeYOff * eyeYOff)) + headR * 0.04
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[bodyR * 0.85, bodyR * 1.05, bodyH, 16]} />
        {woodMat(color)}
      </mesh>
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[headR, 20, 20]} />
        {woodMat(color)}
      </mesh>
      <Eyes
        left={[-eyeX, headY + eyeYOff, eyeZ]}
        right={[eyeX, headY + eyeYOff, eyeZ]}
        radius={headR * 0.13}
      />
    </group>
  )
}

function FigureMesh({
  data, selected, onSelect, onDragStart, split,
}: {
  data: FigureData
  selected: boolean
  onSelect: (id: string) => void
  onDragStart: (id: string, e: ThreeEvent<PointerEvent>) => void
  split: boolean
}) {
  const onPedestal = !!data.onBlock
  const blockH = onPedestal ? PEDESTAL_SIZE : 0
  const label = (data.label || '').trim()
  const offsetX = split ? figureSplitSign(data.position) * (SPLIT_GAP / 2) : 0
  const labelY = labelAnchorY(data.type, onPedestal)
  return (
    <group position={[data.position[0] + offsetX, data.position[1], data.position[2]]} rotation={[0, data.rotationY, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id) }}
      onPointerDown={(e) => { e.stopPropagation(); onDragStart(data.id, e) }}
    >
      {selected && <FocusRing type={data.type} onPedestal={onPedestal} />}
      {onPedestal && (
        <mesh position={[0, PEDESTAL_SIZE / 2, 0]} castShadow>
          <boxGeometry args={[PEDESTAL_SIZE, PEDESTAL_SIZE, PEDESTAL_SIZE]} />
          {woodMat('#c4a35a', 0.7)}
        </mesh>
      )}
      <group position={[0, blockH, 0]}>
        {data.type === 'tall' && <PegDoll height={1.6} color={data.color} />}
        {data.type === 'medium' && <PegDoll height={1.15} color={data.color} />}
        {data.type === 'small' && <PegDoll height={0.85} color={data.color} />}
        {data.type === 'cube' && (
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            {woodMat(data.color, 0.7)}
          </mesh>
        )}
        {data.type === 'disc' && (
          <mesh position={[0, (onPedestal ? 0 : BOARD_TOP) + 0.125, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.25, 24]} />
            {woodMat(data.color, 0.75)}
          </mesh>
        )}
        {data.type === 'block' && (
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.55, 0.4, 0.55]} />
            {woodMat(data.color, 0.8)}
          </mesh>
        )}
      </group>
      {label ? (
        <Html position={[0, labelY, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div
            data-figure-label={label}
            data-selected={selected ? 'true' : 'false'}
            style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '3px 12px', borderRadius: 6, fontSize: 18, whiteSpace: 'nowrap', border: selected ? '1px solid #fff' : 'none' }}
          >
            {label}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

function CameraController({ preset }: { preset: string | null }) {
  const { camera, controls } = useThree() as any
  useEffect(() => {
    if (!preset) return
    const targets: Record<string, { pos: [number, number, number]; look: [number, number, number] }> = {
      top: { pos: [0, 14, 0.01], look: [0, 0, 0] },
      side: { pos: [12, 4, 0], look: [0, 0, 0] },
      iso: { pos: [7, 6, 7], look: [0, 0, 0] },
      front: { pos: [0, 3, 12], look: [0, 0, 0] },
    }
    const t = targets[preset]
    if (!t) return
    camera.position.set(...t.pos)
    if (controls?.target) { controls.target.set(...t.look); controls.update() }
    else camera.lookAt(...t.look)
  }, [preset, camera, controls])
  return null
}

function Scene({
  figures, selectedId, onSelect, onMove, dragging, setDragging, cameraPreset, split, cameraRef,
}: {
  figures: FigureData[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, pos: [number, number, number]) => void
  dragging: string | null
  setDragging: (id: string | null) => void
  cameraPreset: string | null
  split: boolean
  cameraRef: { current: THREE.Camera | null }
}) {
  const { camera, gl } = useThree()
  cameraRef.current = camera
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef(new THREE.Raycaster())
  const pointer = useRef(new THREE.Vector2())
  const controlsRef = useRef<{ enabled: boolean } | null>(null)
  const dragStartRef = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null)
  const setOrbitEnabled = useCallback((enabled: boolean) => {
    const controls = controlsRef.current
    if (controls) controls.enabled = enabled
  }, [])
  const getBoardPoint = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect()
    pointer.current.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.current.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.current.setFromCamera(pointer.current, camera)
    const target = new THREE.Vector3()
    raycaster.current.ray.intersectPlane(plane.current, target)
    if (target) {
      let x = target.x
      const z = Math.max(-BOARD_HALF, Math.min(BOARD_HALF, target.z))
      if (split) {
        x = x < snakeXAtZ(z) ? x + SPLIT_GAP / 2 : x - SPLIT_GAP / 2
      }
      x = Math.max(-BOARD_HALF, Math.min(BOARD_HALF, x))
      return [x, 0, z] as [number, number, number]
    }
    return null
  }, [camera, gl, split])
  const handleDragStart = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation?.()
    e.nativeEvent.preventDefault?.()
    setOrbitEnabled(false)
    try {
      gl.domElement.setPointerCapture(e.pointerId)
    } catch {
      /* capture optional */
    }
    dragStartRef.current = { id, x: e.clientX, y: e.clientY, moved: false }
    setDragging(id)
    onSelect(id)
  }
  const onPointerMove = useCallback((e: PointerEvent) => {
    const start = dragStartRef.current
    if (!start || !dragging) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (!start.moved && dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
    start.moved = true
    const pos = getBoardPoint(e.clientX, e.clientY)
    if (pos) onMove(start.id, pos)
  }, [dragging, getBoardPoint, onMove])
  const onPointerUp = useCallback(() => {
    dragStartRef.current = null
    setOrbitEnabled(true)
    setDragging(null)
  }, [setDragging, setOrbitEnabled])
  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [dragging, onPointerMove, onPointerUp])
  return (
    <>
      <color attach="background" args={[SCENE_BG]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 12, 6]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 6, -3]} intensity={0.35} />
      <Board split={split} onPointerDown={() => { if (!dragging) onSelect(null) }} />
      {figures.map((f) => (
        <FigureMesh key={f.id} data={f} selected={selectedId === f.id} onSelect={onSelect} onDragStart={handleDragStart} split={split} />
      ))}
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enabled={!dragging}
        enableRotate={!dragging}
        enablePan={!dragging}
        minDistance={3}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.05}
      />
      <CameraController preset={cameraPreset} />
    </>
  )
}

export default function App() {
  const [figures, setFigures] = useState<FigureData[]>(() => readInitialBoard().figures)
  const [saves, setSaves] = useState<SavedBoard[]>(() => readSaves())
  const [saveName, setSaveName] = useState('')
  const [selectedSaveId, setSelectedSaveId] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState('')
  const [history, setHistory] = useState<BoardSnap[]>(() => {
    const boot = readInitialBoard()
    return [{ figures: boot.figures, split: boot.split }]
  })
  const [historyIndex, setHistoryIndex] = useState(0)
  const [cameraPreset, setCameraPreset] = useState<string | null>(null)
  const [split, setSplit] = useState(() => readInitialBoard().split)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const skipHistory = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasPaneRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)

  const showNotice = useCallback((kind: NoticeKind, text: string) => {
    setNotice({ id: Date.now(), kind, text })
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(t)
  }, [notice])

  const applyRemoteBoard = useCallback((figs: FigureData[], remoteSplit?: boolean) => {
    skipHistory.current = true
    setFigures(figs.map((f) => ({ ...f, label: (f.label || '').trim() })))
    if (typeof remoteSplit === 'boolean') setSplit(remoteSplit)
    setSelectedId(null)
    setConfirmClear(false)
  }, [])

  const zoom = useZoomApp(applyRemoteBoard)

  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!zoom.status.inZoom || !zoom.status.ready) return
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current)
    broadcastTimer.current = setTimeout(() => {
      void zoom.broadcastBoard(figures, split)
    }, 400)
    return () => {
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current)
    }
  }, [figures, split, zoom.status.inZoom, zoom.status.ready, zoom.broadcastBoard])

  useEffect(() => {
    writeLastBoard(figures, split)
  }, [figures, split])

  const selected = figures.find((f) => f.id === selectedId) || null

  useEffect(() => {
    if (skipHistory.current) { skipHistory.current = false; return }
    if (dragging) return
    const snap = cloneBoardSnap(figures, split)
    const last = history[historyIndex]
    if (last && boardSnapsEqual(last, snap)) return
    setHistory((h) => [...h.slice(0, historyIndex + 1), snap])
    setHistoryIndex((i) => i + 1)
  }, [figures, split, dragging])

  const updateFigure = (id: string, patch: Partial<FigureData>) => {
    setFigures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  const addFigure = (type: FigureType) => {
    const id = crypto.randomUUID().slice(0, 8)
    const color = WOOD_TONES[Math.floor(Math.random() * WOOD_TONES.length)]
    setConfirmClear(false)
    setFigures((prev) => {
      const newFig: FigureData = { id, position: findFreePosition(prev), rotationY: 0, color, label: '', type, onBlock: false }
      return [...prev, newFig]
    })
    setSelectedId(id)
    setLabelInput('')
  }
  const removeSelected = () => {
    if (!selectedId) return
    setFigures((prev) => prev.filter((f) => f.id !== selectedId))
    setSelectedId(null)
  }
  const clearBoard = () => {
    setFigures([])
    setSelectedId(null)
    setConfirmClear(false)
  }
  const rotateSelected = (delta: number) => {
    if (!selectedId || !selected) return
    updateFigure(selectedId, { rotationY: selected.rotationY + delta })
  }
  const handleSelect = (id: string | null) => {
    setSelectedId(id)
    setLabelInput(figures.find((x) => x.id === id)?.label || '')
  }
  const undo = () => {
    if (historyIndex <= 0) return
    skipHistory.current = true
    const snap = history[historyIndex - 1]
    setHistoryIndex(historyIndex - 1)
    setFigures(JSON.parse(JSON.stringify(snap.figures)))
    setSplit(!!snap.split)
    setSelectedId(null)
    setConfirmClear(false)
  }
  const redo = () => {
    if (historyIndex >= history.length - 1) return
    skipHistory.current = true
    const snap = history[historyIndex + 1]
    setHistoryIndex(historyIndex + 1)
    setFigures(JSON.parse(JSON.stringify(snap.figures)))
    setSplit(!!snap.split)
    setSelectedId(null)
    setConfirmClear(false)
  }
  const saveNamed = () => {
    const name = saveName.trim()
    if (!name) { showNotice('error', 'Bitte einen Namen für „Speicher im Browser“ eingeben.'); return }
    const version = nextVersionForName(saves, name)
    const entry: SavedBoard = { id: crypto.randomUUID().slice(0, 10), name, version, savedAt: new Date().toISOString(), figures: JSON.parse(JSON.stringify(figures)), split }
    const next = [entry, ...saves]
    writeSaves(next); setSaves(next); setSelectedSaveId(entry.id); setSaveName(name)
    showNotice('ok', `Gespeichert unter „${name}“ (Version ${version})`)
  }
  const saveNewVersion = () => {
    const current = saves.find((s) => s.id === selectedSaveId)
    const name = (saveName.trim() || current?.name || '').trim()
    if (!name) { showNotice('error', 'Bitte einen Namen eingeben oder einen bestehenden Stand auswählen.'); return }
    setSaveName(name)
    const version = nextVersionForName(saves, name)
    const entry: SavedBoard = { id: crypto.randomUUID().slice(0, 10), name, version, savedAt: new Date().toISOString(), figures: JSON.parse(JSON.stringify(figures)), split }
    const next = [entry, ...saves]
    writeSaves(next); setSaves(next); setSelectedSaveId(entry.id)
    showNotice('ok', `Neue Version: „${name}“ v${version}`)
  }
  const loadSelected = () => {
    const entry = saves.find((s) => s.id === selectedSaveId)
    if (!entry) { showNotice('error', 'Bitte einen gespeicherten Stand auswählen.'); return }
    skipHistory.current = true
    const figs = entry.figures.map((f) => ({ ...f, label: (f.label || '').trim() }))
    setFigures(figs)
    setSplit(!!entry.split)
    setSelectedId(null)
    setConfirmClear(false)
    showNotice('ok', `„${entry.name}“ v${entry.version} geladen`)
  }
  const deleteSelected = () => {
    if (!selectedSaveId) return
    const next = saves.filter((s) => s.id !== selectedSaveId)
    writeSaves(next); setSaves(next); setSelectedSaveId(next[0]?.id || '')
    showNotice('info', 'Gespeicherter Stand gelöscht')
  }
  const saveToFile = () => {
    const name = saveName.trim() || 'Aufstellung'
    const payload: BoardFile = {
      format: FILE_FORMAT,
      formatVersion: FILE_FORMAT_VERSION,
      name,
      savedAt: new Date().toISOString(),
      split,
      figures: JSON.parse(JSON.stringify(figures)) as FigureData[],
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileSafeName(name)}.sbrett.json`
    a.click()
    URL.revokeObjectURL(url)
    showNotice('ok', 'Datei gespeichert')
  }
  const saveImage = () => {
    const pane = canvasPaneRef.current
    const canvas = pane?.querySelector('canvas')
    if (!pane || !canvas) {
      showNotice('error', 'Bild konnte nicht erzeugt werden.')
      return
    }
    try {
      const stored = readSaves()
      const name = saveName.trim() || stored.find((s) => s.id === selectedSaveId)?.name || saves.find((s) => s.id === selectedSaveId)?.name || 'Aufstellung'
      const version = latestVersionForName(stored.length ? stored : saves, name)
      const url = composeBoardPng(pane, canvas, cameraRef.current, figures, split, selectedId, {
        title: `${name} · v${version}`,
        meta: new Date().toLocaleString('de-DE'),
      })
      if (!url) {
        showNotice('error', 'Bild konnte nicht erzeugt werden.')
        return
      }
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileSafeName(name)}.png`
      a.click()
      showNotice('ok', 'Bild gespeichert')
    } catch {
      showNotice('error', 'Bild konnte nicht erzeugt werden.')
    }
  }
  const loadFromFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseBoardFile(String(reader.result || ''))
        skipHistory.current = true
        setFigures(parsed.figures)
        setSelectedId(null)
        setConfirmClear(false)
        if (parsed.name) setSaveName(parsed.name)
        if (typeof parsed.split === 'boolean') setSplit(parsed.split)
        showNotice('ok', parsed.name ? `„${parsed.name}“ aus Datei geladen` : 'Stand aus Datei geladen')
      } catch {
        showNotice('error', 'Die Datei ist kein gültiger SystemischesBrett-Stand.')
      }
    }
    reader.onerror = () => showNotice('error', 'Die Datei konnte nicht gelesen werden.')
    reader.readAsText(file)
  }

  const inZoomClient = zoom.status.inZoom || (typeof navigator !== 'undefined' && /ZoomWebKit|ZoomApps/i.test(navigator.userAgent || ''))

  return (
    <div data-testid="app-root" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', background: '#0d1b2a', overflow: 'hidden' }}>
      <aside
        data-testid="sidebar"
        className="app-sidebar"
        style={{
          width: 270,
          minWidth: 220,
          maxWidth: 'min(270px, 42vw)',
          flex: '0 0 auto',
          flexShrink: 0,
          background: '#15202b',
          borderRight: '1px solid #2a3a4a',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          color: '#e0e6ed',
          fontSize: 14,
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <strong style={{ fontSize: 16 }}>SystemischesBrett</strong>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>Holzfiguren · Schlangenlinie</div>
          {zoom.status.ready && (
            <div data-testid="zoom-status" style={{ marginTop: 8, padding: '6px 8px', borderRadius: 6, background: zoom.status.inZoom ? '#1a3a2a' : '#2a2a3a', fontSize: 11, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600 }}>
                {zoom.status.inZoom ? 'Zoom App' : 'Standalone'}
                {zoom.status.runningContext !== 'standalone' && zoom.status.runningContext !== 'unknown' ? ` · ${zoom.status.runningContext}` : ''}
              </div>
              {zoom.status.userName && <div>Nutzer: {zoom.status.userName}</div>}
              {zoom.status.meetingTopic && <div>Meeting: {zoom.status.meetingTopic}</div>}
              {zoom.status.error && <div style={{ color: '#f88' }}>{zoom.status.error}</div>}
            </div>
          )}
          {notice && (
            <div
              data-testid="notice"
              data-kind={notice.kind}
              role="status"
              style={{
                marginTop: 8,
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.4,
                background: notice.kind === 'error' ? '#4a2222' : notice.kind === 'ok' ? '#1a3a2a' : '#2a3344',
                color: notice.kind === 'error' ? '#f3c0c0' : '#dce8df',
              }}
            >
              {notice.text}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => addFigure('tall')} style={btnStyle}>+ Große Figur</button>
          <button onClick={() => addFigure('medium')} style={btnStyle}>+ Mittlere Figur</button>
          <button onClick={() => addFigure('small')} style={btnStyle}>+ Kleine Figur</button>
          <button onClick={() => addFigure('cube')} style={btnStyle}>+ Würfel</button>
          <button onClick={() => addFigure('disc')} style={btnStyle}>+ Scheibe</button>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3a4a' }} />
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Ausgewählt</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Label
              <input value={labelInput} onChange={(e) => setLabelInput(e.target.value)} onBlur={() => updateFigure(selected.id, { label: labelInput.trim() })} onKeyDown={(e) => { if (e.key === 'Enter') updateFigure(selected.id, { label: labelInput.trim() }) }} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Holzton
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {WOOD_TONES.map((c) => (
                  <button key={c} onClick={() => updateFigure(selected.id, { color: c })} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: selected.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={!!selected.onBlock} onChange={(e) => updateFigure(selected.id, { onBlock: e.target.checked })} />
              Auf Podest
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => rotateSelected(-0.4)} style={btnStyle}>↺ Drehen</button>
              <button onClick={() => rotateSelected(0.4)} style={btnStyle}>Drehen ↻</button>
            </div>
            <button onClick={removeSelected} style={{ ...btnStyle, background: '#5c2a2a' }}>Entfernen</button>
            <button data-testid="board-split" onClick={() => setSplit((v) => !v)} style={btnStyle}>
              {split ? 'Spielfeld zusammenführen' : 'Spielfeld trennen'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ opacity: 0.6, fontSize: 13 }}>Figur anklicken oder ziehen</div>
            <button data-testid="board-split" onClick={() => setSplit((v) => !v)} style={btnStyle}>
              {split ? 'Spielfeld zusammenführen' : 'Spielfeld trennen'}
            </button>
          </>
        )}
        <hr style={{ border: 'none', borderTop: '1px solid #2a3a4a' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button onClick={() => setCameraPreset('iso')} style={smallBtn}>Iso</button>
          <button onClick={() => setCameraPreset('top')} style={smallBtn}>Oben</button>
          <button onClick={() => setCameraPreset('side')} style={smallBtn}>Seite</button>
          <button onClick={() => setCameraPreset('front')} style={smallBtn}>Front</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={undo} disabled={historyIndex <= 0} style={btnStyle}>↩ Undo</button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} style={btnStyle}>Redo ↪</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Speicher im Browser</div>
          <input placeholder="Dateiname / Bezeichnung…" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveNamed() }} style={inputStyle} />
          <button onClick={saveNamed} style={btnStyle}>💾 Speicher im Browser</button>
          <button onClick={saveNewVersion} style={btnStyle}>📄 Neue Version</button>
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>Gespeicherte Dateien (Versionen)</div>
          <select value={selectedSaveId} onChange={(e) => { const id = e.target.value; setSelectedSaveId(id); const s = saves.find((x) => x.id === id); if (s) setSaveName(s.name) }} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— auswählen —</option>
            {[...saves].sort((a, b) => { const n = a.name.localeCompare(b.name, 'de'); return n !== 0 ? n : b.version - a.version }).map((s) => (
              <option key={s.id} value={s.id}>{s.name} · v{s.version} · {new Date(s.savedAt).toLocaleString('de-DE')}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={loadSelected} style={btnStyle} disabled={!selectedSaveId}>📂 Laden</button>
            <button onClick={deleteSelected} style={{ ...btnStyle, background: '#5c2a2a' }} disabled={!selectedSaveId}>🗑</button>
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>Datei</div>
          <button data-testid="save-file" onClick={saveToFile} style={btnStyle}>⬇ Als Datei speichern</button>
          <button data-testid="save-image" onClick={saveImage} style={btnStyle}>🖼 Als Bild speichern</button>
          <button data-testid="load-file" onClick={() => fileInputRef.current?.click()} style={btnStyle}>⬆ Aus Datei laden</button>
          <input
            ref={fileInputRef}
            data-testid="file-load-input"
            type="file"
            accept=".json,.sbrett.json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) loadFromFile(file)
            }}
          />
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {zoom.status.inZoom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Zoom</div>
              <button data-testid="zoom-share" onClick={() => void zoom.shareApp()} style={{ ...btnStyle, background: '#2d5a3d' }}>📡 App teilen</button>
              <button data-testid="zoom-expand" onClick={() => void zoom.expandApp()} style={btnStyle}>⛶ Erweitern</button>
              <button data-testid="zoom-sync" onClick={() => void zoom.broadcastBoard(figures, split)} style={btnStyle}>🔄 Brett synchronisieren</button>
            </div>
          )}
          {confirmClear ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Alle Figuren entfernen?</div>
              <button data-testid="confirm-clear" onClick={clearBoard} style={{ ...btnStyle, background: '#5c2a2a' }}>Wirklich leeren</button>
              <button data-testid="cancel-clear" onClick={() => setConfirmClear(false)} style={btnStyle}>Abbrechen</button>
            </div>
          ) : (
            <button
              data-testid="clear-board"
              onClick={() => {
                if (figures.length === 0) {
                  showNotice('info', 'Das Brett ist bereits leer.')
                  return
                }
                setConfirmClear(true)
              }}
              style={{ ...btnStyle, background: '#3a2a1a' }}
            >
              Brett leeren
            </button>
          )}
          <div style={{ fontSize: 11, opacity: 0.5 }}>Ziehen = verschieben · Klick = auswählen</div>
        </div>
      </aside>
      <div ref={canvasPaneRef} data-testid="canvas-pane" style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, position: 'relative', touchAction: 'none', background: SCENE_BG }}>
        <ErrorBoundary
          fallback={
            <div data-testid="webgl-fallback" style={{ padding: 16, color: '#dce8df', fontSize: 13 }}>
              Die 3D-Ansicht ist in diesem Zoom-Fenster nicht verfügbar. Sidebar bleibt nutzbar.
            </div>
          }
        >
          <Canvas
            shadows={!inZoomClient}
            dpr={inZoomClient ? 1 : [1, 2]}
            camera={{ position: [6, 5, 7], fov: 42 }}
            resize={{ debounce: 0 }}
            gl={{
              antialias: !inZoomClient,
              alpha: false,
              preserveDrawingBuffer: true,
              powerPreference: 'default',
              failIfMajorPerformanceCaveat: false,
            }}
            style={{ width: '100%', height: '100%', display: 'block', background: SCENE_BG, touchAction: 'none' }}
            onCreated={({ gl }) => {
              gl.setClearColor(SCENE_BG, 1)
              gl.domElement.style.touchAction = 'none'
              gl.domElement.style.width = '100%'
              gl.domElement.style.height = '100%'
            }}
            onPointerMissed={() => handleSelect(null)}
          >
            <Suspense fallback={null}>
              <Scene figures={figures} selectedId={selectedId} onSelect={handleSelect} onMove={(id, pos) => updateFigure(id, { position: pos })} dragging={dragging} setDragging={setDragging} cameraPreset={cameraPreset} split={split} cameraRef={cameraRef} />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
      </div>
    </div>
  )
}

const btnStyle: CSSProperties = { background: '#2a4a6a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }
const smallBtn: CSSProperties = { ...btnStyle, padding: '5px 10px', fontSize: 12 }
const inputStyle: CSSProperties = { background: '#0d1b2a', border: '1px solid #3a4a5a', borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 13 }
