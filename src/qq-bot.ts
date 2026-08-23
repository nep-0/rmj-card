import { Bot, ReceiverMode, segment, type GroupMessageEvent } from 'qq-official-bot'

import { config } from './config.js'
import { PanelGroupRegistry } from './panel-group-registry.js'
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

export function createQqBot(cardService: PlayerCardService, nameCache: QqNameCache, panelGroups: PanelGroupRegistry): Bot<ReceiverMode> | undefined {
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
  bot.on('message.group.at', async (event) => handleGroupCommand(event, cardService, nameCache, panelGroups))
  return bot
}

async function configureCommandPanel(bot: Bot<ReceiverMode>, panelGroups: PanelGroupRegistry): Promise<void> {
  if (!config.qqBot.panel.enabled) return
  const groupOpenids = await panelGroups.list()
  if (groupOpenids.length === 0) return
  const panel = { items: [...config.qqBot.panel.items], remark: config.qqBot.panel.remark }
  const existing = await bot.getCommandPanels({ scope: config.qqBot.panel.scope, limit: 100 })
  const matching = existing.records.find((record) =>
    record.target_type === config.qqBot.panel.targetType && record.panel.remark === config.qqBot.panel.remark,
  )
  if (matching) {
    await bot.updateCommandPanel(matching.panel_id, panel)
    await bot.updateCommandPanelTargets(matching.panel_id, { op: 'add', group_openids: groupOpenids })
    return
  }
  await bot.createCommandPanel({
    scope: config.qqBot.panel.scope,
    target_type: config.qqBot.panel.targetType,
    group_openids: groupOpenids,
    panel,
  })
}

async function handleGroupCommand(event: GroupMessageEvent, cardService: PlayerCardService, nameCache: QqNameCache, panelGroups: PanelGroupRegistry): Promise<void> {
  const parsed = parseGroupCommand(event.raw_message)
  if (!parsed) return
  try {
    if (parsed.command === config.qqBot.commands.add) {
      const added = await panelGroups.add(event.group_id)
      if (added) {
        await event.reply('当前群已加入指令面板配置，机器人重启后生效。')
      } else {
        await event.reply('当前群已经在指令面板配置中。')
      }
      return
    }
    if (parsed.command === config.qqBot.commands.bind) {
      if (!parsed.name) {
        await event.reply(`用法：${config.qqBot.commandPrefix}${config.qqBot.commands.bind} 玩家名`)
        return
      }
      await nameCache.remember(event.user_id, parsed.name)
      await event.reply(`已将 QQ ${event.user_id} 绑定到玩家「${parsed.name}」。`)
      return
    }

    const name = parsed.name ?? await nameCache.getName(event.user_id)
    if (!name) {
      await event.reply(`未找到你的玩家名称，请使用 ${config.qqBot.commandPrefix}${parsed.command} 玩家名 查询。`)
      return
    }
    switch (parsed.command) {
      case config.qqBot.commands.card: {
        if (!config.qqBot.publicBaseUrl) throw new Error('QQ_BOT_PUBLIC_BASE_URL must be configured for card images')
        const imageUrl = new URL(`/api/player-cards/${encodeURIComponent(name)}.png`, config.qqBot.publicBaseUrl)
        imageUrl.searchParams.set('style', config.qqBot.style)
        await event.reply(segment.image(imageUrl.toString()))
        return
      }
      case config.qqBot.commands.stats: await event.reply(await cardService.renderStatsText(name)); return
      case config.qqBot.commands.goodOpponents: await event.reply(await cardService.renderGoodOpponentText(name)); return
      case config.qqBot.commands.badOpponents: await event.reply(await cardService.renderBadOpponentText(name)); return
    }
  } catch (error) {
    await event.reply(error instanceof Error ? error.message : '查询失败，请稍后重试。')
  }
}

export async function startQqBot(bot: Bot<ReceiverMode> | undefined, panelGroups: PanelGroupRegistry): Promise<void> {
  if (!bot) return
  await bot.start()
  await configureCommandPanel(bot, panelGroups)
}
