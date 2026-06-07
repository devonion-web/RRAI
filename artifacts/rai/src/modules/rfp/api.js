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

// ── Document storage (unchanged) ──────────────────────────────────────────────

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

// Create a pack from already-uploaded document IDs
export async function rfpCreatePack({ name, buyer, documentIds }) {
  return req('POST', '/packs', { name, buyer, documentIds })
}

// Fetch a pack (with all sections and drafts)
export async function rfpGetPack(packId) {
  const res = await fetch(`${BASE}/packs/${packId}`)
  if (!res.ok) {
    let msg = `Failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// Detect scored response sections in the pack
export async function rfpDetectSections(packId) {
  return req('POST', `/packs/${packId}/detect-sections`)
}

// ── Sections ──────────────────────────────────────────────────────────────────

// Extract brief for a section (synchronous, ~5–10 s)
export async function rfpExtractBrief(sectionId) {
  return req('POST', `/sections/${sectionId}/extract-brief`)
}

// Generate 12-part draft for a section (synchronous, ~15–20 s)
export async function rfpGenerateDraft(sectionId) {
  return req('POST', `/sections/${sectionId}/draft`)
}

// Save edited components / placeholders
export async function rfpUpdateDraft(sectionId, { components, placeholders }) {
  return req('PATCH', `/sections/${sectionId}/draft`, { components, placeholders })
}

// Advance status: draft → in_review → approved
export async function rfpAdvanceDraftStatus(sectionId) {
  return req('POST', `/sections/${sectionId}/draft/advance`)
}
