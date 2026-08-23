import { Bot, ReceiverMode, segment, type GroupMessageEvent } from 'qq-official-bot'

import { config } from './config.js'
import { PlayerCardService } from './player-card-service.js'
import { QqNameCache } from './qq-name-cache.js'


const commandNames: readonly string[] = Object.values(config.qqBot.commands)
type CommandResult = { command: string; name?: string }

export function parseGroupCommand(rawMessage: string): CommandResult | undefined {
  const text = rawMessage.trim()
  if (!text.startsWith(config.qqBot.commandPrefix)) return undefined
  const [command, name] = text.slice(config.qqBot.commandPrefix.length).trim().split(/\s+/, 2)
  if (!command || !commandNames.includes(command)) return undefined
  return { command, name: name?.trim() || undefined }
}

export function createQqBot(cardService: PlayerCardService, nameCache: QqNameCache): Bot<ReceiverMode> | undefined {
  if (!config.qqBot.enabled) return undefined
  if (!config.qqBot.appid || !config.qqBot.secret) throw new Error('QQ bot requires QQ_BOT_APPID and QQ_BOT_SECRET')

  const bot = new Bot({
    appid: config.qqBot.appid,
    secret: config.qqBot.secret,
    mode: ReceiverMode.WEBSOCKET,
    intents: [...config.qqBot.intents],
    removeAt: config.qqBot.removeAt,
    logLevel: config.qqBot.logLevel,
    maxRetry: config.qqBot.maxRetry,
  })
  bot.on('message.group.at', async (event) => handleGroupCommand(event, cardService, nameCache))
  return bot
}

async function configureCommandPanel(bot: Bot<ReceiverMode>): Promise<void> {
  if (!config.qqBot.panel.enabled) return
  const panel = { items: [...config.qqBot.panel.items], remark: config.qqBot.panel.remark }
  const existing = await bot.getCommandPanels({ scope: config.qqBot.panel.scope, limit: 100 })
  const matching = existing.records.find((record) =>
    record.target_type === config.qqBot.panel.targetType && record.panel.remark === config.qqBot.panel.remark,
  )
  if (matching) {
    await bot.updateCommandPanel(matching.panel_id, panel)
    return
  }
  await bot.createCommandPanel({
    scope: config.qqBot.panel.scope,
    target_type: config.qqBot.panel.targetType,
    panel,
  })
}

async function handleGroupCommand(event: GroupMessageEvent, cardService: PlayerCardService, nameCache: QqNameCache): Promise<void> {
  const parsed = parseGroupCommand(event.raw_message)
  if (!parsed) return
  try {
    const name = parsed.name ?? await nameCache.getName(event.user_id)
    if (!name) {
      await event.reply(`未找到你的玩家名称，请使用 ${config.qqBot.commandPrefix}${parsed.command} 玩家名 查询。`)
      return
    }
    switch (parsed.command) {
      case config.qqBot.commands.card: {
        if (!config.qqBot.publicBaseUrl) throw new Error('QQ_BOT_PUBLIC_BASE_URL must be configured for card images')
        const imageUrl = new URL(`/api/player-cards/${encodeURIComponent(name)}.png`, config.qqBot.publicBaseUrl).toString()
        const upload = await event.bot.fileProcessor.uploadByUrl(imageUrl, {
          targetType: 'group',
          targetId: event.group_id,
          fileType: 1,
          fileName: 'player-card.png',
        })
        await event.bot.request.post(`/v2/groups/${event.group_id}/messages`, {
          msg_type: 7,
          media: { file_info: upload.file_info },
        })
        return
      }
      case config.qqBot.commands.stats: await event.reply(await cardService.renderStatsText(name)); return
      case config.qqBot.commands.goodOpponents: await event.reply(await cardService.renderGoodOpponentText(name)); return
    }
  } catch (error) {
    await event.reply(error instanceof Error ? error.message : '查询失败，请稍后重试。')
  }
}

export async function startQqBot(bot: Bot<ReceiverMode> | undefined): Promise<void> {
  if (!bot) return
  await bot.start()
  await configureCommandPanel(bot)
}
