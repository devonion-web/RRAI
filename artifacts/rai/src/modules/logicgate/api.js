const BASE = '/api'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json()
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function extractFiles(files) {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  const res = await fetch(`${BASE}/extract-files`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function generatePrep(body) {
  return post('/generate-prep', body)
}

export async function postDiscovery(body) {
  return post('/post-discovery', body)
}

export async function dealStrategy(body) {
  return post('/deal-strategy', body)
}

export async function generateScorecard(body) {
  return post('/generate-scorecard', body)
}

export async function updateScore(body) {
  return post('/update-score', body)
}

export async function createOpportunity(body) {
  return post('/opportunities', body)
}

export async function getOpportunity(id) {
  return get(`/opportunities/${id}`)
}

export async function addManualEvent(id, body) {
  return post(`/opportunities/${id}/events`, body)
}

export async function extractContacts(body) {
  return post('/extract-contacts', body)
}

export async function saveContacts(body) {
  return post('/contacts', body)
}

export async function getOpportunityContacts(id) {
  return get(`/opportunities/${id}/contacts`)
}

export function getContactsExportUrl(id) {
  return `${BASE}/opportunities/${id}/contacts/export`
}

export async function enrichContactApi(id, body) {
  return post(`/contacts/${id}/enrich`, body)
}

export async function listSowProfiles() {
  return get('/sow/profiles')
}

export async function getSowProfile(id) {
  return get(`/sow/profiles/${id}`)
}

export async function generateSoW(body) {
  return post('/sow/generate', body)
}

export async function enrichDealRisk(body) {
  return post('/enrich/deal-risk', body)
}

export async function enrichDiscoveryQuestions(body) {
  return post('/enrich/discovery-questions', body)
}

export async function enrichProductFit(body) {
  return post('/enrich/product-fit', body)
}

export async function generateRichBriefing(body) {
  return post('/generate-rich-briefing', body)
}

export async function generateEmails(body) {
  return post('/generate-emails', body)
}

export async function generatePostDemo(body) {
  return post('/generate-post-demo', body)
}

export async function generateSolutionBreakdown(body) {
  return post('/generate-solution-breakdown', body)
}

export async function generateProposalEmail(body) {
  return post('/generate-proposal-email', body)
}

export async function generateProposalDocument(body) {
  return post('/generate-proposal-document', body)
}

export async function generateProposalSection(body) {
  return post('/generate-proposal-section', body)
}

export async function verifyProposal(body) {
  return post('/verify-proposal', body)
}

export async function getValueDriverLibrary() {
  return get('/value-drivers')
}

export async function getOperationalMetricsLibrary() {
  return get('/operational-metrics')
}

export async function suggestValueDrivers(body) {
  return post('/suggest-value-drivers', body)
}
