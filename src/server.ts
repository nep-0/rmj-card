import Fastify from 'fastify'

import { config } from './config.js'
import { FormulaClient } from './formula-client.js'
import { MatchReporter } from './match-reporter.js'
import { MatchReportRegistry } from './match-report-registry.js'
import { isCardStyle, PlayerCardService } from './player-card-service.js'
import { createQqBot, startQqBot } from './qq-bot.js'
import { QqNameCache } from './qq-name-cache.js'
import { PanelGroupRegistry } from './panel-group-registry.js'

const app = Fastify({ logger: true })
const nameCache = new QqNameCache(config.formula.qqNameCacheFile)
const panelGroups = new PanelGroupRegistry(config.qqBot.panelGroupsFile)
const matchReports = new MatchReportRegistry(config.qqBot.matchReportsFile)
const formula = new FormulaClient(nameCache)
const cardService = new PlayerCardService(formula, config.qqBot.cardCacheMaxEntries, config.qqBot.cardCacheMaxBytes)
const matchReporter = new MatchReporter(formula, matchReports, async (groupId, message) => {
  if (!qqBot) return
  await qqBot.group(groupId).send(message)
}, config.qqBot.matchReportIntervalMs)
const qqBot = createQqBot(cardService, nameCache, panelGroups, matchReports, matchReporter)

app.get<{ Params: { name: string; format: 'png' | 'svg' }; Querystring: { style?: string } }>('/api/player-cards/:name.:format', async (request, reply) => {
  const { name, format } = request.params
  const style = request.query.style ?? 'modern'
  if (format !== 'png' && format !== 'svg') return reply.code(404).send({ error: 'Supported formats are png and svg' })
  if (!isCardStyle(style)) return reply.code(404).send({ error: 'Supported styles are modern and QH' })
  if (format === 'svg' && config.server.disableSvg) return reply.code(404).send({ error: 'SVG output is disabled' })

  try {
    const image = await cardService.render(name, format, style)
    const extension = format === 'png' ? 'png' : 'svg'
    return reply
      .type(format === 'png' ? 'image/png' : 'image/svg+xml')
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(name)}-${style}-formula-card.${extension}"`)
      .header('Cache-Control', 'public, max-age=300')
      .send(image)
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ error: error instanceof Error ? error.message : 'Player card generation failed' })
  }
})

app.get<{ Params: { name: string } }>('/api/player-stats/:name.txt', async (request, reply) => {
  try {
    const text = await cardService.renderStatsText(request.params.name)
    return reply.type('text/plain; charset=utf-8').header('Cache-Control', 'private, max-age=300').send(text)
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ error: error instanceof Error ? error.message : 'Player stats rendering failed' })
  }
})

app.get<{ Params: { name: string } }>('/api/player-opponents/good/:name.txt', async (request, reply) => {
  try {
    const text = await cardService.renderGoodOpponentText(request.params.name)
    return reply.type('text/plain; charset=utf-8').header('Cache-Control', 'private, max-age=300').send(text)
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ error: error instanceof Error ? error.message : 'Good opponent stats rendering failed' })
  }
})

app.get<{ Params: { name: string } }>('/api/player-opponents/bad/:name.txt', async (request, reply) => {
  try {
    const text = await cardService.renderBadOpponentText(request.params.name)
    return reply.type('text/plain; charset=utf-8').header('Cache-Control', 'private, max-age=300').send(text)
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ error: error instanceof Error ? error.message : 'Bad opponent stats rendering failed' })
  }
})

app.get('/health', async () => ({ status: 'ok' }))

app.addHook('onClose', async () => { matchReporter.stop() })

await app.listen({ port: config.server.port, host: config.server.host })
await startQqBot(qqBot, panelGroups)
matchReporter.start()
