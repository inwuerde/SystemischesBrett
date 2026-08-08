import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Text } from '@react-three/drei'
import { Suspense } from 'react'

function Board() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="#c4a35a" />
    </mesh>
  )
}

function Figure({ position, color = '#8b5a2b', label }: { position: [number, number, number]; color?: string; label?: string }) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.25, 0.7, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {label && (
        <Text
          position={[0, 1.8, 0]}
          fontSize={0.25}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000"
        >
          {label}
        </Text>
      )}
    </group>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Board />
      <Grid
        args={[10, 10]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#8b7355"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#5c4a32"
        fadeDistance={20}
        position={[0, 0.01, 0]}
      />
      <Figure position={[-2, 0, -1]} color="#4a90a4" label="Ich" />
      <Figure position={[1.5, 0, 1]} color="#c45c5c" label="Partner" />
      <Figure position={[0, 0, 2.5]} color="#6b8e4e" label="Kind" />
      <OrbitControls makeDefault minDistance={3} maxDistance={20} maxPolarAngle={Math.PI / 2.1} />
    </>
  )
}

export default function App() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [6, 5, 6], fov: 45 }}
        style={{ background: 'linear-gradient(to bottom, #1e3a5f 0%, #0d1b2a 100%)' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          background: 'rgba(0,0,0,0.6)',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 14,
          pointerEvents: 'none',
        }}
      >
        <strong>SystemischesBrett</strong> – 3D Demo<br />
        <span style={{ opacity: 0.8 }}>Maus: drehen / scrollen: zoomen</span>
      </div>
    </div>
  )
}
