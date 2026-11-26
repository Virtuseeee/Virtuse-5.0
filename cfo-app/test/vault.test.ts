import { describe, expect, it } from 'vitest'
import { open, seal } from '../src/core/vault'
import { annaProfile } from '../src/data/demo'

describe('vault', () => {
  it('round-trips a profile and hides its contents', async () => {
    const p = annaProfile()
    const sealed = await seal(p, 'correct horse battery')
    expect(sealed.data).not.toContain('Hypot')
    expect(await open(sealed, 'correct horse battery')).toEqual(p)
  })

  it('refuses a wrong passphrase and a short one', async () => {
    const sealed = await seal(annaProfile(), 'correct horse battery')
    await expect(open(sealed, 'wrong passphrase!')).rejects.toThrow('wrong_passphrase')
    await expect(seal(annaProfile(), 'short')).rejects.toThrow('passphrase_short')
  })
})
