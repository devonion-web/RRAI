const BASE = '/api/rfp'

async function req(method, path, body) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || j.message || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// ── Document storage ──────────────────────────────────────────────────────────

export async function rfpUploadFiles(formData) {
  const res = await fetch(`${BASE}/upload-files`, { method: 'POST', body: formData })
  if (!res.ok) {
    let msg = `Upload failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export async function rfpStoreText({ name, text }) {
  return req('POST', '/store-text', { name, text })
}

export async function rfpRemoveDocument(id) {
  await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' })
}

// ── Bid pack ──────────────────────────────────────────────────────────────────

export async function rfpCreatePack({ name, buyer, documentIds }) {
  return req('POST', '/packs', { name, buyer, documentIds })
}

export async function rfpGetPack(packId) {
  return req('GET', `/packs/${packId}`)
}

export async function rfpDetectSections(packId) {
  return req('POST', `/packs/${packId}/detect-sections`)
}

export async function rfpGetPackAudit(packId) {
  return req('GET', `/packs/${packId}/audit`)
}

// ── Sections ──────────────────────────────────────────────────────────────────

export async function rfpExtractBrief(sectionId) {
  return req('POST', `/sections/${sectionId}/extract-brief`)
}

export async function rfpGenerateDraft(sectionId) {
  return req('POST', `/sections/${sectionId}/draft`)
}

export async function rfpUpdateDraft(sectionId, body) {
  return req('PATCH', `/sections/${sectionId}/draft`, body)
}

export async function rfpAdvanceDraftStatus(sectionId) {
  return req('POST', `/sections/${sectionId}/draft/advance`)
}

export async function rfpReopenDraft(sectionId) {
  return req('POST', `/sections/${sectionId}/draft/reopen`)
}

export async function rfpGetSectionAudit(sectionId) {
  return req('GET', `/sections/${sectionId}/audit`)
}

export async function rfpGetRevisions(sectionId) {
  return req('GET', `/sections/${sectionId}/revisions`)
}
