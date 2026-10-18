const SCRIPT_MARKER = 'data-tennis-mate-maps'

let loading: Promise<void> | null = null

export function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve()
  }

  if (loading) {
    return loading
  }

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: '__tennisMateMapsLoaded',
    })

    window.__tennisMateMapsLoaded = () => {
      delete window.__tennisMateMapsLoaded
      resolve()
    }

    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.setAttribute(SCRIPT_MARKER, '')
    script.onerror = () => {
      loading = null
      delete window.__tennisMateMapsLoaded
      script.remove()
      reject(new Error('Google Maps를 불러오지 못했습니다.'))
    }
    document.head.append(script)
  })

  return loading
}

declare global {
  interface Window {
    __tennisMateMapsLoaded?: () => void
  }
}
