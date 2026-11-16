import { useEffect, useRef, useState } from 'react'
import { api, AuthError, GOOGLE_CLIENT_ID, LOGIN_URL, MOCK_MODE } from '../api'
import { loginWithIdToken, loginWithToken } from '../auth'
import { AppMark } from '../components/icons'
import { GhostButton, PrimaryButton } from '../components/ui'

const POLL_MS = 2000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

function newNonce() {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function errorText(e: unknown) {
  if (e instanceof AuthError && e.code === 'NOT_MEMBER') {
    return `Email ${e.email ?? ''} chưa được thêm vào danh sách gia đình. Nhờ admin thêm vào tab "members" của Google Sheet.`
  }
  if (e instanceof AuthError) return 'Đăng nhập không hợp lệ, vui lòng thử lại.'
  return 'Không kết nối được máy chủ: ' + (e instanceof Error ? e.message : String(e))
}

export function Login() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 pt-safe pb-safe text-center">
      <div className="animate-pop mb-6 rounded-[26px] shadow-float">
        <AppMark size={84} />
      </div>
      <h1 className="text-[28px] font-bold tracking-tight">Baby Feed</h1>
      <p className="mt-2 mb-12 max-w-[260px] text-[15px] leading-relaxed text-muted">Theo dõi giờ ăn, giấc ngủ và thay tã của bé, cùng cả gia đình.</p>

      <div className="w-full max-w-xs">
        {MOCK_MODE ? (
          <>
            <PrimaryButton
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await loginWithIdToken('mock').catch((e) => setError(errorText(e)))
                setBusy(false)
              }}
            >
              Vào chế độ demo
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Chưa cấu hình VITE_APPS_SCRIPT_URL, dữ liệu chỉ lưu trên máy này.</p>
          </>
        ) : LOGIN_URL ? (
          <AppsScriptLogin onError={setError} />
        ) : GOOGLE_CLIENT_ID ? (
          <GsiLogin onError={setError} busy={busy} setBusy={setBusy} />
        ) : (
          <p className="text-danger">Thiếu VITE_LOGIN_URL (hoặc VITE_GOOGLE_CLIENT_ID) trong file .env</p>
        )}
      </div>

      {error && <p className="mt-5 max-w-xs rounded-2xl bg-peach-soft px-4 py-3 text-sm text-peach-strong">{error}</p>}
    </div>
  )
}

/* -------- Google login through the companion Apps Script (no OAuth client) -------- */

function AppsScriptLogin({ onError }: { onError: (m: string) => void }) {
  // Resume polling if we navigated away in the same tab (popup blocked) and came back.
  const [nonce, setNonce] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('loginNonce')
    } catch {
      return null
    }
  })
  const startedAt = useRef(0)

  const open = (n: string) => {
    const url = `${LOGIN_URL}?nonce=${n}&return=${encodeURIComponent(location.origin + location.pathname)}`
    // Must run synchronously inside the click handler or popup blockers kick in.
    const w = window.open(url, '_blank')
    if (!w) location.href = url
  }

  const start = () => {
    const n = newNonce()
    onError('')
    try {
      sessionStorage.setItem('loginNonce', n)
    } catch {
      /* ignore */
    }
    startedAt.current = Date.now()
    setNonce(n)
    open(n)
  }

  useEffect(() => {
    if (!nonce) return
    if (!startedAt.current) startedAt.current = Date.now()
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    const finish = () => {
      stopped = true
      clearTimeout(timer)
      try {
        sessionStorage.removeItem('loginNonce')
      } catch {
        /* ignore */
      }
    }

    const poll = async () => {
      if (stopped) return
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        finish()
        setNonce(null)
        onError('Hết thời gian chờ đăng nhập, vui lòng thử lại.')
        return
      }
      try {
        const res = await api.loginClaim(nonce)
        if (stopped) return
        if ('token' in res) {
          // Claim is idempotent, so if this fails we simply retry on the next tick.
          await loginWithToken(res.token)
          finish()
          return
        }
      } catch (e) {
        if (e instanceof AuthError) {
          finish()
          setNonce(null)
          onError(errorText(e))
          return
        }
        // network hiccup: keep polling
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !stopped) {
        clearTimeout(timer)
        void poll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    timer = setTimeout(poll, POLL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [nonce, onError])

  if (!nonce) {
    return (
      <button
        onClick={start}
        className="press flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-surface text-base font-semibold text-ink shadow-card ring-1 ring-line"
      >
        <GoogleG />
        Đăng nhập với Google
      </button>
    )
  }

  return (
    <div>
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-primary-soft border-t-primary" />
      <p className="font-medium">Đang chờ đăng nhập…</p>
      <p className="mt-1 text-sm text-muted">Hoàn tất đăng nhập Google ở trang vừa mở, rồi quay lại đây.</p>
      <div className="mt-6 space-y-2">
        <GhostButton className="bg-fill" onClick={() => open(nonce)}>
          Mở lại trang đăng nhập
        </GhostButton>
        <GhostButton
          className="text-muted"
          onClick={() => {
            try {
              sessionStorage.removeItem('loginNonce')
            } catch {
              /* ignore */
            }
            setNonce(null)
          }}
        >
          Huỷ
        </GhostButton>
      </div>
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/* -------- Alternative: Google Identity Services button (needs OAuth client) -------- */

function GsiLogin({ onError, busy, setBusy }: { onError: (m: string) => void; busy: boolean; setBusy: (b: boolean) => void }) {
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!document.querySelector('script[data-gsi]')) {
      const sc = document.createElement('script')
      sc.src = 'https://accounts.google.com/gsi/client'
      sc.async = true
      sc.dataset.gsi = '1'
      document.head.appendChild(sc)
    }
    let cancelled = false
    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !btnRef.current) return false
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: async (r) => {
          setBusy(true)
          onError('')
          await loginWithIdToken(r.credential).catch((e) => onError(errorText(e)))
          setBusy(false)
        },
        auto_select: true,
        ux_mode: 'popup',
      })
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        locale: 'vi',
        width: Math.min(320, window.innerWidth - 64),
      })
      return true
    }
    if (init()) return () => void (cancelled = true)
    const id = setInterval(() => init() && clearInterval(id), 200)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [onError, setBusy])

  return <div ref={btnRef} className={`flex justify-center ${busy ? 'pointer-events-none opacity-50' : ''}`} />
}
