import Fastify from 'fastify'

import { FormulaClient } from './formula-client.js'
import { isCardStyle, PlayerCardService } from './player-card-service.js'

const disableSvg = ['1', 'true', 'yes'].includes((process.env.DISABLE_SVG ?? '').trim().toLowerCase())

const app = Fastify({ logger: true })
const cardService = new PlayerCardService(new FormulaClient())

app.get<{ Params: { name: string; format: 'png' | 'svg' }; Querystring: { style?: string } }>('/api/player-cards/:name.:format', async (request, reply) => {
  const { name, format } = request.params
  const style = request.query.style ?? 'modern'
  if (format !== 'png' && format !== 'svg') return reply.code(404).send({ error: 'Supported formats are png and svg' })
  if (!isCardStyle(style)) return reply.code(404).send({ error: 'Supported styles are modern and QH' })
  if (format === 'svg' && disableSvg) return reply.code(404).send({ error: 'SVG output is disabled' })

  try {
    const image = await cardService.render(name, format, style)
    const extension = format === 'png' ? 'png' : 'svg'
    return reply
      .type(format === 'png' ? 'image/png' : 'image/svg+xml')
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}-${style}-formula-card.${extension}"`)
      .header('Cache-Control', 'private, max-age=300')
      .send(image)
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ error: error instanceof Error ? error.message : 'Player card generation failed' })
  }
})

app.get('/health', async () => ({ status: 'ok' }))

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
