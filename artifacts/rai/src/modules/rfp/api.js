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

// Store pasted/typed text on the server; returns { id, name, charCount }
export async function rfpStoreText({ name, text }) {
  return post('/store-text', { name, text })
}

// documentIds: string[] of server-side UUIDs — no raw text sent from browser
export async function rfpExtractRequirements({ documentIds, vendorContext, company }) {
  return post('/extract-requirements', { documentIds, vendorContext, company })
}

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

// Remove a stored document from the server
export async function rfpRemoveDocument(id) {
  await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' })
}
