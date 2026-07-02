import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

export interface SecurityDecision {
  allowed: boolean
  reason?: string
  code?: 'VPN_IP' | 'ACCOUNT_SHARING' | 'SUSPICIOUS_USER_AGENT'
}

export interface SecurityEvent {
  timestamp: string
  ip: string
  accountId: string
  userAgent: string
  path: string
  method: string
  action: 'allowed' | 'blocked'
  reason: string
}

interface AccountIpHit {
  ip: string
  timestamp: number
}

const FIVE_MINUTES_MS = 5 * 60 * 1000
const MAX_IPS_PER_ACCOUNT = 2

// Source publique utilisée si Internet est disponible au démarrage.
// Si elle est indisponible, le service conserve une liste locale de démonstration.
const FIREHOL_LEVEL_1_URL =
  'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset'

const LOCAL_REPUTATION_SEED = [
  '8.8.8.8/32', // IP de démonstration demandée dans le plan pour simuler une tentative VPN/proxy.
  '1.2.3.4/32',
  '45.95.147.0/24',
  '185.220.101.0/24',
]

@Injectable()
export class AntiFraudService implements OnModuleInit {
  private readonly logger = new Logger(AntiFraudService.name)
  private readonly suspiciousCidrs = new Set<string>(LOCAL_REPUTATION_SEED)
  private readonly accountIpHistory = new Map<string, AccountIpHit[]>()
  private readonly events: SecurityEvent[] = []

  async onModuleInit(): Promise<void> {
    await this.loadIpReputationList()
  }

  async loadIpReputationList(): Promise<void> {
    try {
      const response = await fetch(FIREHOL_LEVEL_1_URL, {
        signal: AbortSignal.timeout(2500),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const text = await response.text()
      let loaded = 0

      for (const rawLine of text.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        this.suspiciousCidrs.add(line)
        loaded++

        // Suffisant pour la démo locale sans surcharger la mémoire.
        if (loaded >= 5000) break
      }

      this.logger.log(
        `Liste réputation IP chargée: ${loaded} entrées FireHOL + ${LOCAL_REPUTATION_SEED.length} entrées locales`,
      )
    } catch (error) {
      this.logger.warn(
        `Impossible de télécharger FireHOL. Liste locale utilisée uniquement. Cause: ${String(
          error,
        )}`,
      )
    }
  }

  evaluateRequest(input: {
    ip: string
    accountId: string
    userAgent: string
  }): SecurityDecision {
    if (this.isSuspiciousUserAgent(input.userAgent)) {
      return {
        allowed: false,
        code: 'SUSPICIOUS_USER_AGENT',
        reason: 'User-Agent absent ou typique d’un scraper',
      }
    }

    if (this.isSuspiciousIp(input.ip)) {
      return {
        allowed: false,
        code: 'VPN_IP',
        reason: 'IP présente dans la liste de réputation VPN/proxy',
      }
    }

    if (
      input.accountId !== 'anonymous' &&
      this.detectAccountSharing(input.accountId, input.ip)
    ) {
      return {
        allowed: false,
        code: 'ACCOUNT_SHARING',
        reason: `Compte utilisé depuis plus de ${MAX_IPS_PER_ACCOUNT} IP différentes en 5 minutes`,
      }
    }

    return { allowed: true }
  }

  detectAccountSharing(accountId: string, ip: string): boolean {
    const now = Date.now()
    const recentHits = (this.accountIpHistory.get(accountId) ?? []).filter(
      (hit) => now - hit.timestamp <= FIVE_MINUTES_MS,
    )

    recentHits.push({ ip, timestamp: now })
    this.accountIpHistory.set(accountId, recentHits)

    const uniqueIps = new Set(recentHits.map((hit) => hit.ip))
    return uniqueIps.size > MAX_IPS_PER_ACCOUNT
  }

  isSuspiciousUserAgent(userAgent: string): boolean {
    const value = userAgent.trim().toLowerCase()

    if (!value) return true

    const suspiciousMarkers = [
      'python-requests',
      'curl',
      'wget',
      'scrapy',
      'httpclient',
      'headlesschrome',
      'phantomjs',
      'selenium',
      'bot',
      'spider',
    ]

    return suspiciousMarkers.some((marker) => value.includes(marker))
  }

  isSuspiciousIp(ip: string): boolean {
    const cleanIp = this.normalizeIp(ip)
    if (!cleanIp) return false

    // Whitelist des IPs locales/privées (souvent bloquées par FireHOL niveau 1)
    const privateCidrs = ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
    for (const cidr of privateCidrs) {
      if (this.ipMatchesCidr(cleanIp, cidr)) return false
    }

    for (const cidr of this.suspiciousCidrs) {
      if (this.ipMatchesCidr(cleanIp, cidr)) return true
    }

    return false
  }

  addSecurityEvent(event: SecurityEvent): void {
    this.events.unshift(event)

    // On garde seulement les derniers événements pour une démo lisible.
    if (this.events.length > 200) {
      this.events.pop()
    }
  }

  getRecentEvents(): SecurityEvent[] {
    return this.events
  }

  getStats() {
    const blocked = this.events.filter((event) => event.action === 'blocked')
    const allowed = this.events.filter((event) => event.action === 'allowed')

    return {
      reputationEntries: this.suspiciousCidrs.size,
      trackedAccounts: this.accountIpHistory.size,
      allowedRequests: allowed.length,
      blockedRequests: blocked.length,
      lastEvents: this.events.slice(0, 10),
    }
  }

  private normalizeIp(ip: string): string {
    return ip.replace('::ffff:', '').trim()
  }

  private ipMatchesCidr(ip: string, cidr: string): boolean {
    const [range, bitsRaw] = cidr.split('/')
    const bits = bitsRaw ? Number(bitsRaw) : 32

    const ipNumber = this.ipToNumber(ip)
    const rangeNumber = this.ipToNumber(range)

    if (ipNumber === null || rangeNumber === null || Number.isNaN(bits)) {
      return false
    }

    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (ipNumber & mask) === (rangeNumber & mask)
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
      return null
    }

    return (
      ((parts[0] << 24) >>> 0) +
      ((parts[1] << 16) >>> 0) +
      ((parts[2] << 8) >>> 0) +
      parts[3]
    )
  }
}
