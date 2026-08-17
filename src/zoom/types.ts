import type { FigureData } from '../App'

/** Board state payload shared via Zoom postMessage */
export type BoardSyncPayload = {
  type: 'board-sync'
  figures: FigureData[]
  split?: boolean
  senderId?: string
  ts: number
}

export type ZoomRunningContext =
  | 'inMainClient'
  | 'inMeeting'
  | 'inWebinar'
  | 'inCollaborate'
  | 'inImmersive'
  | 'inPhone'
  | 'inCamera'
  | 'inDigitalSignage'
  | 'standalone'
  | 'unknown'

export type ZoomAppStatus = {
  ready: boolean
  inZoom: boolean
  runningContext: ZoomRunningContext
  product: string | null
  userName: string | null
  userRole: string | null
  meetingTopic: string | null
  error: string | null
  supportedApis: string[]
}

export type ZoomAppApi = {
  status: ZoomAppStatus
  /** Share the Zoom App view with meeting participants */
  shareApp: () => Promise<void>
  /** Broadcast current board figures (and split) to other app instances */
  broadcastBoard: (figures: FigureData[], split?: boolean) => Promise<void>
  /** Expand the app panel in the Zoom client */
  expandApp: () => Promise<void>
  /** Open external docs / help URL */
  openUrl: (url: string) => Promise<void>
}
