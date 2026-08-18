/**
 * Zoom Apps SDK wrapper.
 * Works inside the Zoom client; falls back to standalone mode in normal browsers.
 */
import type { FigureData } from '../App'
import type { BoardSyncPayload, ZoomAppStatus, ZoomRunningContext } from './types'

const ZOOM_CAPABILITIES = [
  'shareApp',
  'getRunningContext',
  'getUserContext',
  'getMeetingContext',
  'getMeetingUUID',
  'postMessage',
  'onMessage',
  'expandApp',
  'openUrl',
  'getSupportedJsApis',
] as const

export type BoardSyncHandler = (payload: BoardSyncPayload) => void

function makeSenderId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

const SESSION_SENDER_ID = makeSenderId()

type ZoomSdkLike = {
  config: (opts: {
    version?: string
    capabilities: string[]
    popoutSize?: { width: number; height: number }
  }) => Promise<{
    runningContext?: string
    product?: string
    unsupportedApis?: string[]
    clientVersion?: string
  }>
  getRunningContext?: () => Promise<{ context?: string } | string>
  getUserContext?: () => Promise<{
    screenName?: string
    role?: string
    participantUUID?: string
  }>
  getMeetingContext?: () => Promise<{
    meetingTopic?: string
    meetingID?: string
    meetingUUID?: string
  }>
  shareApp?: (opts?: { action?: string }) => Promise<unknown>
  postMessage?: (payload: unknown) => Promise<unknown>
  onMessage?: (cb: (ev: { payload?: unknown }) => void) => void
  expandApp?: (opts?: unknown) => Promise<unknown>
  openUrl?: (opts: { url: string }) => Promise<unknown>
  getSupportedJsApis?: () => Promise<{ supportedApis?: string[] } | string[]>
}

function isInZoomClient(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & { zoomSdk?: unknown }
  if (w.zoomSdk) return true
  const ua = navigator.userAgent || ''
  return /ZoomWebKit|ZoomApps/i.test(ua)
}

async function loadSdk(): Promise<ZoomSdkLike | null> {
  const injected = (window as Window & { zoomSdk?: ZoomSdkLike }).zoomSdk
  if (injected && typeof injected.config === 'function') return injected
  try {
    const mod = await import('@zoom/appssdk')
    const sdk = (mod as { default?: ZoomSdkLike }).default ?? (mod as unknown as ZoomSdkLike)
    return sdk
  } catch {
    return null
  }
}

type ZoomConfigResult = {
  sdk: ZoomSdkLike
  configRes: Awaited<ReturnType<ZoomSdkLike['config']>>
}

let sdkConfigPromise: Promise<ZoomConfigResult | null> | null = null

/** Start zoomSdk.config() as soon as the Zoom client is detected. */
export function startZoomSdkConfig(): Promise<ZoomConfigResult | null> {
  if (sdkConfigPromise) return sdkConfigPromise
  if (typeof window === 'undefined' || !isInZoomClient()) {
    sdkConfigPromise = Promise.resolve(null)
    return sdkConfigPromise
  }
  sdkConfigPromise = (async () => {
    const sdk = await loadSdk()
    if (!sdk || typeof sdk.config !== 'function') return null
    const early = (window as Window & { __zoomConfigPromise?: Promise<ZoomConfigResult['configRes']> }).__zoomConfigPromise
    const configRes = early
      ? await early
      : await sdk.config({
          version: '0.16',
          capabilities: [...ZOOM_CAPABILITIES],
          popoutSize: { width: 960, height: 640 },
        })
    if ((window.innerHeight || 0) < 200) {
      try { await sdk.expandApp?.() } catch { /* optional */ }
    }
    return { sdk, configRes }
  })()
  return sdkConfigPromise
}

if (typeof window !== 'undefined') {
  void startZoomSdkConfig()
}

const defaultStatus = (): ZoomAppStatus => ({
  ready: false,
  inZoom: false,
  runningContext: 'standalone',
  product: null,
  userName: null,
  userRole: null,
  meetingTopic: null,
  error: null,
  supportedApis: [],
})

/**
 * Initialize Zoom Apps SDK (or standalone fallback).
 * Returns status + control helpers. Safe to call outside Zoom.
 */
