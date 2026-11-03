import type { ReactNode } from 'react'
import type { FilmCamera } from './filmTimeline.ts'

export function FilmViewport({
  camera,
  children,
  className,
}: {
  camera: FilmCamera
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#05070d] ${className ?? ''}`}>
      <div
        className="h-full w-full will-change-transform motion-reduce:transition-none"
        style={{
          transform: `scale(${camera.scale})`,
          transformOrigin: `${camera.originX}% ${camera.originY}%`,
          transition: 'transform 1.85s cubic-bezier(0.33, 1, 0.68, 1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
