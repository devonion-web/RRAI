const BASE = '/api/opportunity'

async function req(method, path, body) {
  const opts = { method, headers: {} }
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`) }
  return res.json()
}

export const oiList       = ()                                           => req('GET',    '')
export const oiCreate     = (company)                                    => req('POST',   '', { company })
export const oiGet        = (id)                                         => req('GET',    `/${id}`)
export const oiDelete     = (id)                                         => req('DELETE', `/${id}`)
export const oiPatch      = (id, body)                                   => req('PATCH',  `/${id}`, body)
export const oiEnrich     = (id, content, documentName, vendorContext)   =>
  req('POST', `/${id}/enrich`, { content, documentName, vendorContext })
