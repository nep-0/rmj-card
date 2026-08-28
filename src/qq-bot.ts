import { createHash } from 'node:crypto'

import { Bot, ReceiverMode, segment, type GroupMessageEvent } from 'qq-official-bot'

import { config } from './config.js'
import { MatchReporter } from './match-reporter.js'
import { MatchReportRegistry } from './match-report-registry.js'
import { PanelGroupRegistry } from './panel-group-registry.js'
import { PlayerCardService } from './player-card-service.js'
import { QqNameCache } from './qq-name-cache.js'
import { QqOfficialPanelClient } from './qqofficial-panel.js'

const commandNames: readonly string[] = Object.values(config.qqBot.commands)
type CommandResult = { command: string; name?: string }
const helpText = [
  '可用指令：',
  '/bind 玩家名 - 绑定玩家名',
  '/card [玩家名] - 生成玩家卡片',
  '/stats [玩家名] - 查询玩家数据',
  '/good [玩家名] - 查询好人榜',
  '/bad [玩家名] - 查询仇人榜',
].join('\n')
function commandButtons() {
  const action = (data: string) => ({ type: 2, data, enter: true, reply: false, unsupport_tips: '请发送此指令' })
  const button = (id: string, label: string, data: string, style: number) => ({
    id,
    render_data: { label, visited_label: label, style },
    action: { ...action(data), permission: { type: 2 } },
  })
  return segment.button({ buttons: [
    button('rmj-card', '我的战绩', '/card', 1),
    button('rmj-good', '好人榜', '/good', 3),
    button('rmj-bad', '仇人榜', '/bad', 2),
  ] })
}

function commandButtonMessage(content: string) {
  return [segment.markdown(content), commandButtons()]
}



export function parseGroupCommand(rawMessage: string): CommandResult | undefined {
  const text = rawMessage.trim()
  if (!text.startsWith(config.qqBot.commandPrefix)) return undefined
  const [command, name] = text.slice(config.qqBot.commandPrefix.length).trim().split(/\s+/, 2)
  if (!command || !commandNames.includes(command)) return undefined
  return { command, name: name?.trim() || undefined }
}

export function createQqBot(cardService: PlayerCardService, nameCache: QqNameCache, panelGroups: PanelGroupRegistry, matchReports: MatchReportRegistry, reporter: MatchReporter): Bot<ReceiverMode> | undefined {
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
  bot.on('message.group.at', async (event) => handleGroupCommand(event, cardService, nameCache, panelGroups, matchReports, reporter))
  return bot
}

async function configureCommandPanel(panelGroups: PanelGroupRegistry): Promise<void> {
  if (!config.qqBot.panel.enabled) return
  const groupOpenids = await panelGroups.list()
  const panel = { items: config.qqBot.panel.items, remark: config.qqBot.panel.remark }
  await new QqOfficialPanelClient(config.qqBot.appid, config.qqBot.secret).synchronizeGroupPanel(panel, groupOpenids)
}

export async function handleGroupCommand(event: GroupMessageEvent, cardService: PlayerCardService, nameCache: QqNameCache, panelGroups: PanelGroupRegistry, matchReports: MatchReportRegistry, reporter: MatchReporter): Promise<void> {
  const parsed = parseGroupCommand(event.raw_message)
  if (!parsed) return
  try {
    if (parsed.command === config.qqBot.commands.help) {
      await event.reply(helpText)
      return
    }

    if (parsed.command === config.qqBot.commands.add) {
      if (!parsed.name) {
        await event.reply(`用法：${config.qqBot.commandPrefix}${config.qqBot.commands.add} 场所ID`)
        return
      }
      const added = await matchReports.add(event.group_id, parsed.name, event.user_id)
      if (!added) {
        await event.reply('本群已配置对局报告。')
        return
      }
      await panelGroups.add(event.group_id)
      await event.reply(`已配置雀庄 ${parsed.name}；你已成为管理员。`)
      return
    }
    if (parsed.command === config.qqBot.commands.admin || parsed.command === config.qqBot.commands.start || parsed.command === config.qqBot.commands.stop) {
      if (!matchReports || !reporter || !await matchReports.isAdmin(event.group_id, event.user_id)) return
      if (parsed.command === config.qqBot.commands.admin) {
        if (!parsed.name) { await event.reply(`用法：${config.qqBot.commandPrefix}${config.qqBot.commands.admin} 用户ID`); return }
        await event.reply(await matchReports.addAdmin(event.group_id, parsed.name) ? '已添加管理员。' : '该用户已是管理员。')
        return
      }
      if (parsed.command === config.qqBot.commands.start) { await reporter.begin(event.group_id); await event.reply('对局报告已启动。'); return }
      await reporter.end(event.group_id)
      await event.reply('对局报告已停止。')
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
        const image = await cardService.render(name, 'png', config.qqBot.style)
        const imageHash = createHash('sha256').update(image).digest('hex').slice(0, 16)
        const imageUrl = new URL(`/api/player-cards/${encodeURIComponent(name)}.png`, config.qqBot.publicBaseUrl)
        imageUrl.searchParams.set('style', config.qqBot.style)
        imageUrl.searchParams.set('v', imageHash)
        await event.reply(commandButtonMessage(`![我的战绩 #1280px #1100px](${imageUrl.toString()})`))
        return
      }
      case config.qqBot.commands.stats: await event.reply(await cardService.renderStatsText(name)); return
      case config.qqBot.commands.goodOpponents: await event.reply(commandButtonMessage(await cardService.renderGoodOpponentText(name))); return
      case config.qqBot.commands.badOpponents: await event.reply(commandButtonMessage(await cardService.renderBadOpponentText(name))); return
    }
  } catch (error) {
    await event.reply(error instanceof Error ? error.message : '查询失败，请稍后重试。')
  }
}

export async function startQqBot(bot: Bot<ReceiverMode> | undefined, panelGroups: PanelGroupRegistry): Promise<void> {
  if (!bot) return
  await bot.start()
  await configureCommandPanel(panelGroups)
}
