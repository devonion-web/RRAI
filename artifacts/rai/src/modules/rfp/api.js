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
  // The draft route uses SSE to send keepalive pings while the model runs (90–180 s),
  // then delivers the final payload as a `data:` event. We read the stream manually
  // because EventSource doesn't support POST.
  const res = await fetch(`${BASE}/sections/${sectionId}/draft`, { method: 'POST' })
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || j.message || msg } catch {}
    throw new Error(msg)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE lines end with \n\n — scan for complete events
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''               // last chunk may be incomplete
    for (const block of events) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))
        if (payload.error) throw new Error(payload.error)
        return payload                         // { draft, sectionStatus }
      }
    }
  }
  throw new Error('Draft stream ended without a data event — please retry.')
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

export async function rfpFillPlaceholder(sectionId, phId, value) {
  return req('POST', `/sections/${sectionId}/placeholders/${encodeURIComponent(phId)}/fill`, { value })
}

export async function rfpMarkComponentReviewed(sectionId, compName, reviewed) {
  return req('PATCH', `/sections/${sectionId}/components/${encodeURIComponent(compName)}/reviewed`, { reviewed })
}

// ── Engagement profile ────────────────────────────────────────────────────────

export async function rfpSaveProfile(packId, data) {
  return req('POST', `/packs/${packId}/profile`, data)
}

export async function rfpGetProfile(packId) {
  return req('GET', `/packs/${packId}/profile`)
}

// ── Decompose (SSE) ───────────────────────────────────────────────────────────

export async function rfpDecompose(packId) {
  const res = await fetch(`${BASE}/packs/${packId}/decompose`, { method: 'POST' })
  if (!res.ok) {
    let msg = `Decompose failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }

  // Read SSE stream; on network drop fall through to polling
  try {
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer    = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const block of events) {
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))
          if (payload.error) throw new Error(payload.error)
          return payload   // { requirements, crossCuttingConstraints }
        }
      }
    }
  } catch (e) {
    // Re-throw deliberate server errors; let network drops fall through to polling
    if (e.message && !e.message.toLowerCase().includes('network') &&
        !e.message.toLowerCase().includes('aborted') &&
        !e.message.toLowerCase().includes('failed to fetch')) throw e
  }

  // SSE connection dropped before server finished — poll /requirements until data appears
  const deadline = Date.now() + 6 * 60_000   // up to 6 minutes
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5_000))
    try {
      const poll = await fetch(`${BASE}/packs/${packId}/requirements`)
      if (poll.ok) {
        const { requirements } = await poll.json()
        if (Array.isArray(requirements) && requirements.length > 0) {
          const crossCuttingConstraints = requirements[0]?.crossCuttingConstraints ?? []
          return { requirements, crossCuttingConstraints }
        }
      }
    } catch {}  // keep polling on transient errors
  }
  throw new Error('Decompose is taking longer than expected — please wait a moment and retry.')
}

// ── Requirements ──────────────────────────────────────────────────────────────

export async function rfpGetRequirements(packId) {
  return req('GET', `/packs/${packId}/requirements`)
}

export async function rfpConfirmOwnership(reqId, data) {
  return req('PATCH', `/requirements/${reqId}/ownership`, data)
}

// ── Respond (SSE) ─────────────────────────────────────────────────────────────

export async function rfpRespond(reqId) {
  const res = await fetch(`${BASE}/requirements/${reqId}/respond`, { method: 'POST' })
  if (!res.ok) {
    let msg = `Respond failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const block of events) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))
        if (payload.error) throw new Error(payload.error)
        return payload   // { response }
      }
    }
  }
  throw new Error('Respond stream ended without a data event — please retry.')
}

export async function rfpGetResponse(reqId) {
  return req('GET', `/requirements/${reqId}/response`)
}

export async function rfpUpdateBlock(reqId, blockKey, answer) {
  return req('PATCH', `/requirements/${reqId}/response/blocks/${encodeURIComponent(blockKey)}`, { answer })
}

export async function rfpFillBlockPH(reqId, blockKey, phId, value) {
  return req('POST', `/requirements/${reqId}/response/blocks/${encodeURIComponent(blockKey)}/placeholders/${encodeURIComponent(phId)}/fill`, { value })
}

export async function rfpMarkBlockReviewed(reqId, blockKey, reviewed) {
  return req('PATCH', `/requirements/${reqId}/response/blocks/${encodeURIComponent(blockKey)}/reviewed`, { reviewed })
}

export async function rfpAdvanceResponse(reqId) {
  return req('POST', `/requirements/${reqId}/response/advance`)
}

export async function rfpReopenResponse(reqId) {
  return req('POST', `/requirements/${reqId}/response/reopen`)
}

// ── Quality reviews ───────────────────────────────────────────────────────────

export async function rfpGetQualityReviews(packId, { reviewType, targetId } = {}) {
  const params = new URLSearchParams()
  if (reviewType) params.set('reviewType', reviewType)
  if (targetId)   params.set('targetId',   targetId)
  const qs = params.toString() ? `?${params}` : ''
  return req('GET', `/packs/${packId}/quality-reviews${qs}`)
}

// ── Validate decomp (SSE) ─────────────────────────────────────────────────────

export async function rfpValidateDecomp(packId) {
  const res = await fetch(`${BASE}/packs/${packId}/validate-decomp`, { method: 'POST' })
  if (!res.ok) {
    let msg = `Validate-decomp failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const block of events) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))
        if (payload.error) throw new Error(payload.error)
        return payload   // { qualityReview, workflowStage }
      }
    }
  }
  throw new Error('Validate-decomp stream ended without a data event.')
}

// ── Gate override ─────────────────────────────────────────────────────────────

export async function rfpOverrideGate(packId, { reviewType, reason, actor, targetId, advanceTo } = {}) {
  return req('POST', `/packs/${packId}/gate/override`, { reviewType, reason, actor, targetId, advanceTo })
}

// ── Validate ownership ────────────────────────────────────────────────────────

export async function rfpValidateOwnership(packId) {
  return req('POST', `/packs/${packId}/validate-ownership`)
}

// ── Validate response (per requirement) ───────────────────────────────────────

export async function rfpValidateResponse(reqId) {
  return req('POST', `/requirements/${reqId}/validate-response`)
}

// ── Rewrite block (SSE) ───────────────────────────────────────────────────────

export async function rfpRewriteBlock(reqId, blockKey) {
  const res = await fetch(`${BASE}/requirements/${reqId}/blocks/${encodeURIComponent(blockKey)}/rewrite`, { method: 'POST' })
  if (!res.ok) {
    let msg = `Rewrite failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg; if (j.escalated) { const e = new Error(msg); e.escalated = true; throw e } } catch (inner) { if (inner.escalated) throw inner }
    throw new Error(msg)
  }
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const block of events) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))
        if (payload.error) throw new Error(payload.error)
        return payload   // { block }
      }
    }
  }
  throw new Error('Rewrite stream ended without a data event.')
}

// ── Assemble ──────────────────────────────────────────────────────────────────

export async function rfpAssemble(packId) {
  return req('POST', `/packs/${packId}/assemble`)
}

// ── Validate final (SSE) ──────────────────────────────────────────────────────

export async function rfpValidateFinal(packId) {
  const res = await fetch(`${BASE}/packs/${packId}/validate-final`, { method: 'POST' })
  if (!res.ok) {
    let msg = `Validate-final failed: ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const block of events) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))
        if (payload.error) throw new Error(payload.error)
        return payload   // { qualityReview, requirementFlags, workflowStage }
      }
    }
  }
  throw new Error('Validate-final stream ended without a data event.')
}
