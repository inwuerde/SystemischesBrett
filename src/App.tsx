import { Canvas, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Suspense, useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from 'react'
import * as THREE from 'three'
import { useZoomApp } from './zoom'

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
const SAVES_KEY = 'systemisches-brett-saves-v2'
const LAST_KEY = 'systemisches-brett-last-v1'

const BOARD_SIZE = 11
const BOARD_HALF = BOARD_SIZE / 2
const SNAKE_WAVES = 6
const SNAKE_AMPLITUDE = 0.325
const SNAKE_SEGMENTS = 96
/** Brett ≈ 50 cm bei 11 Einheiten → 2 cm Abstand ≈ 0.44 */
const SPLIT_GAP = 0.44

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

function makeHalfShape(side: 'left' | 'right') {
  const shape = new THREE.Shape()
  const outerX = side === 'left' ? -BOARD_HALF : BOARD_HALF
  const snake = makeSnakePoints()
  if (side === 'left') {
    shape.moveTo(outerX, snake[0].z)
    for (const p of snake) shape.lineTo(p.x, p.z)
    shape.lineTo(outerX, snake[snake.length - 1].z)
  } else {
    shape.moveTo(outerX, snake[0].z)
    shape.lineTo(outerX, snake[snake.length - 1].z)
    for (let i = snake.length - 1; i >= 0; i--) shape.lineTo(snake[i].x, snake[i].z)
  }
  shape.closePath()
  return shape
}

type SavedBoard = {
  id: string
  name: string
  version: number
  savedAt: string
  figures: FigureData[]
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
    }))
  } catch {
    return []
  }
}

function writeSaves(saves: SavedBoard[]) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves))
}

function nextVersionForName(saves: SavedBoard[], name: string): number {
  const same = saves.filter((s) => s.name.toLowerCase() === name.toLowerCase())
  if (same.length === 0) return 1
  return Math.max(...same.map((s) => s.version)) + 1
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
  const geometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(makeHalfShape(side), {
      depth: 0.12,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 1,
    })
  }, [side])
  useEffect(() => () => geometry.dispose(), [geometry])

  const offsetX = split ? (side === 'left' ? -SPLIT_GAP / 2 : SPLIT_GAP / 2) : 0
  const rimX = side === 'left' ? -2.75 : 2.75
  const outerX = side === 'left' ? -5.55 : 5.55

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh
        geometry={geometry}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
        receiveShadow
        castShadow
        onPointerDown={onPointerDown}
        name={`board-${side}`}
      >
        <meshStandardMaterial color="#e5d5b5" roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[outerX, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.35, 0.16, 11]} />
        {woodMat('#d4c4a0', 0.8)}
      </mesh>
      <mesh position={[rimX, 0.08, -5.55]} castShadow receiveShadow>
        <boxGeometry args={[5.6, 0.16, 0.35]} />
        {woodMat('#d4c4a0', 0.8)}
      </mesh>
      <mesh position={[rimX, 0.08, 5.55]} castShadow receiveShadow>
        <boxGeometry args={[5.6, 0.16, 0.35]} />
        {woodMat('#d4c4a0', 0.8)}
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

