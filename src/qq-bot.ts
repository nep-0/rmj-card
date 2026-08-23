import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
        const png = await cardService.render(name, 'png')
        const directory = await mkdtemp(join(tmpdir(), 'rmj-card-'))
        const file = join(directory, 'player-card.png')
        try {
          await writeFile(file, png)
          await event.reply(segment.image(file))
        } finally {
          await rm(directory, { recursive: true, force: true })
        }
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
