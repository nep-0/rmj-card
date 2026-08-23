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
    publicBaseUrl: process.env.QQ_BOT_PUBLIC_BASE_URL ?? '',
    enabled: (process.env.QQ_BOT_ENABLED ?? 'false').toLowerCase() === 'true',
    appid: process.env.QQ_BOT_APPID ?? '',
    secret: process.env.QQ_BOT_SECRET ?? '',
    mode: 'websocket' as const,
    intents: ['GROUP_AND_C2C_EVENT'] as const,
    removeAt: true,
    logLevel: 'info' as const,
    maxRetry: 10,
    commandPrefix: process.env.QQ_BOT_COMMAND_PREFIX ?? '/',
    style: (process.env.QQ_BOT_STYLE ?? 'modern') as 'modern' | 'QH',
    panel: {
      enabled: (process.env.QQ_BOT_PANEL_ENABLED ?? 'true').toLowerCase() === 'true',
      scope: 'group' as const,
      targetType: 'all' as const,
      remark: 'RMJ Card 群指令',
      items: [
        { name: '/help', desc: '查看帮助', type: 'command' as const },
        { name: '/bind', desc: '绑定 QQ 号与玩家名', type: 'command' as const },
        { name: '/card', desc: '生成玩家卡片，可追加玩家名', type: 'command' as const },
        { name: '/stats', desc: '查询玩家数据，可追加玩家名', type: 'command' as const },
        { name: '/good', desc: '查询好人榜，可追加玩家名', type: 'command' as const },
        { name: '/bad', desc: '查询仇人榜，可追加玩家名', type: 'command' as const },
      ],
    },
    commands: {
      bind: 'bind',
      card: 'card',
      stats: 'stats',
      goodOpponents: 'good',
      badOpponents: 'bad',
    },
  },
} as const

export type BotCommand = keyof typeof config.qqBot.commands
