import { useCallback, useEffect, useRef, useState } from 'react'
import type { FigureData } from '../App'
import { initZoomApp } from './zoomClient'
import type { BoardSyncPayload, ZoomAppApi, ZoomAppStatus } from './types'

const initialStatus: ZoomAppStatus = {
  ready: false,
  inZoom: false,
  runningContext: 'standalone',
  product: null,
  userName: null,
  userRole: null,
  meetingTopic: null,
  error: null,
  supportedApis: [],
}

/**
 * React hook: Zoom Apps lifecycle + board sync.
 * @param onRemoteBoard called when another instance posts board-sync
 */
export function useZoomApp(onRemoteBoard?: (figures: FigureData[], split?: boolean) => void): ZoomAppApi {
  const [status, setStatus] = useState<ZoomAppStatus>(initialStatus)
  const apiRef = useRef<{
    shareApp: () => Promise<void>
    broadcastBoard: (figures: FigureData[], split?: boolean) => Promise<void>
    expandApp: () => Promise<void>
    openUrl: (url: string) => Promise<void>
  } | null>(null)

  const onRemoteRef = useRef(onRemoteBoard)
  onRemoteRef.current = onRemoteBoard

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const result = await initZoomApp((payload: BoardSyncPayload) => {
        onRemoteRef.current?.(payload.figures, payload.split)
      })
      if (cancelled) return
      apiRef.current = {
        shareApp: result.shareApp,
        broadcastBoard: result.broadcastBoard,
        expandApp: result.expandApp,
        openUrl: result.openUrl,
      }
      setStatus(result.status)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const shareApp = useCallback(async () => {
    await apiRef.current?.shareApp()
  }, [])

  const broadcastBoard = useCallback(async (figures: FigureData[], split?: boolean) => {
    await apiRef.current?.broadcastBoard(figures, split)
  }, [])

  const expandApp = useCallback(async () => {
    await apiRef.current?.expandApp()
  }, [])

  const openUrl = useCallback(async (url: string) => {
    await apiRef.current?.openUrl(url)
  }, [])

  return { status, shareApp, broadcastBoard, expandApp, openUrl }
}
