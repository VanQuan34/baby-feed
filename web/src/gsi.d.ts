// Minimal typings for Google Identity Services (https://accounts.google.com/gsi/client)
interface GsiCredentialResponse {
  credential: string
  select_by?: string
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string
          callback: (r: GsiCredentialResponse) => void
          auto_select?: boolean
          ux_mode?: 'popup' | 'redirect'
          cancel_on_tap_outside?: boolean
        }): void
        renderButton(el: HTMLElement, options: Record<string, unknown>): void
        prompt(): void
        disableAutoSelect(): void
      }
    }
  }
}

interface ImportMetaEnv {
  readonly VITE_APPS_SCRIPT_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_LOGIN_URL?: string
}
