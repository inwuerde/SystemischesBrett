import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import { Suspense, useState, useRef, useCallback, useEffect, type CSSProperties } from 'react'
import * as THREE from 'three'

export type FigureData = {
  id: string
  position: [number, number, number]
  rotationY: number
  color: string
  label: string
  type: 'person' | 'child' | 'symbol'
}

const COLORS = ['#4a90a4', '#c45c5c', '#6b8e4e', '#d4a017', '#8b5a2b', '#7b68ee', '#e67e22', '#2ecc71']
const STORAGE_KEY = 'systemisches-brett-v1'

const initialFigures: FigureData[] = [
  { id: '1', position: [-2, 0, -1], rotationY: 0.4, color: '#4a90a4', label: 'Ich', type: 'person' },
  { id: '2', position: [1.5, 0, 1], rotationY: -0.6, color: '#c45c5c', label: 'Partner', type: 'person' },
  { id: '3', position: [0, 0, 2.5], rotationY: 0, color: '#6b8e4e', label: 'Kind', type: 'child' },
]

function Board({ onPointerDown }: { onPointerDown?: () => void }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={onPointerDown} name="board">
      <planeGeometry args={[12, 12]} />
      <meshStandardMaterial color="#c4a35a" />
    </mesh>
  )
}

function FigureMesh({
  data,
  selected,
  onSelect,
  onDragStart,
}: {
  data: FigureData
  selected: boolean
  onSelect: (id: string) => void
  onDragStart: (id: string, e: ThreeEvent<PointerEvent>) => void
}) {
  const scale = data.type === 'child' ? 0.7 : 1
  return (
    <group
      position={data.position}
      rotation={[0, data.rotationY, 0]}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(data.id)
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onDragStart(data.id, e)
      }}
    >
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.25, 0.7, 4, 8]} />
        <meshStandardMaterial color={data.color} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={data.color} />
      </mesh>
      <mesh position={[0, 1.35, 0.18]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.45, 0.55, 32]} />
          <meshBasicMaterial color="#fff" transparent opacity={0.8} />
        </mesh>
      )}
      {data.label && (
        <Html position={[0, 1.9, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.75)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'nowrap',
              border: selected ? '1px solid #fff' : 'none',
            }}
          >
            {data.label}
          </div>
        </Html>
      )}
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
    if (controls?.target) {
      controls.target.set(...t.look)
      controls.update()
    } else {
      camera.lookAt(...t.look)
    }
  }, [preset, camera, controls])
  return null
}

function Scene({
  figures,
  selectedId,
  onSelect,
  onMove,
  dragging,
  setDragging,
  cameraPreset,
}: {
  figures: FigureData[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, pos: [number, number, number]) => void
  dragging: string | null
  setDragging: (id: string | null) => void
  cameraPreset: string | null
}) {
  const { camera, gl } = useThree()
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef(new THREE.Raycaster())
  const pointer = useRef(new THREE.Vector2())

  const getBoardPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.current.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.current.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.current.setFromCamera(pointer.current, camera)
      const target = new THREE.Vector3()
      raycaster.current.ray.intersectPlane(plane.current, target)
      if (target) {
        target.x = Math.max(-5.5, Math.min(5.5, target.x))
        target.z = Math.max(-5.5, Math.min(5.5, target.z))
        return [target.x, 0, target.z] as [number, number, number]
      }
      return null
    },
    [camera, gl]
  )

  const handleDragStart = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setDragging(id)
    onSelect(id)
  }

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return
      const pos = getBoardPoint(e.clientX, e.clientY)
      if (pos) onMove(dragging, pos)
    },
    [dragging, getBoardPoint, onMove]
  )

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
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 12, 6]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <Board onPointerDown={() => { if (!dragging) onSelect(null) }} />
      <Grid
        args={[12, 12]}
        cellSize={1}
        cellThickness={0.35}
        cellColor="#8b7355"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#5c4a32"
        fadeDistance={28}
        position={[0, 0.01, 0]}
      />
      {figures.map((f) => (
        <FigureMesh
          key={f.id}
          data={f}
          selected={selectedId === f.id}
          onSelect={onSelect}
          onDragStart={handleDragStart}
        />
      ))}
      <OrbitControls makeDefault enabled={!dragging} minDistance={3} maxDistance={22} maxPolarAngle={Math.PI / 2.05} />
      <CameraController preset={cameraPreset} />
    </>
  )
}

