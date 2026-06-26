import { describe, expect, it } from 'vitest'
import { MediaStorageService } from './MediaStorageService'

describe('MediaStorageService', () => {
  it('keeps generated community file keys within the default MySQL varchar limit', () => {
    const storage = new MediaStorageService()
    const longFilename = [
      'task_01km1s81dsf0vvqhrq8dfgp8rc',
      'task_01km1s81dsf0vvqhrq8dfgp8rc',
      'genid_4149fd5f-2a78-406b-8099-c7261a1b73c5',
      '26_03_19_00_52_747632',
      'videos_00000_517255319_source_with_extra_suffix_to_force_truncation',
    ].join('_') + '.mp4'

    const fileKey = storage.buildFileKey('cmqukl6pg0007pti3qxexroud', longFilename)

    expect(fileKey.length).toBeLessThanOrEqual(191)
    expect(fileKey).toMatch(/^community\/cmqukl6pg0007pti3qxexroud\/[a-f0-9]{16}-/)
    expect(fileKey).toMatch(/\.mp4$/)
  })
})
