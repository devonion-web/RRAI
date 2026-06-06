const BASE = '/api/rfp'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || j.message || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export async function rfpStoreText({ name, text }) {
  return post('/store-text', { name, text })
}

export async function rfpExtractRequirements({ documentIds, vendorContext, company }) {
  return post('/extract-requirements', { documentIds, vendorContext, company })
}

// Poll job status — returns { jobId, status, progress, rfpUnderstanding, documentClassifications, assessment, requirements, mappingRows, mappingSummary, error }
export async function rfpGetJob(jobId) {
  const res = await fetch(`${BASE}/jobs/${jobId}`)
  if (!res.ok) {
    let msg = `Poll failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// Fire a mapping pack job — returns { jobId } immediately
export async function rfpGenerateMappingPack({ requirements, vendorContext, company, rfpUnderstanding }) {
  return post('/generate-mapping-pack', { requirements, vendorContext, company, rfpUnderstanding })
}

// Regenerate a single row — synchronous, returns { row }
export async function rfpRegenerateMappingRow({ requirement, vendorContext, company, rfpUnderstanding }) {
  return post('/regenerate-mapping-row', { requirement, vendorContext, company, rfpUnderstanding })
}

// Remove a stored document from the server
export async function rfpRemoveDocument(id) {
  await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' })
}

// Legacy routes (kept for backward compat)
export async function rfpClassify({ requirements, vendorContext, company }) {
  return post('/classify', { requirements, vendorContext, company })
}
export async function rfpGenerateResponses({ requirements, vendorContext, company }) {
  return post('/generate-responses', { requirements, vendorContext, company })
}
export async function rfpGenerateVendorPack({ requirements, vendorContext, company }) {
  return post('/generate-vendor-pack', { requirements, vendorContext, company })
}
export async function rfpGenerateGapAnalysis({ requirements, vendorContext, company }) {
  return post('/generate-gap-analysis', { requirements, vendorContext, company })
}
