import { describe, expect, it } from 'vitest'
import { ask } from '../src/core/ask'
import { annaProfile } from '../src/data/demo'

describe('advice check does not stop fact questions', () => {
  it('lets buy-price questions through and still stops advice', () => {
    const p = annaProfile()
    expect(ask('What is my average Bitcoin buy price?', p, 80000, null, 'en').kind).not.toBe('advice')
    expect(ask('Should I buy more Bitcoin?', p, 80000, null, 'en').kind).toBe('advice')
    expect(ask('Which broker is best?', p, 80000, null, 'en').kind).toBe('advice')
    expect(ask('Je teraz dobrý čas na nákup?', p, 80000, null, 'sk').kind).toBe('advice')
  })
})
