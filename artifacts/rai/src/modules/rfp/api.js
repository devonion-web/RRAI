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

// Upload files (multipart) — returns { files: [{id, name, fileType, charCount?, rowCount?, error?}] }
export async function rfpUploadFiles(formData) {
  const res = await fetch(`${BASE}/upload-files`, { method: 'POST', body: formData })
  if (!res.ok) {
    let msg = `Upload failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// Store pasted text — returns { id, name, charCount, fileType }
export async function rfpStoreText({ name, text }) {
  return req('POST', '/store-text', { name, text })
}

// Remove a stored document
export async function rfpRemoveDocument(id) {
  await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' })
}

// Fire the workbench analysis job — returns { jobId }
export async function rfpAnalyse({ documentIds, vendorContext, company }) {
  return req('POST', '/analyse', { documentIds, vendorContext, company })
}

// Poll job — returns { jobId, status, progress, intelligenceSummary, responseSections, documentClassifications, error }
export async function rfpGetJob(jobId) {
  const res = await fetch(`${BASE}/jobs/${jobId}`)
  if (!res.ok) {
    let msg = `Poll failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// Generate a brief for a response section — sync, returns { brief }
export async function rfpSectionBrief({ section, intelligenceSummary, company, vendorContext }) {
  return req('POST', '/section-brief', { section, intelligenceSummary, company, vendorContext })
}

// Draft a response section — sync, returns { draft, assumptions, vendor_inputs_needed }
export async function rfpDraftSection({ section, brief, company, vendorContext }) {
  return req('POST', '/draft-section', { section, brief, company, vendorContext })
}
