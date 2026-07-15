const BASE = '/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Special error types ───────────────────────────────────────────────────────

/**
 * Thrown when the server rejects a working-state save because the client's
 * expected version is behind the server's current version (HTTP 409).
 */
export class ApiConflictError extends Error {
  constructor(serverVersion) {
    super('stale')
    this.name = 'ApiConflictError'
    this.status = 409
    this.serverVersion = serverVersion ?? null
  }
}

// ── File extraction ───────────────────────────────────────────────────────────

export async function extractFiles(files) {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  const res = await fetch(`${BASE}/extract-files`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Generation endpoints ──────────────────────────────────────────────────────

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

// ── Opportunities ─────────────────────────────────────────────────────────────

export async function listOpportunities() {
  return get('/opportunities')
}

export async function createOpportunity(body) {
  return post('/opportunities', body)
}

export async function getOpportunity(id) {
  return get(`/opportunities/${id}`)
}

// ── Working state ─────────────────────────────────────────────────────────────

/**
 * Load working state for an opportunity.
 *
 * Returns `{ state: object|null, serverVersion: string|null }`.
 * `serverVersion` is the ISO timestamp of the last server save and must be
 * sent back as `expectedVersion` on the next PUT to enable stale detection.
 */
export async function getWorkingState(opportunityId) {
  return get(`/opportunities/${opportunityId}/working-state`)
}

/**
 * Save working state. Sends `expectedVersion` as a header so the server can
 * detect stale writes.
 *
 * Returns `{ savedAt: string, serverVersion: string }` on success.
 * Throws `ApiConflictError` if the server rejects the write as stale (409).
 */
export async function saveWorkingState(opportunityId, payload, expectedVersion = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (expectedVersion) headers['X-Expected-Version'] = expectedVersion

  const res = await fetch(`${BASE}/opportunities/${opportunityId}/working-state`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  })

  if (res.status === 409) {
    const data = await res.json().catch(() => ({}))
    throw new ApiConflictError(data.serverVersion ?? null)
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Events + Contacts ─────────────────────────────────────────────────────────

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

// ── SoW ───────────────────────────────────────────────────────────────────────

export async function listSowProfiles() {
  return get('/sow/profiles')
}

export async function getSowProfile(id) {
  return get(`/sow/profiles/${id}`)
}

export async function generateSoW(body) {
  return post('/sow/generate', body)
}

// ── Enrichment ────────────────────────────────────────────────────────────────

export async function enrichDealRisk(body) {
  return post('/enrich/deal-risk', body)
}

export async function enrichDiscoveryQuestions(body) {
  return post('/enrich/discovery-questions', body)
}

export async function enrichProductFit(body) {
  return post('/enrich/product-fit', body)
}

// ── Rich briefing ─────────────────────────────────────────────────────────────

export async function generateRichBriefing(body) {
  return post('/generate-rich-briefing', body)
}

// ── Email ─────────────────────────────────────────────────────────────────────

export async function generateEmails(body) {
  return post('/generate-emails', body)
}

// ── Post-demo ─────────────────────────────────────────────────────────────────

export async function generatePostDemo(body) {
  return post('/generate-post-demo', body)
}

// ── Solution breakdown ────────────────────────────────────────────────────────

export async function generateSolutionBreakdown(body) {
  return post('/generate-solution-breakdown', body)
}

// ── Proposal ─────────────────────────────────────────────────────────────────

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

// ── Value drivers ─────────────────────────────────────────────────────────────

export async function getValueDriverLibrary() {
  return get('/value-drivers')
}

export async function getOperationalMetricsLibrary() {
  return get('/operational-metrics')
}

export async function suggestValueDrivers(body) {
  return post('/suggest-value-drivers', body)
}