export default function App() {
  const [figures, setFigures] = useState<FigureData[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as FigureData[]
    } catch {}
    return initialFigures
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState('')
  const [history, setHistory] = useState<FigureData[][]>([initialFigures])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [cameraPreset, setCameraPreset] = useState<string | null>(null)
  const skipHistory = useRef(false)

  const selected = figures.find((f) => f.id === selectedId) || null

  useEffect(() => {
    if (skipHistory.current) {
      skipHistory.current = false
      return
    }
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

  const addFigure = (type: FigureData['type'] = 'person') => {
    const id = crypto.randomUUID().slice(0, 8)
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    const newFig: FigureData = {
      id,
      position: [0, 0, 0],
      rotationY: 0,
      color,
      label: type === 'child' ? 'Kind' : type === 'symbol' ? 'Symbol' : 'Person',
      type,
    }
    setFigures((prev) => [...prev, newFig])
    setSelectedId(id)
    setLabelInput(newFig.label)
  }

  const removeSelected = () => {
    if (!selectedId) return
    setFigures((prev) => prev.filter((f) => f.id !== selectedId))
    setSelectedId(null)
  }

  const clearBoard = () => {
    setFigures([])
    setSelectedId(null)
  }

  const rotateSelected = (delta: number) => {
    if (!selectedId || !selected) return
    updateFigure(selectedId, { rotationY: selected.rotationY + delta })
  }

  const handleSelect = (id: string | null) => {
    setSelectedId(id)
    const f = figures.find((x) => x.id === id)
    setLabelInput(f?.label || '')
  }

  const undo = () => {
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    skipHistory.current = true
    setHistoryIndex(newIndex)
    setFigures(JSON.parse(JSON.stringify(history[newIndex])))
    setSelectedId(null)
  }

  const redo = () => {
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    skipHistory.current = true
    setHistoryIndex(newIndex)
    setFigures(JSON.parse(JSON.stringify(history[newIndex])))
    setSelectedId(null)
  }

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(figures))
    alert('Gespeichert')
  }

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        skipHistory.current = true
        setFigures(JSON.parse(raw))
        setSelectedId(null)
      }
    } catch {}
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0d1b2a' }}>
      <div
        style={{
          width: 260,
          background: '#15202b',
          borderRight: '1px solid #2a3a4a',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          color: '#e0e6ed',
          fontSize: 14,
          overflowY: 'auto',
        }}
      >
        <div>
          <strong style={{ fontSize: 16 }}>SystemischesBrett</strong>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>Phase 1 – Kern</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => addFigure('person')} style={btnStyle}>+ Person</button>
          <button onClick={() => addFigure('child')} style={btnStyle}>+ Kind</button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #2a3a4a' }} />

        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Ausgewählt</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Label
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onBlur={() => updateFigure(selected.id, { label: labelInput })}
                onKeyDown={(e) => { if (e.key === 'Enter') updateFigure(selected.id, { label: labelInput }) }}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Farbe
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateFigure(selected.id, { color: c })}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: c,
                      border: selected.color === c ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => rotateSelected(-0.4)} style={btnStyle}>↺ Drehen</button>
              <button onClick={() => rotateSelected(0.4)} style={btnStyle}>Drehen ↻</button>
            </div>
            <button onClick={removeSelected} style={{ ...btnStyle, background: '#5c2a2a' }}>Entfernen</button>
          </div>
        ) : (
          <div style={{ opacity: 0.6, fontSize: 13 }}>Figur anklicken oder ziehen</div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #2a3a4a' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Kamera</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button onClick={() => setCameraPreset('iso')} style={smallBtn}>Iso</button>
            <button onClick={() => setCameraPreset('top')} style={smallBtn}>Oben</button>
            <button onClick={() => setCameraPreset('side')} style={smallBtn}>Seite</button>
            <button onClick={() => setCameraPreset('front')} style={smallBtn}>Front</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={undo} disabled={historyIndex <= 0} style={btnStyle}>↩ Undo</button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} style={btnStyle}>Redo ↪</button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} style={btnStyle}>💾 Speichern</button>
          <button onClick={load} style={btnStyle}>📂 Laden</button>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={clearBoard} style={{ ...btnStyle, background: '#3a2a1a' }}>Brett leeren</button>
          <div style={{ fontSize: 11, opacity: 0.5 }}>Ziehen = verschieben · Klick = auswählen</div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          shadows
          camera={{ position: [7, 6, 7], fov: 45 }}
          style={{ background: 'linear-gradient(to bottom, #1e3a5f 0%, #0d1b2a 100%)' }}
          onPointerMissed={() => handleSelect(null)}
        >
          <Suspense fallback={null}>
            <Scene
              figures={figures}
              selectedId={selectedId}
              onSelect={handleSelect}
              onMove={(id, pos) => updateFigure(id, { position: pos })}
              dragging={dragging}
              setDragging={setDragging}
              cameraPreset={cameraPreset}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

const btnStyle: CSSProperties = {
  background: '#2a4a6a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 13,
}

const smallBtn: CSSProperties = {
  ...btnStyle,
  padding: '5px 10px',
  fontSize: 12,
}

const inputStyle: CSSProperties = {
  background: '#0d1b2a',
  border: '1px solid #3a4a5a',
  borderRadius: 4,
  padding: '6px 8px',
  color: '#fff',
  fontSize: 13,
}
