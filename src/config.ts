import { resolve } from 'node:path'

export const config = {
  server: {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
    disableSvg: ['1', 'true', 'yes'].includes((process.env.DISABLE_SVG ?? '').trim().toLowerCase()),
  },
  formula: {
    qqNameCacheFile: resolve(process.env.QQ_NAME_CACHE_FILE ?? 'data/qq-name-cache.json'),
  },
  qqBot: {
    enabled: (process.env.QQ_BOT_ENABLED ?? 'false').toLowerCase() === 'true',
    appid: process.env.QQ_BOT_APPID ?? '',
    secret: process.env.QQ_BOT_SECRET ?? '',
    mode: 'websocket' as const,
    intents: ['GROUP_AND_C2C_EVENT'] as const,
    removeAt: true,
    logLevel: 'info' as const,
    maxRetry: 10,
    commandPrefix: process.env.QQ_BOT_COMMAND_PREFIX ?? '/',
    commands: {
      card: 'card',
      stats: 'stats',
      goodOpponents: 'good',
      badOpponents: 'bad',
    },
  },
} as const

export type BotCommand = keyof typeof config.qqBot.commands
