import { describe, expect, it } from 'vitest'
import { getActiveStagePresetId } from '../stagePresets'

describe('getActiveStagePresetId', () => {
  it('returns the matching preset before using device fallback', () => {
    expect(getActiveStagePresetId(1080, 1920, { isMobileDevice: false })).toBe('mobile')
    expect(getActiveStagePresetId(1920, 1080, { isMobileDevice: true })).toBe('desktop')
    expect(getActiveStagePresetId(2048, 858, { isMobileDevice: true })).toBe('film')
  })

  it('defaults to desktop for unknown sizes on desktop devices', () => {
    expect(getActiveStagePresetId(1600, 900, { isMobileDevice: false })).toBe('desktop')
  })

  it('defaults to mobile for unknown sizes on mobile devices', () => {
    expect(getActiveStagePresetId(1600, 900, { isMobileDevice: true })).toBe('mobile')
  })
})
