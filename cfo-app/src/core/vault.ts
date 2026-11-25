// Encrypts the profile on the device with a passphrase only the user knows.
// PBKDF2-SHA256 (310,000 rounds) → AES-GCM 256. Virtuse never sees the key.

import type { Profile } from './model'

const ITERATIONS = 310_000
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface Sealed {
  v: 1
  salt: string
  iv: string
  data: string
}

function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(profile: Profile, passphrase: string): Promise<Sealed> {
  if (passphrase.length < 8) throw new Error('passphrase_short')
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const key = await deriveKey(passphrase, salt)
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(profile)),
  )
  return { v: 1, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) }
}

export async function open(sealed: Sealed, passphrase: string): Promise<Profile> {
  const key = await deriveKey(passphrase, unb64(sealed.salt))
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(sealed.iv) },
      key,
      unb64(sealed.data),
    )
  } catch {
    throw new Error('wrong_passphrase')
  }
  const profile = JSON.parse(dec.decode(plain)) as Profile
  if (profile.version !== 1) throw new Error('unknown_version')
  return profile
}

const STORE_KEY = 'vcfo-vault-v1'

export function saveSealed(sealed: Sealed): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(sealed))
}

export function loadSealed(): Sealed | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Sealed) : null
  } catch {
    return null
  }
}

export function forgetSealed(): void {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    /* storage blocked: nothing stored */
  }
}