function PegDoll({ height, color, selected }: { height: number; color: string; selected: boolean }) {
  const headR = height * 0.22
  const bodyH = height * 0.55
  const bodyR = height * 0.18
  const neckY = bodyH + headR * 0.3
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[bodyR * 0.85, bodyR * 1.05, bodyH, 16]} />
        {woodMat(color)}
      </mesh>
      <mesh position={[0, neckY + headR * 0.7, 0]} castShadow>
        <sphereGeometry args={[headR, 20, 20]} />
        {woodMat(color)}
      </mesh>
      <mesh position={[-headR * 0.35, neckY + headR * 0.85, headR * 0.75]}>
        <sphereGeometry args={[headR * 0.12, 8, 8]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[headR * 0.35, neckY + headR * 0.85, headR * 0.75]}>
        <sphereGeometry args={[headR * 0.12, 8, 8]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[bodyR * 1.4, bodyR * 1.7, 32]} />
          <meshBasicMaterial color="#fff" transparent opacity={0.7} />
        </mesh>
      )}
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
  const blockH = data.onBlock ? 0.35 : 0
  const label = (data.label || '').trim()
  const offsetX = split ? figureSplitSign(data.position) * (SPLIT_GAP / 2) : 0
  return (
    <group position={[data.position[0] + offsetX, data.position[1], data.position[2]]} rotation={[0, data.rotationY, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id) }}
      onPointerDown={(e) => { e.stopPropagation(); onDragStart(data.id, e) }}
    >
      {data.onBlock && (
        <mesh position={[0, blockH / 2, 0]} castShadow>
          <boxGeometry args={[0.45, blockH, 0.45]} />
          {woodMat('#c4a35a', 0.8)}
        </mesh>
      )}
      <group position={[0, blockH, 0]}>
        {data.type === 'tall' && <PegDoll height={1.6} color={data.color} selected={selected} />}
        {data.type === 'medium' && <PegDoll height={1.15} color={data.color} selected={selected} />}
        {data.type === 'small' && <PegDoll height={0.85} color={data.color} selected={selected} />}
        {data.type === 'cube' && (
          <mesh position={[0, 0.28, 0]} castShadow>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            {woodMat(data.color, 0.7)}
          </mesh>
        )}
        {data.type === 'disc' && (
          <mesh position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.12, 24]} />
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
        <Html position={[0, data.type === 'tall' ? 2.1 : data.type === 'medium' ? 1.6 : 1.2, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap', border: selected ? '1px solid #fff' : 'none' }}>{label}</div>
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
  figures, selectedId, onSelect, onMove, dragging, setDragging, cameraPreset, split,
}: {
  figures: FigureData[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, pos: [number, number, number]) => void
  dragging: string | null
  setDragging: (id: string | null) => void
  cameraPreset: string | null
  split: boolean
}) {
  const { camera, gl } = useThree()
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef(new THREE.Raycaster())
  const pointer = useRef(new THREE.Vector2())
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
    setDragging(id)
    onSelect(id)
  }
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging) return
    const pos = getBoardPoint(e.clientX, e.clientY)
    if (pos) onMove(dragging, pos)
  }, [dragging, getBoardPoint, onMove])
  const onPointerUp = useCallback(() => setDragging(null), [setDragging])
  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging, onPointerMove, onPointerUp])
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 12, 6]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 6, -3]} intensity={0.35} />
      <Board split={split} onPointerDown={() => { if (!dragging) onSelect(null) }} />
      {figures.map((f) => (
        <FigureMesh key={f.id} data={f} selected={selectedId === f.id} onSelect={onSelect} onDragStart={handleDragStart} split={split} />
      ))}
      <OrbitControls makeDefault enabled={!dragging} minDistance={3} maxDistance={22} maxPolarAngle={Math.PI / 2.05} />
      <CameraController preset={cameraPreset} />
    </>
  )
}