export async function initZoomApp(onBoardSync?: BoardSyncHandler): Promise<{
  status: ZoomAppStatus
  shareApp: () => Promise<void>
  broadcastBoard: (figures: FigureData[], split?: boolean) => Promise<void>
  expandApp: () => Promise<void>
  openUrl: (url: string) => Promise<void>
}> {
  const status = defaultStatus()
  let sdk: ZoomSdkLike | null = null

  const noop = async () => {
    /* standalone */
  }

  const helpers = {
    shareApp: noop,
    broadcastBoard: async (_figures: FigureData[], _split?: boolean) => {
      /* standalone – no peers */
    },
    expandApp: noop,
    openUrl: async (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer')
    },
  }

  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('zoom') === '0') {
    status.ready = true
    status.runningContext = 'standalone'
    return { status, ...helpers }
  }

  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('zoom') === '1') {
    status.ready = true
    status.inZoom = true
    status.runningContext = 'inMeeting'
    status.product = 'desktop'
    status.userName = 'Demo Moderator'
    status.userRole = 'host'
    status.meetingTopic = 'Systemische Aufstellung (Demo)'
    status.supportedApis = [...ZOOM_CAPABILITIES]
    helpers.shareApp = async () => {
      console.info('[zoom-demo] shareApp()')
    }
    helpers.broadcastBoard = async (figures, split) => {
      console.info('[zoom-demo] broadcastBoard', figures.length, split ? 'split' : 'joined')
    }
    helpers.expandApp = async () => {
      console.info('[zoom-demo] expandApp()')
    }
    return { status, ...helpers }
  }

  if (!isInZoomClient()) {
    status.ready = true
    status.inZoom = false
    status.runningContext = 'standalone'
    return { status, ...helpers }
  }

  try {
    const configured = await startZoomSdkConfig()
    sdk = configured?.sdk ?? null
    if (!sdk || !configured) {
      status.ready = true
      status.inZoom = true
      status.error = 'Zoom SDK nicht geladen'
      return { status, ...helpers }
    }

    const configRes = configured.configRes

    status.ready = true
    status.inZoom = true
    status.product = configRes.product ?? null
    status.runningContext = (configRes.runningContext as ZoomRunningContext) || 'unknown'
    status.supportedApis = ZOOM_CAPABILITIES.filter(
      (c) => !(configRes.unsupportedApis || []).includes(c)
    )

    try {
      const user = await sdk.getUserContext?.()
      if (user) {
        status.userName = user.screenName ?? null
        status.userRole = user.role ?? null
      }
    } catch {
      /* optional */
    }

    try {
      const meeting = await sdk.getMeetingContext?.()
      if (meeting) {
        status.meetingTopic = meeting.meetingTopic ?? null
      }
    } catch {
      /* only in meeting */
    }

    helpers.shareApp = async () => {
      if (!sdk?.shareApp) throw new Error('shareApp nicht verfügbar')
      await sdk.shareApp()
    }

    helpers.expandApp = async () => {
      if (!sdk?.expandApp) throw new Error('expandApp nicht verfügbar')
      await sdk.expandApp()
    }

    helpers.openUrl = async (url: string) => {
      if (sdk?.openUrl) {
        await sdk.openUrl({ url })
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }

    helpers.broadcastBoard = async (figures: FigureData[], split?: boolean) => {
      if (!sdk?.postMessage) return
      const payload: BoardSyncPayload = {
        type: 'board-sync',
        figures: JSON.parse(JSON.stringify(figures)),
        split: !!split,
        senderId: SESSION_SENDER_ID,
        ts: Date.now(),
      }
      await sdk.postMessage(payload)
    }

    if (sdk.onMessage && onBoardSync) {
      sdk.onMessage((ev) => {
        const raw = ev?.payload
        if (!raw || typeof raw !== 'object') return
        const p = raw as BoardSyncPayload
        if (p.senderId && p.senderId === SESSION_SENDER_ID) return
        if (p.type === 'board-sync' && Array.isArray(p.figures)) {
          onBoardSync(p)
        }
      })
    }
  } catch (err) {
    status.ready = true
    status.inZoom = isInZoomClient()
    status.error = err instanceof Error ? err.message : String(err)
    status.runningContext = status.inZoom ? 'unknown' : 'standalone'
  }

  return { status, ...helpers }
}

export { ZOOM_CAPABILITIES }
