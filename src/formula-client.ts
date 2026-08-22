import {
  createHmac,
  createDecipheriv,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  createPublicKey,
} from 'node:crypto'

import type { FormulaHistory, OpponentStatsResult, PlayerHistoryResult, PlayerRecord, PlayerRecordsResult } from './types.js'

const BASE_URL = 'https://rmj.club/formula/'
const SESSION_REFRESH_MARGIN_MS = 60_000
const HKDF_INFO = 'formula-response-encrypt-session-v1'

type Session = {
  sid: string
  key: Buffer
  expiresAt: number
}

type SessionResponse = {
  success: boolean
  result?: {
    sid: string
    serverPublicKey: string
    salt: string
    expiresAt: number
  }
  message?: string
}

type EncryptedResponse = {
  encrypted: boolean
  sid: string
  rid: string
  iv: string
  ts: number
  data: string
}

type Envelope<T> = { success: boolean; result?: T; message?: string }

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

export class FormulaClient {
  private session?: Session
  private sessionPromise?: Promise<Session>

  async getHistory(name: string): Promise<PlayerHistoryResult> {
    return this.get<PlayerHistoryResult>(
      'index/formula/customer/history',
      { name },
    )
  }

  async getPlayerRecords(customerId: string, pageNo: number, pageSize: number): Promise<PlayerRecordsResult> {
    return this.get<PlayerRecordsResult>(
      'index/formula/customer/records',
      { customerId, pageNo: String(pageNo), pageSize: String(pageSize) },
    )
  }

  async getOpponentStats(customerId: string, pageNo: number, pageSize: number): Promise<OpponentStatsResult> {
    if (customerId.trim().length === 0) throw new Error('Customer ID must not be empty')
    if (!Number.isInteger(pageNo) || pageNo <= 0) throw new Error('Page number must be positive')
    if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('Page size must be positive')
    return this.get<OpponentStatsResult>(
      'index/formula/customer/partner-stats',
      { customerId, pageNo: String(pageNo), pageSize: String(pageSize) },
    )
  }
  private async get<T>(path: string, query: Record<string, string>): Promise<T> {
    const session = await this.getSession()
    const url = new URL(path, BASE_URL)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)

    const response = await fetch(url, { headers: { 'X-Crypto-Session': session.sid } })
    if (!response.ok) throw new Error(`Formula request failed: ${response.status}`)

    const encrypted = await response.json() as EncryptedResponse
    if (!encrypted.encrypted || encrypted.sid !== session.sid || !encrypted.rid) {
      throw new Error('Formula returned an invalid encrypted envelope')
    }

    const key = createHmac('sha256', session.key).update(encrypted.rid).digest()
    const iv = fromBase64Url(encrypted.iv)
    const ciphertext = fromBase64Url(encrypted.data)
    const aad = Buffer.from(`${encrypted.sid}.${encrypted.rid}.${encrypted.iv}.${encrypted.ts}`, 'ascii')
    if (ciphertext.length < 16) throw new Error('Formula returned invalid encrypted data')

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(aad)
    decipher.setAuthTag(ciphertext.subarray(-16))
    const plaintext = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()])
    const payload = JSON.parse(plaintext.toString('utf8')) as Envelope<T>
    if (!payload.success) throw new Error(payload.message ?? 'Formula application request failed')
    if (payload.result === undefined) throw new Error('Formula returned no result')
    return payload.result
  }

  private async getSession(): Promise<Session> {
    if (this.session && this.session.expiresAt - Date.now() > SESSION_REFRESH_MARGIN_MS) return this.session
    this.sessionPromise ??= this.createSession().finally(() => { this.sessionPromise = undefined })
    return this.sessionPromise
  }

  private async createSession(): Promise<Session> {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const clientPublicKey = publicKey.export({ type: 'spki', format: 'der' }).toString('base64url')
    const response = await fetch(new URL('security/crypto/session', BASE_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientPublicKey }),
    })
    if (!response.ok) throw new Error(`Formula session creation failed: ${response.status}`)

    const payload = await response.json() as SessionResponse
    if (!payload.success || !payload.result) throw new Error(payload.message ?? 'Formula session creation failed')
    const { sid, serverPublicKey, salt, expiresAt } = payload.result
    const serverKey = createPublicKey({ key: fromBase64Url(serverPublicKey), type: 'spki', format: 'der' })
    const sharedSecret = diffieHellman({ privateKey, publicKey: serverKey })
    const key = Buffer.from(hkdfSync('sha256', sharedSecret, fromBase64Url(salt), HKDF_INFO, 32))
    this.session = { sid, key, expiresAt }
    return this.session
  }
}