export default function App() {
  const [figures, setFigures] = useState<FigureData[]>(() => {
    try {
      const raw = localStorage.getItem(LAST_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FigureData[]
        return parsed.map((f) => ({
          ...f,
          label: (f.label || '').trim(),
          type: (['tall', 'medium', 'small', 'cube', 'disc', 'block'].includes(f.type as string) ? f.type : 'tall') as FigureType,
        }))
      }
    } catch {}
    return initialFigures
  })
  const [saves, setSaves] = useState<SavedBoard[]>(() => readSaves())
  const [saveName, setSaveName] = useState('')
  const [selectedSaveId, setSelectedSaveId] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState('')
  const [history, setHistory] = useState<FigureData[][]>([initialFigures])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [cameraPreset, setCameraPreset] = useState<string | null>(null)
  const [split, setSplit] = useState(false)
  const skipHistory = useRef(false)

  const applyRemoteBoard = useCallback((figs: FigureData[]) => {
    skipHistory.current = true
    setFigures(figs.map((f) => ({ ...f, label: (f.label || '').trim() })))
    setSelectedId(null)
  }, [])

  const zoom = useZoomApp(applyRemoteBoard)

  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!zoom.status.inZoom || !zoom.status.ready) return
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current)
    broadcastTimer.current = setTimeout(() => {
      void zoom.broadcastBoard(figures)
    }, 400)
    return () => {
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current)
    }
  }, [figures, zoom.status.inZoom, zoom.status.ready])

  const selected = figures.find((f) => f.id === selectedId) || null

  useEffect(() => {
    if (skipHistory.current) { skipHistory.current = false; return }
    setHistory((h) => {
      const next = h.slice(0, historyIndex + 1)
      next.push(JSON.parse(JSON.stringify(figures)))
      if (next.length > 40) next.shift()
      return next
    })
    setHistoryIndex((i) => Math.min(i + 1, 39))
  }, [figures])

  const updateFigure = (id: string, patch: Partial<FigureData>) => {
    setFigures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  const addFigure = (type: FigureType) => {
    const id = crypto.randomUUID().slice(0, 8)
    const color = WOOD_TONES[Math.floor(Math.random() * WOOD_TONES.length)]
    const newFig: FigureData = { id, position: [0, 0, 0], rotationY: 0, color, label: '', type, onBlock: false }
    setFigures((prev) => [...prev, newFig])
    setSelectedId(id)
    setLabelInput('')
  }
  const removeSelected = () => {
    if (!selectedId) return
    setFigures((prev) => prev.filter((f) => f.id !== selectedId))
    setSelectedId(null)
  }
  const clearBoard = () => { setFigures([]); setSelectedId(null) }
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
    setHistoryIndex(historyIndex - 1)
    setFigures(JSON.parse(JSON.stringify(history[historyIndex - 1])))
    setSelectedId(null)
  }
  const redo = () => {
    if (historyIndex >= history.length - 1) return
    skipHistory.current = true
    setHistoryIndex(historyIndex + 1)
    setFigures(JSON.parse(JSON.stringify(history[historyIndex + 1])))
    setSelectedId(null)
  }
  const persistLast = (figs: FigureData[]) => localStorage.setItem(LAST_KEY, JSON.stringify(figs))
  const saveNamed = () => {
    const name = saveName.trim()
    if (!name) { alert('Bitte einen Namen für „Speichern unter“ eingeben.'); return }
    const version = nextVersionForName(saves, name)
    const entry: SavedBoard = { id: crypto.randomUUID().slice(0, 10), name, version, savedAt: new Date().toISOString(), figures: JSON.parse(JSON.stringify(figures)) }
    const next = [entry, ...saves]
    writeSaves(next); setSaves(next); setSelectedSaveId(entry.id); setSaveName(name); persistLast(figures)
    alert(`Gespeichert unter „${name}“ (Version ${version})`)
  }
  const saveNewVersion = () => {
    const current = saves.find((s) => s.id === selectedSaveId)
    const name = (saveName.trim() || current?.name || '').trim()
    if (!name) { alert('Bitte einen Namen eingeben oder einen bestehenden Stand auswählen.'); return }
    setSaveName(name)
    const version = nextVersionForName(saves, name)
    const entry: SavedBoard = { id: crypto.randomUUID().slice(0, 10), name, version, savedAt: new Date().toISOString(), figures: JSON.parse(JSON.stringify(figures)) }
    const next = [entry, ...saves]
    writeSaves(next); setSaves(next); setSelectedSaveId(entry.id); persistLast(figures)
    alert(`Neue Version: „${name}“ v${version}`)
  }
  const loadSelected = () => {
    const entry = saves.find((s) => s.id === selectedSaveId)
    if (!entry) { alert('Bitte einen gespeicherten Stand auswählen'); return }
    skipHistory.current = true
    const figs = entry.figures.map((f) => ({ ...f, label: (f.label || '').trim() }))
    setFigures(figs); setSelectedId(null); persistLast(figs)
  }
  const deleteSelected = () => {
    if (!selectedSaveId) return
    const next = saves.filter((s) => s.id !== selectedSaveId)
    writeSaves(next); setSaves(next); setSelectedSaveId(next[0]?.id || '')
  }

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
          <div style={{ fontWeight: 600, fontSize: 13 }}>Speichern unter</div>
          <input placeholder="Dateiname / Bezeichnung…" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveNamed() }} style={inputStyle} />
          <button onClick={saveNamed} style={btnStyle}>💾 Speichern unter</button>
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
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {zoom.status.inZoom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Zoom</div>
              <button data-testid="zoom-share" onClick={() => void zoom.shareApp()} style={{ ...btnStyle, background: '#2d5a3d' }}>📡 App teilen</button>
              <button data-testid="zoom-expand" onClick={() => void zoom.expandApp()} style={btnStyle}>⛶ Erweitern</button>
              <button data-testid="zoom-sync" onClick={() => void zoom.broadcastBoard(figures)} style={btnStyle}>🔄 Brett synchronisieren</button>
            </div>
          )}
          <button onClick={clearBoard} style={{ ...btnStyle, background: '#3a2a1a' }}>Brett leeren</button>
          <div style={{ fontSize: 11, opacity: 0.5 }}>Ziehen = verschieben · Klick = auswählen</div>
        </div>
      </aside>
      <div data-testid="canvas-pane" style={{ flex: '1 1 auto', minWidth: 0, position: 'relative' }}>
        <Canvas shadows camera={{ position: [6, 5, 7], fov: 42 }} style={{ background: 'linear-gradient(to bottom, #3a4a5a 0%, #1a2530 100%)' }} onPointerMissed={() => handleSelect(null)}>
          <Suspense fallback={null}>
            <Scene figures={figures} selectedId={selectedId} onSelect={handleSelect} onMove={(id, pos) => updateFigure(id, { position: pos })} dragging={dragging} setDragging={setDragging} cameraPreset={cameraPreset} split={split} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

const btnStyle: CSSProperties = { background: '#2a4a6a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }
const smallBtn: CSSProperties = { ...btnStyle, padding: '5px 10px', fontSize: 12 }
const inputStyle: CSSProperties = { background: '#0d1b2a', border: '1px solid #3a4a5a', borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 13 }
