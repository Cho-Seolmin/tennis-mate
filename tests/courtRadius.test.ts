import { describe, expect, it } from 'vitest'
import { distanceMeters, formatDistance } from '../src/features/courts/distance.ts'
import {
  COURT_RADIUS_STORAGE_KEY,
  defaultCourtRadius,
  parseCourtRadius,
  readCourtRadius,
  writeCourtRadius,
} from '../src/features/courts/radiusStorage.ts'

describe('court radius storage', () => {
  it('accepts only 1km, 3km, and 5km', () => {
    expect(parseCourtRadius(null)).toBe(defaultCourtRadius)
    expect(parseCourtRadius('1000')).toBe(1000)
    expect(parseCourtRadius('3000')).toBe(3000)
    expect(parseCourtRadius('5000')).toBe(5000)
    expect(parseCourtRadius('2000')).toBe(3000)
    expect(parseCourtRadius('5km')).toBe(3000)
  })

  it('restores an invalid stored value to 3km', () => {
    const storage = memoryStorage({ [COURT_RADIUS_STORAGE_KEY]: '9000' })

    expect(readCourtRadius(storage)).toBe(3000)
    expect(storage.getItem(COURT_RADIUS_STORAGE_KEY)).toBe('3000')
  })

  it('keeps a valid stored radius and writes the next choice', () => {
    const storage = memoryStorage({ [COURT_RADIUS_STORAGE_KEY]: '5000' })

    expect(readCourtRadius(storage)).toBe(5000)
    writeCourtRadius(1000, storage)
    expect(storage.getItem(COURT_RADIUS_STORAGE_KEY)).toBe('1000')
  })

  it('uses 3km when storage access fails', () => {
    const storage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }

    expect(readCourtRadius(storage)).toBe(3000)
    expect(() => writeCourtRadius(5000, storage)).not.toThrow()
  })
})

describe('distance', () => {
  it('measures a straight line and formats meters', () => {
    expect(distanceMeters({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0)
    const meters = distanceMeters({ lat: 37.5, lng: 127 }, { lat: 37.501, lng: 127 })

    expect(meters).toBeGreaterThan(100)
    expect(meters).toBeLessThan(130)
    expect(formatDistance(meters)).toBe(`${Math.round(meters)}m`)
    expect(formatDistance(1500)).toBe('1.5km')
  })
})

function memoryStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial))

  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}
