import { QqOfficialPanelClient } from '../src/qqofficial-panel.js'

type Request = { url: string; init?: RequestInit }
const requests: Request[] = []
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const request: typeof fetch = async (input, init) => {
  const url = String(input)
  requests.push({ url, init })
  if (url === 'https://bots.qq.com/app/getAppAccessToken') return response({ access_token: 'token', expires_in: 7200 })
  if (url.includes('/v2/panels?')) return response({
    records: [{ panel_id: 'panel-1', target_type: 'specific', panel: { remark: 'RMJ Card 群指令' } }],
  })
  if (url.endsWith('/v2/panels/panel-1') && init?.method === 'GET') return response({ panel: { version: 7 } })
  return response({})
}

await new QqOfficialPanelClient('123456', 'secret', request, () => 0).synchronizeGroupPanel(
  { items: [{ name: '/card', type: 'command', desc: 'Generate a player card' }], remark: 'RMJ Card 群指令' },
  ['group-openid'],
)

const panelRequests = requests.filter(({ url }) => url.startsWith('https://api.sgroup.qq.com/v2/panels'))
if (panelRequests.length !== 4) throw new Error(`Expected four panel API requests, received ${panelRequests.length}`)
if (!panelRequests.every(({ url }) => url.startsWith('https://api.sgroup.qq.com/'))) throw new Error('Expected QQ group panel API host')
const update = panelRequests.find(({ init }) => init?.method === 'PUT' && !String(init?.body).includes('group_openids'))
if (!update) throw new Error('Expected panel content update')
const updateBody = JSON.parse(String(update.init?.body))
if (updateBody.panel.version !== 7) throw new Error('Expected panel update to include the current version')
const targets = panelRequests.find(({ init }) => String(init?.body).includes('group_openids'))
if (!targets || JSON.parse(String(targets.init?.body)).op !== 'add') throw new Error('Expected group target update')

console.log('QQ command panel synchronization uses the group panel API and current panel version')
