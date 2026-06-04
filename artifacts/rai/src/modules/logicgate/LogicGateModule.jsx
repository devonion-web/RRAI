import React, { useEffect, useMemo, useRef, useState } from 'react'
import logo from './assets/rr-logo.png'
import { extractFiles, generatePrep, postDiscovery, dealStrategy, generateScorecard, updateScore, createOpportunity, getOpportunity, addManualEvent, extractContacts, saveContacts, getOpportunityContacts, getContactsExportUrl, enrichContactApi, listSowProfiles, getSowProfile, generateSoW, enrichDealRisk, enrichDiscoveryQuestions, enrichProductFit, generateRichBriefing, generateEmails, generatePostDemo, generateSolutionBreakdown, generateProposalEmail, generateProposalDocument, getValueDriverLibrary, getOperationalMetricsLibrary, suggestValueDrivers } from './api.js'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  ShadingType,
  PageBreak,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  LevelFormat,
} from 'docx'
import { saveAs } from 'file-saver'

const NAVY = '#0B1F3A'
const NAVY_LIGHT = '#EAF1F8'
const MUTED = '#64748b'
const BORDER = '#e2e8f0'
const SOFT = '#fcfdff'
const GREEN = '#15803d'
const AMBER = '#b45309'
const RED = '#b91c1c'

// ── Style constants ──

const S = {
  page: {
    minHeight: '100vh',
    background: '#f4f7fb',
    padding: '30px',
    fontFamily: 'Inter, Arial, sans-serif',
    color: '#0f172a',
  },
  shell: {
    maxWidth: '1160px',
    margin: '0 auto',
  },
  card: {
    background: '#fff',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '16px',
    border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    fontSize: '14px',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    resize: 'vertical',
  },
  textareaLarge: {
    width: '100%',
    minHeight: '200px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    fontSize: '14px',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    resize: 'vertical',
  },
  button: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  secondaryButton: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  uploadBox: {
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px dashed #94a3b8',
    background: '#fff',
    cursor: 'pointer',
    color: '#334155',
    fontSize: '14px',
  },
  fileList: {
    marginTop: 10,
    fontSize: '13px',
    color: '#334155',
    lineHeight: 1.7,
  },
  helper: {
    marginTop: 8,
    fontSize: '12px',
    color: MUTED,
  },
  status: {
    marginBottom: 12,
    fontSize: '13px',
    fontWeight: 600,
    color: NAVY,
  },
  error: {
    marginBottom: 12,
    fontSize: '13px',
    color: '#b91c1c',
    whiteSpace: 'pre-wrap',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    gap: '16px',
    marginBottom: '16px',
  },
  twinGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px',
  },
  tripleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '16px',
    marginBottom: '16px',
  },
  summaryCard: {
    background: '#fff',
    padding: '20px',
    borderRadius: '12px',
    border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
  },
  sectionHeaderBar: {
    background: NAVY_LIGHT,
    color: NAVY,
    padding: '10px 12px',
    borderRadius: '10px',
    fontWeight: 700,
    marginBottom: '12px',
    fontSize: '15px',
  },
  scoreBadge: {
    display: 'inline-block',
    background: NAVY,
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '14px',
    marginBottom: '10px',
  },
  scoreBig: {
    fontSize: '38px',
    fontWeight: 800,
    lineHeight: 1,
    marginBottom: '8px',
  },
  scoreLabel: {
    fontSize: '13px',
    color: MUTED,
    marginBottom: '10px',
  },
  bodyText: {
    fontSize: '14px',
    lineHeight: 1.6,
  },
  outputCardTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 10,
  },
  outputWrap: {
    border: `1px solid ${BORDER}`,
    borderRadius: '12px',
    background: SOFT,
    padding: '18px',
  },
  fitPill: (level) => {
    const isStrong = level === 'Very Strong' || level === 'Strong'
    const isModerate = level === 'Moderate'
    return {
      display: 'inline-block',
      background: isStrong ? '#dcfce7' : isModerate ? '#fef9c3' : '#fee2e2',
      color: isStrong ? GREEN : isModerate ? AMBER : RED,
      padding: '3px 10px',
      borderRadius: '999px',
      fontWeight: 700,
      fontSize: '13px',
      marginBottom: '8px',
    }
  },
  scoreBarTrack: {
    height: '6px',
    background: '#e2e8f0',
    borderRadius: '999px',
    overflow: 'hidden',
    marginBottom: '14px',
  },
  scoreBarFill: (score) => ({
    height: '100%',
    width: `${Math.min(100, Math.max(0, score))}%`,
    background: score >= 70 ? GREEN : score >= 50 ? AMBER : RED,
    borderRadius: '999px',
    transition: 'width 0.6s ease',
  }),
  // Post-discovery specific
  changeTag: (type) => {
    const styles = {
      confirmed: { background: '#dcfce7', color: GREEN },
      disproven: { background: '#fee2e2', color: RED },
      assumed: { background: '#fef9c3', color: AMBER },
    }
    const s = styles[type] || styles.assumed
    return {
      display: 'inline-block',
      ...s,
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginRight: 6,
      flexShrink: 0,
    }
  },
}

// ── Data helpers ──

// Single source of truth extractor — pull the eight authoritative dashboard
// fields out of a dashboard object. Used by both UI rendering and DOCX export
// so the score and statuses are consistent everywhere.
function getDashboardTruth(dash) {
  if (!dash) return null
  return {
    prospectMatchScore: typeof dash.prospect_match_score === 'number' ? dash.prospect_match_score : null,
    scoreDirection: dash.score_direction || '',
    useCaseFit: dash.logicgate_use_case_fit_level || '',
    useCaseFitReason: dash.logicgate_use_case_fit_reason || '',
    implementationScope: dash.implementation_scope_and_vision || '',
    implementationScopeReason: dash.implementation_scope_reason || '',
    competitionStatus: dash.competition_status || '',
    competitionDetail: dash.competition_detail || '',
    budgetStatus: dash.budget_status || '',
    budgetDetail: dash.budget_detail || '',
    executiveSponsors: dash.executive_sponsors || '',
    executiveSponsorDetail: dash.executive_sponsor_detail || '',
    compellingEvent: dash.compelling_event || '',
    compellingEventDetail: dash.compelling_event_detail || '',
    nextSteps: dash.next_steps || '',
  }
}

// Has a usable dashboard been generated? Used to gate UI behaviour like
// "open scorecard with current values" vs. "no data to show".
function hasCurrentDashboard(dash) {
  return Boolean(dash && typeof dash.prospect_match_score === 'number')
}

// Score for display — always read from the dashboard if present.
// Never recalculate, never adjust client-side.
function getDashboardScore(dash) {
  if (!hasCurrentDashboard(dash)) return null
  return dash.prospect_match_score
}

function clean(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')
    .trim()
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((v) => clean(v)) : []
}

function removeBulletPrefix(text) {
  return clean(text).replace(/^[-•●]\s*/, '')
}

// ── Weak-value filter ──

const WEAK_VALUE_PATTERNS = [
  'needs validation',
  'not available',
  'no rationale available.',
  'no rationale available',
  'prep text was produced but structured extraction was incomplete.',
  'prep text was produced but structured extraction was incomplete',
  'briefing generated but structured extraction was incomplete. use the text output as primary source.',
  'briefing generated but structured extraction was incomplete',
  'rich-text briefing was generated successfully.',
  'json extraction failed — use the full text output as primary source.',
  'json extraction failed - use the full text output as primary source.',
  'core analysis is available in narrative form.',
  'the underlying prep text was generated successfully.',
  'structured extraction failed.',
  'manual review of the detailed briefing is recommended.',
  'qualify carefully before over-investing.',
  'use the detailed prep text to guide next steps.',
  'executive sponsor not confirmed',
  'use the next call to clarify who owns the business outcome and approval path',
  'focus on primary use case confirmation.',
  'avoid broad feature touring.',
  'validate ownership and success criteria early.',
]

const WEAK_SUBSTRING_PATTERNS = [
  'rich-text briefing was generated',
  'json extraction failed',
  'structured extraction',
  'structured conversion',
  'use the text output as',
  'use the full text output',
  'prep text was produced but',
  'briefing generated but structured',
  'underlying prep text was',
  'follow-up run can still be used',
  'core analysis is available in narrative',
  'some summary fields may be',
  'primary source for this run',
]

function isWeakText(value) {
  const text = clean(value).toLowerCase()
  if (!text) return true
  if (WEAK_VALUE_PATTERNS.some((p) => text === p || text.startsWith(p))) return true
  if (WEAK_SUBSTRING_PATTERNS.some((p) => text.includes(p))) return true
  return false
}

function isWeakBulletList(items) {
  const arr = ensureArray(items)
  if (!arr.length) return true
  return arr.every((item) => isWeakText(item) || item.length < 12)
}

// ── Score stabilisation ──

const SCORE_BOOST_SIGNALS = [
  { pattern: /\b(erm|enterprise risk management)\b/i, boost: 6 },
  { pattern: /\b(bcp|business continuity)\b/i, boost: 5 },
  { pattern: /\btprm\b/i, boost: 5 },
  { pattern: /\b(internal audit|audit management)\b/i, boost: 5 },
  { pattern: /\b(policy management)\b/i, boost: 4 },
  { pattern: /\b(controls|control framework|control testing)\b/i, boost: 4 },
  { pattern: /\b(platform|connected workflows?|workflow automation|end.to.end)\b/i, boost: 6 },
  { pattern: /\b(holistic|enterprise.wide|group.wide|organisation.wide|cross.functional)\b/i, boost: 5 },
  { pattern: /\bgartner\b/i, boost: 8 },
  { pattern: /\b(forrester|grc magic quadrant)\b/i, boost: 5 },
  { pattern: /\b(regulatory|compliance deadline|audit finding|board mandate|regulatory action)\b/i, boost: 4 },
  { pattern: /\b(dora|sox|iso 27001|nist|gdpr|fca|pra)\b/i, boost: 4 },
]

const SCORE_SUPPRESS_SIGNALS = [
  { pattern: /\b(narrow use case|single use case|point solution only)\b/i, suppress: 10 },
  { pattern: /\b(disqualif|walk away|no budget|no champion)\b/i, suppress: 15 },
  { pattern: /\b(deprioritis|low priority|not a fit)\b/i, suppress: 8 },
]

function stabiliseScore(rawScore, prepText, structuredFitLevel) {
  let score = typeof rawScore === 'number' && rawScore >= 0 && rawScore <= 100 ? rawScore : null

  const text = clean(prepText).toLowerCase()

  let textBoost = 0
  let textSuppress = 0

  SCORE_BOOST_SIGNALS.forEach(({ pattern, boost }) => {
    if (pattern.test(text)) textBoost += boost
  })
  SCORE_SUPPRESS_SIGNALS.forEach(({ pattern, suppress }) => {
    if (pattern.test(text)) textSuppress += suppress
  })

  textBoost = Math.min(textBoost, 25)
  textSuppress = Math.min(textSuppress, 30)

  if (score === null) {
    score = 50 + textBoost - textSuppress
  } else {
    score = score - textSuppress
    if (score < 30 && textBoost > 10) {
      score = score + Math.round(textBoost * 0.6)
    }
  }

  if (structuredFitLevel) {
    const fl = structuredFitLevel.toLowerCase()
    if (fl.includes('very strong') || fl.includes('excellent')) score = Math.max(score, 75)
    else if (fl.includes('strong')) score = Math.max(score, 65)
    else if (fl.includes('moderate')) score = Math.max(score, 45)
    else if (fl.includes('weak')) score = Math.min(score, 48)
    else if (fl.includes('poor')) score = Math.min(score, 30)
  }

  const useCaseCount = [
    /\berm\b/i, /\btprm\b/i, /\bbcp\b/i, /\bpolicy\b/i,
    /\baudit\b/i, /\bcontrols?\b/i, /\brisk register\b/i,
  ].filter((p) => p.test(text)).length

  if (useCaseCount >= 3) score = Math.max(score, 60)
  if (useCaseCount >= 5) score = Math.max(score, 68)

  if (textSuppress < 15) score = Math.max(score, 20)
  score = Math.min(score, 95)

  return Math.round(score)
}

// ── Text parsing utilities ──

function parseSections(text) {
  const lines = clean(text).split('\n')
  const sections = []
  let current = null

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      if (current) current.content.push({ type: 'blank', text: '' })
      continue
    }

    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { title: line.replace(/^##\s+/, ''), content: [] }
      continue
    }

    if (!current) continue

    if (line.startsWith('### ')) {
      current.content.push({ type: 'subheading', text: line.replace(/^###\s+/, '') })
      continue
    }

    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('● ')) {
      current.content.push({ type: 'bullet', text: removeBulletPrefix(line) })
      continue
    }

    current.content.push({ type: 'paragraph', text: line })
  }

  if (current) sections.push(current)
  return sections
}

function sectionMapFromText(text) {
  const map = new Map()
  parseSections(text).forEach((section) => map.set(section.title, section))
  return map
}

function getSectionBullets(sectionMap, title) {
  const section = sectionMap.get(title)
  if (!section) return []
  return section.content
    .filter((item) => item.type === 'bullet')
    .map((item) => removeBulletPrefix(item.text))
    .filter(Boolean)
}

function getFieldValueFromSection(sectionMap, title, label) {
  const section = sectionMap.get(title)
  if (!section) return ''
  const prefix = `${label.toLowerCase()}:`
  for (const item of section.content) {
    const text = clean(item.text)
    if (text.toLowerCase().startsWith(prefix)) {
      return text.slice(text.indexOf(':') + 1).trim()
    }
  }
  return ''
}

function bestValue(structuredVal, textVal, fallback = '') {
  const sv = clean(structuredVal)
  if (sv && sv.length > 5 && !isWeakText(sv)) return sv
  const tv = clean(textVal)
  if (tv && tv.length > 5 && !isWeakText(tv)) return tv
  return fallback
}

function parseSection(prepText, sectionTitle) {
  if (!prepText) return []
  const map = sectionMapFromText(prepText)
  return getSectionBullets(map, sectionTitle)
}

function bestArray(structuredArr, textArr) {
  const sArr = ensureArray(structuredArr).filter((v) => !isWeakText(v) && v.length > 15)
  const tArr = ensureArray(textArr).filter((v) => !isWeakText(v) && v.length > 15)
  if (tArr.length > 0) return tArr
  if (sArr.length > 0) return sArr
  return []
}

function getSponsorStrategyFromText(sectionMap) {
  const section = sectionMap.get('Sponsor Strategy')
  if (!section) return { likelySponsor: '', missingPeople: [], howToBringThemIn: [] }

  let likelySponsor = ''
  const missingPeople = []
  const howToBringThemIn = []
  let activeBucket = ''

  for (const item of section.content) {
    if (item.type === 'paragraph' || item.type === 'bullet') {
      const text = clean(item.text)
      if (text.toLowerCase().startsWith('likely sponsor:')) {
        likelySponsor = text.slice(text.indexOf(':') + 1).trim()
      }
    }
    if (item.type === 'subheading') {
      if (item.text.toLowerCase().includes('missing')) activeBucket = 'missing'
      else if (item.text.toLowerCase().includes('bring')) activeBucket = 'bringin'
      else activeBucket = ''
      continue
    }
    if (item.type === 'bullet') {
      const bulletText = removeBulletPrefix(item.text)
      if (activeBucket === 'missing') missingPeople.push(bulletText)
      if (activeBucket === 'bringin') howToBringThemIn.push(bulletText)
    }
  }

  return { likelySponsor, missingPeople, howToBringThemIn }
}

function getDiscoveryNarrativeFromText(sectionMap) {
  const section = sectionMap.get('Discovery Call Narrative')
  if (!section) return []

  const steps = []
  let current = null

  for (const item of section.content) {
    if (item.type === 'subheading') {
      if (current) steps.push(current)
      current = { step: item.text, purpose: '', questions: [] }
      continue
    }
    if (!current) continue
    if (item.type === 'bullet') {
      const text = removeBulletPrefix(item.text)
      if (text.toLowerCase().startsWith('purpose:')) {
        current.purpose = text.slice(text.indexOf(':') + 1).trim()
      } else if (text.toLowerCase().startsWith('questions:')) {
        const rest = text.slice(text.indexOf(':') + 1).trim()
        if (rest) current.questions.push(rest)
      } else {
        current.questions.push(text)
      }
    }
    if (item.type === 'paragraph') {
      const text = clean(item.text)
      if (text.toLowerCase().startsWith('purpose:')) {
        current.purpose = text.slice(text.indexOf(':') + 1).trim()
      }
    }
  }

  if (current) steps.push(current)
  return steps
}

function resolveNarrative(narrativeFromText, structuredNarrative) {
  const textSteps = Array.isArray(narrativeFromText) ? narrativeFromText.filter((s) => s.step) : []
  const structuredSteps = Array.isArray(structuredNarrative) ? structuredNarrative.filter((s) => s.step) : []
  if (textSteps.length >= 3) return textSteps
  if (structuredSteps.length > textSteps.length) return structuredSteps
  return textSteps.length > 0 ? textSteps : structuredSteps
}

// ── Rendering utilities ──

function bulletRow(item, idx) {
  return (
    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, lineHeight: 1.55 }}>
      <span style={{ color: NAVY, flexShrink: 0 }}>•</span>
      <span>{removeBulletPrefix(item)}</span>
    </div>
  )
}

function renderBullets(items, emptyText = 'No content.') {
  const list = ensureArray(items).filter((item) => !isWeakText(item) && item.length > 4)
  if (!list.length) return <div style={{ color: MUTED, fontSize: '13px' }}>{emptyText}</div>
  return list.map((item, idx) => bulletRow(item, idx))
}

function renderDetailedSections(resultText) {
  const sections = parseSections(resultText)
  if (!sections.length) return <div style={{ color: MUTED }}>No detailed briefing returned.</div>

  return sections.map((section, idx) => (
    <div key={`${section.title}-${idx}`} style={{ marginBottom: 30 }}>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: NAVY,
        marginBottom: 12,
        paddingBottom: 6,
        borderBottom: `2px solid ${NAVY_LIGHT}`,
      }}>
        {section.title}
      </div>
      {section.content.map((item, itemIdx) => {
        if (item.type === 'blank') return <div key={itemIdx} style={{ height: 8 }} />
        if (item.type === 'subheading') {
          return (
            <div key={itemIdx} style={{
              fontWeight: 700,
              color: '#334155',
              marginTop: 14,
              marginBottom: 8,
              fontSize: 14,
              borderLeft: '3px solid #CBD5E1',
              paddingLeft: 8,
            }}>
              {item.text}
            </div>
          )
        }
        if (item.type === 'bullet') return bulletRow(item.text, itemIdx)
        return <div key={itemIdx} style={{ marginBottom: 8, lineHeight: 1.6 }}>{item.text}</div>
      })}
    </div>
  ))
}

// ── Score display helpers ──

function scoreColour(score) {
  if (score >= 70) return GREEN
  if (score >= 50) return AMBER
  return RED
}

function DimensionRow({ label, value }) {
  if (!value || isWeakText(value)) return null
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '13px', lineHeight: 1.5 }}>
      <span style={{ color: MUTED, minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#0f172a' }}>{value}</span>
    </div>
  )
}

// ── Scorecard panel component ──
// Renders a compact deal scorecard from the /generate-scorecard response.

function ScorecardPanel({ scorecard, onDismiss }) {
  if (!scorecard) return null

  const { scorecard: dims, weighting, overall_score, fit_level, stance, score_rationale, stage } = scorecard

  const stageLabel = stage === 'pre_discovery' ? 'Pre-Discovery' : stage === 'post_discovery' ? 'Post-Discovery' : 'Execution'

  const dimColour = (score) => {
    if (score >= 70) return GREEN
    if (score >= 45) return AMBER
    return RED
  }

  const dimBg = (score) => {
    if (score >= 70) return '#dcfce7'
    if (score >= 45) return '#fef9c3'
    return '#fee2e2'
  }

  const DIM_LABELS = {
    product_fit: 'Product Fit',
    commercial_fit: 'Commercial Fit',
    deal_maturity: 'Deal Maturity',
    icp_fit: 'ICP Fit',
  }

  const numScore = typeof overall_score === 'number' ? overall_score : 0
  const scoreHexCol = numScore >= 70 ? GREEN : numScore >= 45 ? AMBER : RED

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      background: '#fff',
      padding: '20px',
      marginBottom: 16,
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {stageLabel} · Deal Scorecard
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: scoreHexCol, lineHeight: 1 }}>{numScore}%</span>
            {fit_level && <span style={{ ...S.fitPill(fit_level) }}>{fit_level}</span>}
            {stance && !isWeakText(stance) && (
              <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{stance}</span>
            )}
          </div>
          {score_rationale && !isWeakText(score_rationale) && (
            <div style={{ fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 1.5, maxWidth: 620 }}>{score_rationale}</div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 18, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
            title="Dismiss scorecard"
          >
            ×
          </button>
        )}
      </div>

      {/* Score bar */}
      <div style={{ ...S.scoreBarTrack, marginBottom: 16 }}>
        <div style={S.scoreBarFill(numScore)} />
      </div>

      {/* Dimension grid */}
      {dims && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Object.entries(DIM_LABELS).map(([key, label]) => {
            const dim = dims[key]
            if (!dim) return null
            const pct = Math.max(0, Math.min(100, dim.score))
            const w = weighting?.[key] ? `${Math.round(weighting[key] * 100)}%` : ''
            return (
              <div key={key} style={{
                background: '#f8fafc',
                borderRadius: 8,
                padding: '12px 14px',
                border: `1px solid ${BORDER}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {w && <span style={{ fontSize: 11, color: MUTED }}>{w} weight</span>}
                    <span style={{
                      background: dimBg(pct),
                      color: dimColour(pct),
                      fontWeight: 700,
                      fontSize: 13,
                      padding: '1px 8px',
                      borderRadius: 999,
                    }}>{pct}</span>
                  </div>
                </div>
                {/* Mini bar */}
                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: dimColour(pct), borderRadius: 999 }} />
                </div>
                {dim.reason && !isWeakText(dim.reason) && (
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{dim.reason}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Delta score widget ──
// Inline widget that appears below a scorecard to update the score
// based on new information without re-running the full generation.

function DeltaScoreWidget({ currentScore, stage, notes, onNotesChange, onUpdate, loading, result }) {
  const delta = result?.delta
  const newScore = result?.deal_score

  const deltaColour = delta == null ? MUTED : delta > 0 ? GREEN : delta < 0 ? RED : MUTED
  const deltaLabel = delta == null ? '' : delta > 0 ? `+${delta}` : `${delta}`

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      background: '#f8fafc',
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Update Score · Based on New Information
      </div>

      {/* Score display: current → delta → new */}
      {result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>Previous</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: MUTED }}>{currentScore}%</div>
          </div>
          <div style={{ fontSize: 20, color: MUTED }}>→</div>
          {delta !== 0 && (
            <>
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: deltaColour,
                background: delta > 0 ? '#dcfce7' : delta < 0 ? '#fee2e2' : '#f1f5f9',
                padding: '4px 10px',
                borderRadius: 999,
              }}>
                {deltaLabel}
              </div>
              <div style={{ fontSize: 20, color: MUTED }}>→</div>
            </>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>Updated</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: newScore >= 70 ? GREEN : newScore >= 45 ? AMBER : RED }}>
              {newScore}%
            </div>
          </div>
          {delta === 0 && (
            <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No meaningful movement from new information.</div>
          )}
        </div>
      )}

      <textarea
        style={{
          ...{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            boxSizing: 'border-box',
            fontSize: '14px',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            resize: 'vertical',
            minHeight: '80px',
            background: '#fff',
          }
        }}
        placeholder="Paste new notes, signals, or transcript snippets that affect this deal…"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
      />
      <div style={{ marginTop: 8 }}>
        <button
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: 'none',
            background: !notes.trim() || loading ? '#94a3b8' : NAVY,
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            fontFamily: 'inherit',
            cursor: !notes.trim() || loading ? 'not-allowed' : 'pointer',
          }}
          disabled={!notes.trim() || loading}
          onClick={onUpdate}
        >
          {loading ? 'Updating…' : 'Update Score'}
        </button>
      </div>
    </div>
  )
}

// ── Deal Intelligence Panel ──

function DealIntelligencePanel({ structured }) {
  if (!structured) return null

  const { deal_risks, momentum, go_no_go, next_move, effort_vs_value, win_strategy } = structured

  const hasRisks = Array.isArray(deal_risks) && deal_risks.length > 0
  const hasGoNoGo = go_no_go?.decision && !isWeakText(go_no_go.decision)
  const hasNextMove = next_move?.action && !isWeakText(next_move.action)
  const hasWinStrategy = (win_strategy?.how_we_win && !isWeakText(win_strategy.how_we_win)) ||
                         (win_strategy?.how_we_lose && !isWeakText(win_strategy.how_we_lose))
  const hasEffort = effort_vs_value?.effort || effort_vs_value?.value
  const hasMomentum = momentum && !isWeakText(momentum)

  if (!hasRisks && !hasGoNoGo && !hasNextMove && !hasWinStrategy && !hasEffort && !hasMomentum) return null

  const riskSevColour = (s) => ({ high: RED, medium: AMBER }[s?.toLowerCase()] || MUTED)
  const riskSevBg = (s) => ({ high: '#fee2e2', medium: '#fef9c3' }[s?.toLowerCase()] || '#f1f5f9')
  const riskStatusColour = (s) => ({ resolved: GREEN, ongoing: AMBER }[s?.toLowerCase()] || '#334155')
  const riskStatusBg = (s) => ({ resolved: '#dcfce7', ongoing: '#fef9c3' }[s?.toLowerCase()] || '#f1f5f9')
  const momColour = () => ({ increasing: GREEN, declining: RED }[momentum?.toLowerCase()] || MUTED)
  const momBg = () => ({ increasing: '#dcfce7', declining: '#fee2e2' }[momentum?.toLowerCase()] || '#f1f5f9')
  const momArrow = () => ({ increasing: '↑', declining: '↓' }[momentum?.toLowerCase()] || '→')
  const gnColour = () => ({ go: GREEN, 'no-go': RED }[go_no_go?.decision?.toLowerCase()] || AMBER)
  const gnBg = () => ({ go: '#dcfce7', 'no-go': '#fee2e2' }[go_no_go?.decision?.toLowerCase()] || '#fef9c3')
  const effortColour = (l) => ({ high: RED, low: GREEN }[l?.toLowerCase()] || AMBER)
  const valueColour = (l) => ({ high: GREEN, low: RED }[l?.toLowerCase()] || AMBER)

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Top row: Momentum · Go/No-Go · Effort vs Value */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {hasMomentum && (
          <div style={{ background: momBg(), borderRadius: 8, padding: '10px 14px', border: `1px solid ${BORDER}`, flex: '0 1 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Momentum</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: momColour() }}>{momArrow()} {momentum}</div>
          </div>
        )}
        {hasGoNoGo && (
          <div style={{ background: gnBg(), borderRadius: 8, padding: '10px 14px', border: `1px solid ${BORDER}`, flex: '1 1 220px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Go / No-Go</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: gnColour(), marginBottom: go_no_go?.reason ? 4 : 0 }}>{go_no_go.decision}</div>
            {go_no_go?.reason && !isWeakText(go_no_go.reason) && (
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>{go_no_go.reason}</div>
            )}
          </div>
        )}
        {hasEffort && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: `1px solid ${BORDER}`, flex: '0 1 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Effort vs Value</div>
            <div style={{ display: 'flex', gap: 14 }}>
              {effort_vs_value?.effort && (
                <div>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 1 }}>Effort</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: effortColour(effort_vs_value.effort) }}>{effort_vs_value.effort}</div>
                </div>
              )}
              {effort_vs_value?.value && (
                <div>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 1 }}>Value</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: valueColour(effort_vs_value.value) }}>{effort_vs_value.value}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Next Move */}
      {hasNextMove && (
        <div style={{ background: NAVY_LIGHT, borderRadius: 8, padding: '12px 14px', border: `1px solid ${BORDER}`, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Next Move</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 3 }}>Action</div>
              <div style={{ fontSize: 14, color: NAVY, fontWeight: 600 }}>{next_move.action}</div>
            </div>
            {next_move?.constraint && !isWeakText(next_move.constraint) && (
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginBottom: 3 }}>Constraint</div>
                <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>{next_move.constraint}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deal Risks */}
      {hasRisks && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: `1px solid ${BORDER}`, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Deal Risks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {deal_risks.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ background: riskSevBg(r.severity), color: riskSevColour(r.severity), fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 1, textTransform: 'uppercase' }}>{r.severity || 'Medium'}</span>
                <span style={{ background: riskStatusBg(r.status), color: riskStatusColour(r.status), fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 1, textTransform: 'uppercase' }}>{r.status || 'New'}</span>
                <span style={{ color: '#1e293b' }}>{r.risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Win Strategy */}
      {hasWinStrategy && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Win Strategy</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {win_strategy?.how_we_win && !isWeakText(win_strategy.how_we_win) && (
              <div style={{ flex: '1 1 160px' }}>
                <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, marginBottom: 3 }}>How we win</div>
                <div style={{ fontSize: 13, color: '#14532d', lineHeight: 1.5 }}>{win_strategy.how_we_win}</div>
              </div>
            )}
            {win_strategy?.how_we_lose && !isWeakText(win_strategy.how_we_lose) && (
              <div style={{ flex: '1 1 160px' }}>
                <div style={{ fontSize: 11, color: RED, fontWeight: 700, marginBottom: 3 }}>How we lose</div>
                <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>{win_strategy.how_we_lose}</div>
              </div>
            )}
            {win_strategy?.biggest_risk_competitor && !isWeakText(win_strategy.biggest_risk_competitor) && (
              <div style={{ flex: '1 1 160px' }}>
                <div style={{ fontSize: 11, color: AMBER, fontWeight: 700, marginBottom: 3 }}>Biggest competitor risk</div>
                <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{win_strategy.biggest_risk_competitor}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

async function loadLogo() {
  const res = await fetch(logo)
  const blob = await res.blob()
  const arrayBuffer = await blob.arrayBuffer()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const dimensions = await new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = reject
      img.src = objectUrl
    })
    return { buffer: arrayBuffer, width: dimensions.width, height: dimensions.height }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function headerBar(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 300, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: '0B1F3A', color: 'auto' },
    children: [
      new TextRun({ text: '  ' }),
      new TextRun({ text: clean(text), bold: true, color: 'FFFFFF', font: 'Calibri', size: 24 }),
    ],
  })
}

function subSectionBar(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 180, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: 'EAF1F8', color: 'auto' },
    children: [
      new TextRun({ text: '  ' }),
      new TextRun({ text: clean(text), bold: true, color: '0B1F3A', font: 'Calibri', size: 22 }),
    ],
  })
}

function dividerParagraph() {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    children: [new TextRun({ text: '', font: 'Calibri', size: 4 })],
    border: { bottom: { style: 'single', size: 4, color: 'E2E8F0', space: 1 } },
  })
}

function bodyParagraph(text) {
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    indent: { left: 120 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}

function labelValueParagraph(label, value) {
  if (!value || isWeakText(value)) return null
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    indent: { left: 120 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
      new TextRun({ text: clean(value), font: 'Calibri', size: 22, color: '1E293B' }),
    ],
  })
}

function bulletParagraph(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70, line: 260 },
    indent: { left: 360, hanging: 240 },
    children: [new TextRun({ text: removeBulletPrefix(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}

function subheadingParagraph(text) {
  return new Paragraph({
    spacing: { before: 120, after: 60 },
    indent: { left: 120 },
    children: [new TextRun({ text: clean(text), bold: true, color: '334155', font: 'Calibri', size: 22 })],
  })
}

function spacerParagraph() {
  return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 60, after: 60 } })
}

function addBulletSection(children, title, bullets = []) {
  const safeBullets = ensureArray(bullets).filter((b) => !isWeakText(b) && b.length > 4)
  if (!safeBullets.length) return
  children.push(headerBar(title))
  safeBullets.forEach((b) => children.push(bulletParagraph(b)))
  children.push(dividerParagraph())
}

function addNarrativeSection(children, narrative) {
  const steps = Array.isArray(narrative) ? narrative.filter((s) => s && s.step) : []
  if (!steps.length) return

  children.push(headerBar('Discovery Call Narrative'))
  children.push(spacerParagraph())

  steps.forEach((step, idx) => {
    children.push(
      new Paragraph({
        spacing: { before: idx === 0 ? 80 : 160, after: 80 },
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC', color: 'auto' },
        children: [
          new TextRun({ text: '  ' }),
          new TextRun({ text: clean(step.step), bold: true, color: '0B1F3A', font: 'Calibri', size: 22 }),
        ],
      })
    )
    if (step.purpose && !isWeakText(step.purpose)) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 240 },
          children: [
            new TextRun({ text: 'Purpose: ', italics: true, color: '64748B', font: 'Calibri', size: 20 }),
            new TextRun({ text: clean(step.purpose), italics: true, color: '64748B', font: 'Calibri', size: 20 }),
          ],
        })
      )
    }
    ensureArray(step.questions)
      .filter((q) => !isWeakText(q) && q.length > 4)
      .forEach((q) => children.push(bulletParagraph(q)))
  })

  children.push(dividerParagraph())
}

function addDetailedSectionsFromText(children, resultText, skipSet) {
  const sections = parseSections(resultText)
  const skipTitles = skipSet || new Set([
    'Executive Summary',
    'Deal Snapshot',
    'Top 3 Deal Risks',
    'Top 3 Reasons This Could Win',
    'Demo Focus Recommendations',
    'Commercial Recommendation',
    'AE Recommendation',
    'Sponsor Strategy',
    'Discovery Call Narrative',
  ])

  sections.forEach((section) => {
    if (skipTitles.has(section.title)) return
    children.push(headerBar(section.title))
    section.content.forEach((item) => {
      if (item.type === 'subheading') children.push(subheadingParagraph(item.text))
      else if (item.type === 'bullet') children.push(bulletParagraph(item.text))
      else if (item.type === 'paragraph') children.push(bodyParagraph(item.text))
      else if (item.type === 'blank') children.push(spacerParagraph())
    })
    children.push(dividerParagraph())
  })
}

// ── Rich briefing markdown → DOCX ──
// Layout matches the Risk Rising document template: header with right-aligned
// logo and navy bottom-border line, footer with company line and navy
// top-border line, numbered H1 sections with navy underline, navy table
// header rows with white text, alternating row shading, Arial throughout.
// The dashboard remains the single source of truth — this layer only renders
// briefing markdown into a branded .docx matching the company's existing
// document standard.

// Brand constants drawn directly from the RR template XML
const RR_NAVY = '3333A3'         // primary brand colour
const RR_TEXT = '1F2937'         // body text
const RR_MUTED = '6B7280'        // subtitle / metadata
const RR_BORDER = 'D1D5DB'       // table cell borders
const RR_TABLE_ALT = 'F4F5FB'    // alternating row shading

// Risk Rising logo (downscaled PNG) embedded as base64 so .docx generation
// is self-contained — no dependency on the Vite asset path resolving.
// Source: extracted from the canonical RR template, resized to 158×80.
const RR_LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAJ4AAABQCAYAAADoZ8y/AAAfqklEQVR42u19eXhb1Zn37z3nXEmW5diJHSeExayJLYMTx1CgpShtocuUlmmpwrTAx9CPNlMKZSskhRZZlHUoFLowQCldHrpFnWdahmmZdigRM88zbI5DguWEptAESIgTsnqRdM857/fHvbLlxHEkO/QjMucf2/LVcn/6vct5z7tQW8sddwTVzKXGZA2zhpDOABj+YjAYYO8BArMQwV3s/QOgwmXs/c4oenA/ixjDzy1+DdBefwMEkLa5WvJ+LXpC4REaubLoWd4rMQAesODtBHqFYDPWmOdcveP5NeuTrxeujseXy1Sqh4GkHe9TAwnqODZbw6HZv1Oq/r15d6dLRBAkh0YuYzAzCMwMEEEMkVBZ/1/evaP4vv17HndxEc7j4wU2Acum2nt/8v5T+DEKpxEsCfCvZQ1gF0BbAF4vSK+yNv/sEF5Zlcnc3194i1gsodLpTjNyMxNbBAAdrfder1T9nda6YDYgyNE3vNcXOyY44/5/vOvHew4f4DVoWChG8Cz6lkiAiAAIEAjMGpbz2wH7PCP3G+vueKx7XXLTCAHjdv+AMgHEzc3L6iOq6edKTf+wq/cYIpI0igRUwr2Vg1epWO19bbF0Fz+PRxOW/WvIE2giAYIAwDA2B7D5qyX3aYK7fFf2D/+1fv0TuRG8FpsJEy+O5TKFxWb+vG9eEggc9gDBCRib1URCjXzqSZH7bVr7qMy9wB/+P3taG0wEQaRIiAAAgjEDOwE3ZfJ93+t+Obn6wIB65AMgOlrve8RRMy/WZtAwWyIiMfKtvtNwwlgqc3/EZvbUNggkBTkQwgGzgbGDLzMP/jC/54UfrNn48x0eHp10AGux/0/lqc+knj83+b5AoPHnUtYe5eoBTcRyWFdXzGJmhgUAIZSUIghjBl3LQz+y+rVk97q7Nvnks2NLXEIAnQwQt0fvXqpk3R0ECWPzmogUKm9Zj4hEkgJCCAfG9G+0duC2rszVDwHgAn8mJA6FJ0ebLpsdjrQ+oFTducZkYVkbIiFRkYuZGYZIKCXD0HbgTW12LluVue4nIyQbU5opkWBKJsm2t9z5ISnrfqhkTZOrBwx5jqeoTLxgmdkKEVBCODB61//k9KbL1qy7ZU25pneUNiuYXQDoOPHurxCm3S5lVVjrQUMFZwkVS0EthKOEcODqHY/07frZ5a+//sxQHHGZQmpMQAvC2nbsPzU64dbvKFl7vrUW1uY1ESrQWowWWCXDytqhAW22faW792uPjG8pDuipcmHbaOe3XN+qZNPdSk77CFvjm5NKB5SMoyJKmx3P7nF7Pr1u3fc3jUe+YmGdH73tAkfU36pkTZM2g2A2hkiIEndchyBa1gihpBABuPqtO1f2XLUsARZJzw/mMok3WpoBoL3lroukrLlJymnHW5uDtVqTt/WpTA3IcKUKO9b0r9Nm40e6e2/dAMQl9kM+gCkBUBJkTzrqS9MDNc03EoW/rGQ4pM0QmG0FCywzQxhHVat8fvMjKzPX/N9SNN8BgBhxpOfN+2RNRH3wS0RVV0gZOYJZw9i8BTN7JKwsUJlZKxlWxva/nMWGM1966fYt4/h82HtHvCCaiErRsEwg9A9CVjvWZmGt0SAWVIhdVBRg5DpOxMnmX/9hd+arl/qKy+yPfCXdfDGg8+dfWafc4y4hEfiCEFUtRAq+FjQA+SRkqgQiMrNWqlq5eudzfbtWLDr99Hh+/FifH6KKLxcFvNrnJtqk03AZRCCuRGSGZQtrc2BmDTBVlO/M5Con7ORyryW7e5d2jrfbLYccowCNRqOBIF36EUGhCwjqLClD9YAEs4G1LgBrvbDFPtHKtyVENXK6Ufw+hElrFoarnIiTz29+dGXmmotKDx0kRDzeSsMEnHfdHOEcdR5YfY5IvkfJasEAvKC9BrMd4zTgIOJFe/9ZUAzF7zFZZeGZXSWUyuc2ndu97obHin3giRJvGIxYrFMWg9/Wdm2jsocvIgTOBsTpgDhOilBIkIPi6Dkf4Bve96Pxfi7jMZ7l+7MMeGE6C2YGwxpwQRNPULMwuVKFnHz+tYu6e7/2aHmhg9EEBICT5t18kqOmfZBIfYjgzAfoKClCKIQBeUyk9jkfmyRedpgqgAU8rJgZxtPEE3Wf2BI5ZDm7Y0CvO3Ht2tot3uOjXZTJMJzi8eUCAPb6Eqi95ZtHsayaK6yYSySPIKYGCBXQJl8HGD8mKEZ9BBp1jwJi2AKRf4RTAE6HmHV4+HEikCBYa2sFpGDYECDCIBEmcESKMDx3IA9j836cjcoloCVyYHlop9jzl9bnN1T3jQVmaQJ7sy7++k874uoqHWk4zsjwXMHyGABHkuDpFiJojY4UCFLAYkS9UxFWBRwF9g4jMufDHiYEIh96YgWLGpAUgIkQRDVDBgTJKiFDAAjW5PwYbvkEZGbtqIjKuVuWd2euPn8sQT1IqpwpHk+NRcK/+ero6HDkrvdWUWh2Vc6iXtlAM4vgmRDOx5WoPp4BGJM1NPwtlANmjcrn+x5a2XvlksmdVSZELAbRmG7lsczQ33DRYYd1VM2piYXzwcaQ46pZQsn5zM5HiZwPKxmp9Q4RjPWPBMvAC0ZKR7ruG2d199745N54vR0bAAISFI+3Ul9fDwGLAKwAADQ2tpZ/kJka/WcUcU6OaVPGz5Zoaro41FDd9mmiyDKpIicZM2QBW84miL33sFbbN+avyiR7gcSEzilLwWtCWB1EvFpbrzkyyE1fFBS6WqpwtdZDZQkrMxslq6Rrtj+3sufK04HEKAtRiYHNolyjzuEvtOCTNjXFQvWR8zqVnLbUsmGwKdmpLpgQV2/9UVfPlZ+fbIbGOwOrgufX6Z/bQzQ2tvLwJvL4r0Wrgkf8i6PqznTNoCZAlaf1AtLVGz/WnfnGE8V4VegJxNggx2KJYR+rI3rnZ6Vo+IkFSUCXqPmYCRLM7qDRf5nbve6uTQeK7R3KsZFYbIVMpz+gAciO1nsfdtTMf3T1oCYqjXzM0EpVSe3ueLwrc8Uni4knphDx2NN6TB0dDzpdmaW/MLbvAiEgAGlQUj4TkWVrlKqpJjVzcUFDVKicske6uEyAuavnqktcd9ujjqpWzFySlieCNCZHJJyzT2795pEe6RJiqhFvmIBdXUvcaDQR6Mp8LeW6fTcrGVLMbEv8PojZMqHqPABIp2ErG66USaIT8fhyuSv/+0tdvb1byipZIl7EbLWSNSHD1X9fLKhTkXgAgEwm6cZiCdXdu+zmvN6+SsqQKEWSCRDW5gmQJ88/4YbDPTObqHAcPVdi/foncnmz9VLmnCl9n8HEYBbs/B0ALFrUaac08QCwv3M0BkNL/R1uSQbEsjFSRUJKzTylss1tkd5LLTaxWEKtWZtcacyenytZJbxjvwOaW2GtSyC1cN6862qSSbIA01QmHgo+x4s91/9R692rpQxKRikmhFhAwQp6j/f3oimBV2M6wwAT2Z33GjvAfsrXAanHrFlIpzFCtScAQAKdU5t4RdqKwfZXghTAVALxmBgMAdUCAI2NW3lKCKqfFta1NtltbG6VEAFRiqB6WctBQASaAWBFDGLKE8+TYgCc/ZOxQ/Dy5g7o6BGzAYOP9jTn+WbqCGqnX4LIK0oXVPLCUAg2AUB//5x3NV4Kyy0AWL3rL9bm9hDJvWomx+QdmC2IxcympotDpRUUV9ayyK/ykjFKyaDx67IFzQKASGQuT3niFfgia/+wE8A2T+GVUqzMIFLU0HD0lMKwcJQnyd3MrEFUSuDdu4QtzfD+XoF3ieeLY1dXl0sQe8rLUJySJgIAoF3XPYBh2AdkATn8hHeJ59MnGo0HGGZaOWACDNftn1r0i3s/lAoGysmWIgAWhgpRgHeJ5/sfgfzsWoDqS/dbCNZaMzjYo6cSWl4GDcAs5hApFIrjS8EYZHe9q/GGBXixAAAOzp4rRbCGWfOBEgYYzEQCRLbP6yXC+0n/rcS1yCMOBdsKPVZKEVK/jcgmb1f78ru72r5YlDwJDC8SogrMdODQCBP7R0YbAaCQBDsVVjq9yAAgy/RByxqj0sPHAQywYNKvervaTe/uav1DfiHYOb90IH1Ty6bXMz8zp4SfF0dcAkD7vFs6pAy1WZu3VEIZAREJa7IQZuhlAFiUhp3SxIvHl0sgaTuab/mYUjUnGZszVJr7QYALwdnnC+GBqWMdiKHCV0tRRaVlqDATKbKc73MDa9cBQBLJKa3xClpKQk67nb2OkSUlgwoS0uiBQWu3PedpzU4zFYQ0nU7q+Sck3iNF3WJthmwpCaHMsEIEmGFWrl796EACLABMXeJ1dDyoUqnFZkHLHbc6qv4kY7IlmQ0PyCBbNi+MZCBThW8sEiIajXNTUyykAo0/FKRUqemL3nEZCJx/HABWxDqnbD6el4HctcRta/nmRQFn9lJtyilkISYispz/V2AqpETFJdDJySTZ+ppP/1ipuhONh1cp982ChHLN7mwWW/+9yKeeUsSjWCyh4Gcgz593xyVBddiPLRuDkn1dZiGE1GZ3f5bfShUDWXmLKRZ7SnmNikh2tHzn0YBsOF/rQV1qv0RmGCFDzJz/QyZz58aCTw2UUTFUut80UrF0cFdnmebM+wzFVWbpdFJ3HHZOGPUf6ZSi5jprDQOGSq8yg1GySuXdXcvXrr1t8ySrzPap8Pr/h5WHVxwZ6otFyasyI5NOQy+IJqJKND4k5fT3eV1iy+KMYHYJPHjf/hzsCdn9gpl5BxQmH3C1tV1Y7eiFnyGqWqbUtGY9obpawQRjXPNm66rem9aXUVdLccRFIWboacl3dmXa/HmJox3VsIQo+BUhqsLaDJbVGdarqw1LV2//35WZr7x372q8cjWeXyLYaQCye5uZtlkXVju1jVVWTq82rINA0P9Proy3yCGfy496JDgtNBBw6wwwUPKrDJJ2AlQ7nYxqJnJiZJ2PSaf6GGYLr2UsyXLkjpmNo8Iqn9/08Krem/5cmrbzhDOdTuoUUgbp0VhGo5dV14ja6j02UKMsxETwyiMHID/8FCHYVgcP6y8HKwDIugg7oWmNZEU74HyYKPAhJatrjMnC28GW147YO8pxAR5aWrA8qdSENN7oxoRtzbfNlSr8HsmBdga3AHQ4ATMBCoOoihnOSISivIP3QoMa9n8nyCwBdvTAh/EtGBNLggxJGQIgwdb1e6dMqC2YJXLAPLRdZzdGV60PvOU9XFqvvCOOiFfNrDtlgUCogyAWMIvjCTSLieoArgYj7H2mUu5vLLy8n4UW/QJiaPTXe2C8AA6QCDhShOC1OsrBsplU75Ssu/lXqzLX/sMkeqd4pItG45EwzrgYMnQBmE6WMuwQBBgWzBZekRb7HYgORoSBJuUPeJ+Li/r2TbJbVO71z3avXfbLA2s7byxB+wlfb5GhOZfCyk+RUMcIERpOImUYeCEJRumhiYlgVZrge1dMvlsUg62gALEd2pofWn/S6lci28YSUjX+rqZT9vfPoa6uJe6C5uTZSs66X4ma4y0bWM5D60G/pxuT3+2cDor7ONySy5Yt/3uBTuU25xnjo/j98d54pHvtsl/GYgmVSi3WY5vVRaKxcSunUmTaW+5JSjVtqRLhoEEezC57eHnYepp3VB+/g4AXT1LcibzNw4RFnQnSErFy7dZLVr9yd18Z/fG8zk/FEt0W/eYZQTF7BYmgNCarQajMdqpjmAylqpXWO57ZlXt8UXv75/XevX29xtzLR3UJbY9+659DgaOuc/VuZraFmFflh66YXKXCzlB+49df7F1263hNLNW+fgmZVArmlOhXZ1s66uNE6qNgeRZISb+9l8IUWMxWKxVRxuzpdYdeOnf9K/+ZW7/+1OI8IIpjufCkmXByy+3tkJFPMMRZAsH3u3q3AayYGnjxcA/kfG7T/Qci3SiNV1CJrcfdeGRV6PDrINQFUoRnAIC1eZSSp1ZBOLpSVTvG7O417uazvHlnxeGAkd8XtNx+lpJ11xHkh6WM+KOXsowpkxjvd32X1crNb3qoq/faJSV3fS84y+0t3/q8lHX/rGS43tis31DbqwafGqRjZibrONVS6x3/nR1YF3/p1e9sGT3nwiNdW9vZ1Y49914pIpcSFIwd8htqY/J+5aFjFYwQjhSk4Ortt6zMXPWNRIJFMlnCnIsC6RY0331nKDT7emOG51jIKaPhPMYZIQJKkIA2238wxA9dnslk8qM1nbcZmDt3SX1NoO13jmo4Res9pjDqC1NnWWZYpcLK2qFdWm+/vLv3+kfLnuzT3nzH5cFQ03e1O+iCjJxAj+BDmG9Fs8xM/2Ztd1y7KrP0Fx40NxVH2ymBBCWxQiyMfurJgDP7TG125wEKTDXCSX/0lja7/5Rz37hszbpb1pU7SI86jr/xOAoevppEVYjZLTpCYvZHbvp79PFSf0aN6iS/OTS9M+dd7Du9UZvBrOWhH2R57W2ZzP1vjiW5BWAXNN99WSg05/va7XdBcIpfdwSvYqwY+046Hj2CYXQo6h1nZSwzLBGEEAEhSMHY/lesu/P2rrVLHy7GpqzATUf03m8rVX+VtoN5sBB+jEkQCSJIv1O4AJWIh1fU4QWT/SBpISjpB4r+Zv6i9YKzhd7Fnq9KJMXIvNr+txjuL21u+/e7/3xTb7G/O1asIBpd7FRR7CUhao5hzllmEp6EkfSKf6TfiV4UdWU/EFbsB7oLAeXCfJCCb/23EN6xlQwRFA3Pq3XBNrfGYvDhXdkXfrx+/c92T2ZerQIF/g5EULI64J1CGG/yjM0PWvBWMPqIbJ9l3kHgPQR+i0lkrfUOB0kEWBAcMM+wzNNJqDpYzCYSswBRT8KpljKoCMIbvsIumI0H7ts2XokgRED4v/lEACznYTm7Q5vss0Tuvw3a1x7LZL715gjh4jaVGqvYJyEAsgG6uUWI0AlEgBDV/imEC28jlt8BYCvB9DGJLZZ1vwS9RZDbjTUMaDCIhFAg4irLtoHgRACeBRINAM0GU4OUISXIEVyYKG5dMMzkZ3WMQ38ixxs0Duw1oXsIlrOvWj3wFGNoeU3PV59MA7o49IYJxvcVwHO1GXiN2Kxm5NaA7Ror9Ms2v2vzAK/cVhgFXu5qaoqFZoQWzRAicqQlp5ko0MbAySA6UYrQDEFBYVn7oRrWRCwOjm9JYHZdbYZeJggGsIXArzPbtaDsSlduWbV6zd19o2OXPTzeEZh30A8rbNU8IaRr7ECGQauJ3TVsdEZT/19zvOXNtWu/vwOYWH7evHmfrwnLI2dpU32shBMV7LRDiPkMOVfJ6iqCgLF5MLu+6TsYQ6yZiSQZO7idgE0EyjG4j6D/QoJWW+iubXtezGzY8JPsXi6HmWzTcWprub3d2fnquq7NDw3uLxwdR0r0xXqGq8C9taLompHHvBSp/c/7OqV5WT07M9rZBj4IBD5MpNqlrBbeKKose6DSJEZtkhUQJqc3L31x7Y3f3s89iVisU/hZNqUVhgJ86om3zspbqunO3LB+/5d6k3xGRgfsHysAWJTutEkIuz/FMX/e7Uc7KnQqyDmbyPkAUeBYQUEYm4O1rvFNvZg48RSY8xuHci+d2/Pn77041lVeAidQ6o4VJQLqwQUWhXz4kXSn5GRO+wlgxLG4KA9t3y/65OZbT2RVew6gzhcUXCBEAMYM+bNeaQL+IAOQLEWAXNN3/cqea+/66PG/C26tfc0ee+x0W8IQvJJWPL5c9vX1+EmTPexPucTk8BqZd1Hc8r+wTjsiXuVGTj0DTugzYPVJJSOzwRbG5iwz80RCOsyWpawia7Nbc9m/fnLN+tueiTX9KISj/6oXpWGTk+PAuDcr8Da9+H41aDwlvKzgUeOVaGH0rg+QCH6BEPx7JWtC2g6B7URG0zMDwioZkq7emuzqubrzQGMsS/3sE3WmJ748DeprnGEiNjd/uT6i5p4Ldi4VMnw6kYQxWevHFMucwsNWyoCwNt+fM298fE1v8ulCXcrbdVfvgK37SLJk4ZETT0w0h3jmZUTO54WMVBszyL5Ei7LIx8IoVaXyess9K3uuubawgTiEq8IojuUC8dEkPLnlro9BVF8tZNXZgPRHZpUXPfAC6I4ETL/Jv/mZleu+/p+x2FPKn3NRicQrMl+IS8Tjw6C2RxPHE+pvkjJ8kaAgvGqwcgBlMJN2VLXK660Prey5cslIh/ZDfShKIYtoRJDaWu88x0FNwlHTTjY2D2vdctPVrRCOAFvXdd/83Kp1N/767SLfO/RIbLQWXNhy6/uFmnGnEjWna5MDlznUjRnaURGVN9t+uvKlKy4ByO51KnFILy/Bo4f9+5ELo/f8kxCRpJTV9VoPlCWsDLYCikBMebPtwhczS3/2dpjdd/hZ7KhZr9TRes91RDVJIUIhY4Z0WSlHDFepiOO6W/9tW+buz23AhmyljYPyXInzDcBoOfrapnDkmLuVrDvPT2MvWVgZbAkKQpBw3b4vdfcufeBga75DJAkgLuEnW7a13NzuyIYfObJuvldux6VnzPrZxG7+rT+4b/3206u3/HEggYRIVtgssuIjrPbo3UuUmHYPiWDYK8Qu1fQye9EBR+TcN69b1Xv9t3zyTXKD5q1DJKMiw0ASsVhCPfdC5ybN/Y/WVB19uKOmLbRsCuPnqQQxk9bkXcepnYtg06KqmiP+9Tc77snGEZcZZCqmDcWGDWnrWYsviyfTX3i+of6U3wvhnKlkpNFaV5em+chrLcbWOk7dR2bVv5efeeGCp+Lx5TKTSWGKEG8E0Dji8vnB3+U2b/39b2ZNf19WqsjZ7I2DZyqRfMbmtXJqm0Ky9qwZkcMeW7Hz0T0+oBXUAyXNmUyKC8JaH6r9OamZCxyndq6xrqaS2rF5iR7M1jhqxocaG86oenLFpX88GOQ7VPPt/PrepF4QveNzjmj4KUhIa3XpfoxfT2HNnpcGBjMfz7zynY0TybI4dDYfiw0A2dFy38NOYOY/ltcVoBAdCKucu+VfujPXXOYlfI4kYEwV4gEAhpvvNN98TtA5LAWooGWXSz1C8sgXVtruecXNvX7W6pdvfbVSyQckBKOTCcQLW+75biAw+/JyW1IMRwfcLT9dmbnq4skE1A/phM+uriVuR8eDzuq1Nz3u6m2fABtN5AAltm4nIqX1gJEUOTbgHPl0W3PixHQ6qf3mPhW2kpb8ne/K3muucN3N9zmqWoGp5DAJEZSr+3UgMOv/dES/+yuAFHDzhKZXVkRq+7Dmm5c8LxQ48teW2QCm9NgVWyNllWQ7tDWf23DOi3++7bnK1XygeHy5SKUWm4Ut334kEJh9iav3TCw0Zd56fNueVHzDhnTZoamKqBPYvPlx29HxoLNqzbUvNdafusVxZnzCsi21razXo9dqI0QoImVNvHHayc882935aiyWUN4OsbJWJrMc8XirfDJ96WMz6888zXHq5lqbMyUH5QnS2rzrqLqWKueYMxpmz/j1li3fzZcTHaiY2oqC2e3uveGBXH7ztx0ZVqXMUy0inzQ2a0FOnaqa88SCucmPpdNJ3dHxoFOBSs/PqGHOYd1ntN7VI2VYcjm9NAiOq/doJWcsCpjT/6u5+aL6FFImjuVyShHPJ5+OxRJqVe/117i67wmlqlUpU7dHyCeEta4lyJAKHv5YW/Otny4QuhJ9vjgWi0zm/v683nSetdndQpTuHxd8ZFf3a6nqTovI0/90whFLDk9hsSnk700Z4gFgL5eQSZg3LzRm92bppcDbMsAUlrUFhAw6s5cvaL7t4q6uJa7XHbOyVgopb+r2ulvW5c3WLwohBbMoK7PY36Bpqaa11dW2P9l6/BXHFaZ5V7yPN3qlOR5vlX98+sqBhrrTepQz7UJf65UsZF4g2gAQpNS0TzXWn/7mMy9c9Hws9pTasOEnFeXzbdiQtl6Q+aY1s+rPOCrgzOgw5fh7wz6yq6WsblSy7lMz6jp+//zKZN94PnJF1s8WJG71y994wnW3f1+qsGK2ZdYICAIMrLUmoA57YEHLHV9Npz9QCLVUVKF7Ot1pEgkWA6bnKlfv2CBFqKTJ2/toPjNgSISPDAXmpE9qvmHheKGpiq1+37BhBcfjrXLrjvQKMg2fkzI8ndmU2dOECLDEDOM40z86s/69/OwLNz7lS3IFHa8l0djYKp5++oZsQ8Op6xxZeyGztVSmYvI1n5EyWCNF7WdmzOj47+e7OjeOpfkquGOAd5SzevWjA9bd/RXyC0cn8DoEGGlMToecw5ILo9++M51O6kSCK6pNW8FKrOlN/N7Vby13ZLUsZ2NWtEGTxuQNwamvcub8YUFz8mxP8432kSu6VUUq5e2wutd97d+13vEfSoUnBKav+aSrszrgzLq+vfXe7yWTZD3yccWQr7Axy+fe+Ko2e3YLcgjlDfAdDk1Zm7OAijjq8P9Y2HzbOen0B0aFpiq+0UwmEyVgBWbX/bGbRNUXQUIUuhqUDSdBWKvdgJp+2qyG2FG/SJ32W094FxFQCaY3zbEY1PPdd+ycNTOmHDX9Q8bmbbnFQwW0mI0lIaUQkcWNM05d373m6hc7Oh50Nm9+3E6NqYN+W4qFLfc9EAg0Lin7iGifoI3X+dI1b/2q66UrPgu/M2FljJbyDv6j0a3hKjqpV4qqwy27PHHryJYgiYSgvLvl0lW9y34Yjy+XU6IrlB+lJ1dtv0XbPf2CpJyICSlyHx1XD2hHNpy/sPW7j0ejl0VQ8hC+d75vHItBZDL39zPvuUMIRcyTwAokGBrWWht05jy8MHrPl1OpxWaK9HTzYntPPXX5rtkNHzzKUbWnGKsN0cR9XM/s5l3Hmd5MJvSe6toTfrt9+7Mu9hpmcWhGBNIMME2feV+GMOciKUJ1gLUT30wVspnZShk5p7H+/dn/Bz39HQgiDh5LAAAAAElFTkSuQmCC'

// Decode the base64 string into a Uint8Array suitable for ImageRun.
function rrLogoBytes() {
  const bin = atob(RR_LOGO_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Inline-bold parser for runs inside a paragraph or table cell.
// Returns an array of TextRun objects with bold flags set where the markdown
// uses **double asterisks**. baseStyle merges with the default body style.
function parseInlineBoldToRuns(text, baseStyle = {}) {
  const baseRun = { font: 'Arial', size: 20, color: RR_TEXT, ...baseStyle }
  if (!text) return [new TextRun({ text: '', ...baseRun })]

  const runs = []
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ ...baseRun, text: part.slice(2, -2), bold: true }))
    } else {
      runs.push(new TextRun({ ...baseRun, text: part }))
    }
  }
  return runs.length ? runs : [new TextRun({ text: '', ...baseRun })]
}

// Build a docx Table from an array of markdown row lines (each starts and ends with |).
// First row is treated as header; the alignment-separator row (| --- | --- |) is
// detected and skipped. Header row uses navy fill + white text; body rows alternate
// between white and pale-navy shading.
function buildRichBriefingTable(rowLines) {
  const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  const isSeparator = (cells) => cells.every((c) => /^:?-+:?$/.test(c))

  const allRows = rowLines.map(splitRow)
  const dataRows = allRows.filter((r) => !isSeparator(r))
  if (dataRows.length === 0) return null

  const header = dataRows[0]
  const body = dataRows.slice(1)
  const colCount = Math.max(header.length, ...body.map((r) => r.length))

  const padRow = (row) => {
    const padded = [...row]
    while (padded.length < colCount) padded.push('')
    return padded
  }

  // US Letter content width with 1.1 inch side margins ≈ 9072 DXA. Distribute
  // evenly across columns; this could be smarter (e.g. weight by typical content
  // length per column) but even-split renders cleanly for the briefing tables.
  const totalWidth = 9072
  const colWidth = Math.floor(totalWidth / colCount)
  const columnWidths = Array(colCount).fill(colWidth)

  const cellBorders = {
    top:    { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
    left:   { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
    right:  { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
  }

  const headerCells = padRow(header).map((cellText) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: RR_NAVY },
      borders: cellBorders,
      width: { size: colWidth, type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new TextRun({
            text: cellText,
            font: 'Arial',
            size: 20,
            bold: true,
            color: 'FFFFFF',
          })],
        }),
      ],
    })
  )

  const bodyRows = body.map((row, rowIdx) => {
    const cells = padRow(row).map((cellText) =>
      new TableCell({
        shading: rowIdx % 2 === 0
          ? undefined
          : { type: ShadingType.CLEAR, color: 'auto', fill: RR_TABLE_ALT },
        borders: cellBorders,
        width: { size: colWidth, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0, line: 276 },
            children: parseInlineBoldToRuns(cellText),
          }),
        ],
      })
    )
    return new TableRow({ children: cells })
  })

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
    borders: {
      top:              { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
      bottom:           { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
      left:             { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
      right:            { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
      insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: RR_BORDER },
    },
  })
}

// Render a numbered H1 section heading like "1.  Deal Snapshot" with a navy
// bottom-border underline matching the RR template style.
function rrNumberedHeading(text) {
  return new Paragraph({
    spacing: { before: 320, after: 160 },
    border: {
      bottom: { color: RR_NAVY, style: BorderStyle.SINGLE, size: 8, space: 4 },
    },
    children: [new TextRun({
      text,
      font: 'Arial',
      size: 32,           // 16pt — matches "1. Overview" sizing in the template
      bold: true,
      color: RR_NAVY,
    })],
  })
}

// Render a sub-heading (### in markdown) — bold navy without the underline.
function rrSubHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({
      text,
      font: 'Arial',
      size: 24,           // 12pt
      bold: true,
      color: RR_NAVY,
    })],
  })
}

// Walk the markdown line by line, emitting Paragraph / Table elements in
// document order. Each markdown construct maps to a styled docx element.
function parseRichBriefingMarkdown(markdown) {
  const lines = (markdown || '').split('\n')
  const children = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    // Horizontal rule — render as a thin navy divider paragraph
    if (/^-{3,}$/.test(trimmed)) {
      children.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        border: { bottom: { color: RR_BORDER, style: BorderStyle.SINGLE, size: 6, space: 1 } },
        children: [new TextRun({ text: '' })],
      }))
      i++
      continue
    }

    // Headings
    const h1 = trimmed.match(/^#\s+(.+)$/)
    const h2 = trimmed.match(/^##\s+(.+)$/)
    const h3 = trimmed.match(/^###\s+(.+)$/)

    // # Title — large navy title (the document opening, e.g. company name)
    if (h1) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 80 },
        children: [new TextRun({
          text: h1[1],
          font: 'Arial',
          size: 48,         // 24pt — large title
          bold: true,
          color: RR_NAVY,
        })],
      }))
      i++
      continue
    }

    // ## Section — numbered RR-style heading with underline
    if (h2) {
      children.push(rrNumberedHeading(h2[1]))
      i++
      continue
    }

    // ### Subheading — bold navy, no underline
    if (h3) {
      children.push(rrSubHeading(h3[1]))
      i++
      continue
    }

    // Tables — sequence of lines starting with |
    if (trimmed.startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const table = buildRichBriefingTable(tableLines)
      if (table) {
        children.push(table)
        children.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun({ text: '' })] }))
      }
      continue
    }

    // Bullets — sequence of lines starting with - or *
    if (/^[-*]\s+/.test(trimmed)) {
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const bulletText = lines[i].trim().replace(/^[-*]\s+/, '')
        children.push(new Paragraph({
          numbering: { reference: 'rr-bullets', level: 0 },
          spacing: { before: 40, after: 40, line: 276 },
          children: parseInlineBoldToRuns(bulletText),
        }))
        i++
      }
      continue
    }

    // Plain paragraph (joins consecutive non-special lines)
    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('|') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^-{3,}$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim())
      i++
    }
    const paraText = paraLines.join(' ')
    if (paraText) {
      children.push(new Paragraph({
        spacing: { before: 80, after: 80, line: 300 },
        children: parseInlineBoldToRuns(paraText),
      }))
    }
  }

  return children
}

// Build the page header (logo right-aligned with navy bottom-border line).
function buildRrHeader() {
  const logoBytes = rrLogoBytes()
  // Logo source is 158x80. Render at ~40px tall (80x ratio preserved): 79x40
  // EMU conversion: ~38 EMU per pixel. 79px ≈ 514350 EMU, 40px ≈ 257175 EMU
  // — matches the template XML's wp:extent values exactly.
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        border: {
          bottom: { color: RR_NAVY, style: BorderStyle.SINGLE, size: 12, space: 4 },
        },
        children: [
          new ImageRun({
            data: logoBytes,
            type: 'png',
            transformation: { width: 79, height: 40 },
          }),
        ],
      }),
    ],
  })
}

// Build the page footer (company line in centred navy Arial 7pt with navy
// top-border line). Matches the template footer verbatim.
function buildRrFooter() {
  const navyRun = (text, bold = false) => new TextRun({
    text,
    font: 'Arial',
    size: 14,           // 7pt
    bold,
    color: RR_NAVY,
  })

  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        border: {
          top: { color: RR_NAVY, style: BorderStyle.SINGLE, size: 12, space: 4 },
        },
        children: [
          navyRun('Risk Rising Limited', true),
          navyRun(' • One Embankment, 1 Neville Street, Leeds, West Yorkshire, England, LS1 4DW  •  Company No. 14218148'),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 0 },
        children: [
          navyRun('www.riskrising.com  •  info@riskrising.co.uk'),
        ],
      }),
    ],
  })
}

// Top-level entry — render briefing markdown into the branded .docx and
// trigger a save. The body of the document begins with a custom title block
// (large navy title + italic subtitle), followed by the parsed markdown.
async function exportRichBriefingDocx(briefingMarkdown, companyName, stage) {
  const safeCompany = (companyName || 'briefing').toString().trim().replace(/\s+/g, '_').toLowerCase() || 'briefing'
  const stageSlug = stage === 'post_discovery' ? 'post_discovery' : 'pre_discovery'
  const filename = `${safeCompany}_${stageSlug}_pack.docx`

  // The briefing markdown opens with its own "# Company — Pack" title and
  // "**Prepared by:** Risk Rising / Date / Classification" metadata block.
  // We strip those (they live in the title block we render programmatically
  // below) and keep only the section content. The first occurrence of "## "
  // marks where real sections begin.
  const firstSectionIdx = briefingMarkdown.indexOf('\n## ')
  const stripped = firstSectionIdx >= 0
    ? briefingMarkdown.slice(firstSectionIdx + 1)
    : briefingMarkdown

  const titleText = (companyName || 'Company').toString().trim()
  const subtitleText = stage === 'post_discovery'
    ? `Post-Discovery Pack  •  ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  •  Confidential`
    : `Discovery Pack  •  ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  •  Confidential`

  const titleBlock = [
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [new TextRun({
        text: titleText,
        font: 'Arial',
        size: 56,           // 28pt — matches "Employee Share Scheme" sizing
        bold: true,
        color: RR_NAVY,
      })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 280 },
      children: [new TextRun({
        text: subtitleText,
        font: 'Arial',
        size: 20,           // 10pt
        italics: true,
        color: RR_MUTED,
      })],
    }),
  ]

  const sectionContent = parseRichBriefingMarkdown(stripped)
  const children = [...titleBlock, ...sectionContent]

  const doc = new Document({
    creator: 'Risk Rising',
    title: `${titleText} — ${stage === 'post_discovery' ? 'Post-Discovery Pack' : 'Discovery Pack'}`,
    description: 'Risk Rising rich briefing',
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20, color: RR_TEXT } },
      },
    },
    numbering: {
      config: [
        {
          reference: 'rr-bullets',
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },         // US Letter
            margin: { top: 1700, bottom: 1700, left: 1584, right: 1584 },
          },
        },
        headers: { default: buildRrHeader() },
        footers: { default: buildRrFooter() },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename)
}


// ── Pre-discovery DOCX export ──

async function exportDoc(company, structured, resultText, stabilisedScore, resolvedSnapshot, dashboard) {
  const logoData = await loadLogo()
  const targetHeight = 28
  const targetWidth = Math.round((logoData.width / logoData.height) * targetHeight)

  const sectionMap = sectionMapFromText(resultText)

  // ─── Dashboard is the source of truth for score and the eight statuses. ───
  // If a dashboard is present, every authoritative value MUST come from it.
  // Stabilised score, structured.deal_snapshot, and parsed text values are
  // only consulted when no dashboard exists (legacy / fallback case).
  const truth = getDashboardTruth(dashboard)
  const dashScore = truth?.prospectMatchScore

  const score = typeof dashScore === 'number'
    ? dashScore
    : (typeof stabilisedScore === 'number' ? stabilisedScore : (resolvedSnapshot?.score ?? structured?.deal_snapshot?.score ?? '—'))
  const numScore = typeof score === 'number' ? score : 0
  const scoreHex = numScore >= 70 ? '15803d' : numScore >= 50 ? 'b45309' : 'b91c1c'

  // Fit level from dashboard if present, else legacy fallback chain
  const fitLevel = (truth?.useCaseFit) || bestValue(resolvedSnapshot?.fit_level,
    bestValue(structured?.deal_snapshot?.fit_level, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Fit Level'))
  ) || 'Not assessed'

  // Stance derived from dashboard score if dashboard present (consistent with backend mapper),
  // otherwise legacy fallback
  const stance = truth
    ? (numScore >= 80 ? 'Prioritise and pursue'
        : numScore >= 65 ? 'Qualify and advance'
        : numScore >= 45 ? 'Qualify carefully'
        : numScore >= 25 ? 'Deprioritise'
        : 'Disqualify')
    : (bestValue(resolvedSnapshot?.stance,
        bestValue(structured?.deal_snapshot?.stance, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Stance'))
      ) || '')

  const rationale = (truth?.useCaseFitReason) || bestValue(resolvedSnapshot?.rationale,
    bestValue(structured?.deal_snapshot?.rationale, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Rationale'))
  ) || ''

  // Legacy four dimensions — only used when no dashboard exists
  const productFit = bestValue(resolvedSnapshot?.product_fit, bestValue(structured?.deal_snapshot?.product_fit, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Product Fit')))
  const commercialFit = bestValue(resolvedSnapshot?.commercial_fit, bestValue(structured?.deal_snapshot?.commercial_fit, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Commercial Fit')))
  const dealMaturity = bestValue(resolvedSnapshot?.deal_maturity, bestValue(structured?.deal_snapshot?.deal_maturity, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Deal Maturity')))
  const icpFit = bestValue(resolvedSnapshot?.icp_fit, bestValue(structured?.deal_snapshot?.icp_fit, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'ICP Fit')))

  const executiveSummary = bestArray(structured?.executive_summary, parseSection(resultText, 'Executive Summary'))
  const topRisks = bestArray(structured?.top_risks, parseSection(resultText, 'Top 3 Deal Risks'))
  const reasonsToWin = bestArray(structured?.top_reasons_to_win, parseSection(resultText, 'Top 3 Reasons This Could Win'))
  const demoFocus = bestArray(structured?.demo_focus_recommendations, parseSection(resultText, 'Demo Focus Recommendations'))
  const commercialRecommendation = bestArray(structured?.commercial_recommendation, parseSection(resultText, 'Commercial Recommendation'))

  const aeStance = bestValue(structured?.ae_recommendation?.stance, getFieldValueFromSection(sectionMap, 'AE Recommendation', 'Stance'))
  const aeWhy = bestValue(structured?.ae_recommendation?.why, getFieldValueFromSection(sectionMap, 'AE Recommendation', 'Why'))

  const sponsorFromText = getSponsorStrategyFromText(sectionMap)
  const likelySponsor = bestValue(structured?.sponsor_strategy?.likely_sponsor, sponsorFromText.likelySponsor)
  const missingPeople = bestArray(structured?.sponsor_strategy?.missing_people, sponsorFromText.missingPeople)
  const howToBringThemIn = bestArray(structured?.sponsor_strategy?.how_to_bring_them_in, sponsorFromText.howToBringThemIn)

  const narrativeFromText = getDiscoveryNarrativeFromText(sectionMap)
  const narrative = resolveNarrative(narrativeFromText, structured?.discovery_call_narrative)

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new ImageRun({ data: logoData.buffer, transformation: { width: targetWidth, height: targetHeight } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: clean(company || 'Discovery Prep'), bold: true, color: '0B1F3A', font: 'Calibri', size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: 'Prepared by Risk Rising', italics: true, color: '64748B', font: 'Calibri', size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-GB')}`, color: '94A3B8', font: 'Calibri', size: 18 })],
    }),
    dividerParagraph(),
    // ─── Dashboard truth block (when present, printed first as the authoritative summary) ───
    ...(truth ? [
      subSectionBar('Dashboard Summary'),
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: 120 },
        children: [
          new TextRun({ text: 'Prospect Match Score: ', bold: true, font: 'Calibri', size: 26, color: '0B1F3A' }),
          new TextRun({ text: `${score}%`, bold: true, font: 'Calibri', size: 36, color: scoreHex }),
          ...(truth.scoreDirection ? [new TextRun({ text: `   (${truth.scoreDirection})`, font: 'Calibri', size: 20, color: '64748B', italics: true })] : []),
        ],
      }),
      ...[
        labelValueParagraph('LogicGate Use Case Fit', truth.useCaseFit ? `${truth.useCaseFit}${truth.useCaseFitReason ? ' — ' + truth.useCaseFitReason : ''}` : ''),
        labelValueParagraph('Implementation Scope & Vision', truth.implementationScope ? `${truth.implementationScope}${truth.implementationScopeReason ? ' — ' + truth.implementationScopeReason : ''}` : ''),
        labelValueParagraph('Competition', truth.competitionStatus ? `${truth.competitionStatus}${truth.competitionDetail ? ' — ' + truth.competitionDetail : ''}` : ''),
        labelValueParagraph('Budget', truth.budgetStatus ? `${truth.budgetStatus}${truth.budgetDetail ? ' — ' + truth.budgetDetail : ''}` : ''),
        labelValueParagraph('Executive Sponsors', truth.executiveSponsors ? `${truth.executiveSponsors}${truth.executiveSponsorDetail ? ' — ' + truth.executiveSponsorDetail : ''}` : ''),
        labelValueParagraph('Compelling Event', truth.compellingEvent ? `${truth.compellingEvent}${truth.compellingEventDetail ? ' — ' + truth.compellingEventDetail : ''}` : ''),
        truth.nextSteps && !isWeakText(truth.nextSteps)
          ? new Paragraph({
              spacing: { after: 80, line: 276 },
              indent: { left: 120 },
              children: [
                new TextRun({ text: 'Next Steps: ', bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
                new TextRun({ text: clean(truth.nextSteps), font: 'Calibri', size: 22, color: '1E293B' }),
              ],
            })
          : null,
      ].filter(Boolean),
      dividerParagraph(),
    ] : []),
    subSectionBar('Deal Snapshot'),
    new Paragraph({
      spacing: { after: 100 },
      indent: { left: 120 },
      children: [
        new TextRun({ text: 'Prospect Match Score: ', bold: true, font: 'Calibri', size: 26, color: '0B1F3A' }),
        new TextRun({ text: `${score}%`, bold: true, font: 'Calibri', size: 36, color: scoreHex }),
      ],
    }),
    ...[
      labelValueParagraph('Fit Level', fitLevel),
      labelValueParagraph('Stance', stance),
      rationale && !isWeakText(rationale)
        ? new Paragraph({
            spacing: { after: 80, line: 276 },
            indent: { left: 120 },
            children: [
              new TextRun({ text: 'Rationale: ', bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
              new TextRun({ text: clean(rationale), font: 'Calibri', size: 22, color: '1E293B' }),
            ],
          })
        : null,
      labelValueParagraph('Product Fit', productFit),
      labelValueParagraph('Commercial Fit', commercialFit),
      labelValueParagraph('Deal Maturity', dealMaturity),
      labelValueParagraph('ICP Fit', icpFit),
    ].filter(Boolean),
    dividerParagraph(),
  ]

  addBulletSection(children, 'Executive Summary', executiveSummary)
  addBulletSection(children, 'Top 3 Deal Risks', topRisks)
  addBulletSection(children, 'Top 3 Reasons This Could Win', reasonsToWin)
  addBulletSection(children, 'Demo Focus Recommendations', demoFocus)
  addBulletSection(children, 'Commercial Recommendation', commercialRecommendation)

  if (aeStance || aeWhy) {
    children.push(headerBar('AE Recommendation'))
    if (aeStance && !isWeakText(aeStance)) children.push(bodyParagraph(`Stance: ${aeStance}`))
    if (aeWhy && !isWeakText(aeWhy)) children.push(bodyParagraph(`Why: ${aeWhy}`))
    children.push(dividerParagraph())
  }

  if (likelySponsor || missingPeople.length || howToBringThemIn.length) {
    children.push(headerBar('Sponsor Strategy'))
    if (likelySponsor && !isWeakText(likelySponsor)) children.push(bodyParagraph(`Likely Sponsor: ${likelySponsor}`))
    if (missingPeople.length) {
      children.push(subheadingParagraph('Missing People'))
      missingPeople.forEach((item) => children.push(bulletParagraph(item)))
    }
    if (howToBringThemIn.length) {
      children.push(subheadingParagraph('How to Bring Them In'))
      howToBringThemIn.forEach((item) => children.push(bulletParagraph(item)))
    }
    children.push(dividerParagraph())
  }

  addNarrativeSection(children, narrative)

  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Full Briefing', bold: true, color: '0B1F3A', font: 'Calibri', size: 32 })],
    })
  )

  addDetailedSectionsFromText(children, resultText)

  const doc = new Document({
    creator: 'Risk Rising',
    title: clean(company || 'Discovery Prep'),
    description: 'Discovery prep generated by Risk Rising',
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${clean(company) || 'prep'}_discovery.docx`)
}

// ── Post-discovery DOCX export ──

async function exportPostDiscoveryDoc(company, updateResult, resolvedSnapshot, postStructured, dashboard) {
  const logoData = await loadLogo()
  const targetHeight = 28
  const targetWidth = Math.round((logoData.width / logoData.height) * targetHeight)

  const sectionMap = sectionMapFromText(updateResult)

  // ─── Dashboard is the source of truth (post-discovery dashboard if available, ───
  // ─── otherwise no dashboard means legacy behaviour). ───
  const truth = getDashboardTruth(dashboard)
  const dashScore = truth?.prospectMatchScore

  const score = typeof dashScore === 'number' ? dashScore : (resolvedSnapshot?.score ?? '—')
  const numScore = typeof score === 'number' ? score : 0
  const scoreHex = numScore >= 70 ? '15803d' : numScore >= 50 ? 'b45309' : 'b91c1c'

  const fitLevel = (truth?.useCaseFit) || bestValue(resolvedSnapshot?.fit_level, getFieldValueFromSection(sectionMap, 'Updated Deal Snapshot', 'Fit Level')) || 'Not assessed'

  const stance = truth
    ? (numScore >= 80 ? 'Prioritise and pursue'
        : numScore >= 65 ? 'Qualify and advance'
        : numScore >= 45 ? 'Qualify carefully'
        : numScore >= 25 ? 'Deprioritise'
        : 'Disqualify')
    : (bestValue(resolvedSnapshot?.stance, getFieldValueFromSection(sectionMap, 'Updated Deal Snapshot', 'Stance')) || '')

  const rationale = (truth?.useCaseFitReason) || bestValue(resolvedSnapshot?.rationale, getFieldValueFromSection(sectionMap, 'Updated Deal Snapshot', 'Rationale')) || ''
  const productFit = bestValue(resolvedSnapshot?.product_fit, getFieldValueFromSection(sectionMap, 'Updated Deal Snapshot', 'Product Fit'))
  const commercialFit = bestValue(resolvedSnapshot?.commercial_fit, getFieldValueFromSection(sectionMap, 'Updated Deal Snapshot', 'Commercial Fit'))
  const dealMaturity = bestValue(resolvedSnapshot?.deal_maturity, getFieldValueFromSection(sectionMap, 'Updated Deal Snapshot', 'Deal Maturity'))
  const icpFit = bestValue(resolvedSnapshot?.icp_fit, getFieldValueFromSection(sectionMap, 'Updated Deal Snapshot', 'ICP Fit'))

  // Score movement — prefer dashboard direction if present
  const prevScore = postStructured?.score_movement?.previous_score || getFieldValueFromSection(sectionMap, 'Score Movement', 'Previous score')
  const scoreDir = (truth?.scoreDirection) || postStructured?.score_movement?.direction || getFieldValueFromSection(sectionMap, 'Score Movement', 'Direction')

  // Key bullet sections — prefer structured arrays, fall back to text parse
  const whatChanged = bestArray(postStructured?.what_changed, parseSection(updateResult, 'What Changed'))
  const confirmed = bestArray(postStructured?.confirmed, getSectionBullets(sectionMap, 'Confirmed'))
  const stillAssumed = bestArray(postStructured?.still_assumed, getSectionBullets(sectionMap, 'Still Assumed'))
  const disproven = bestArray(postStructured?.disproven, getSectionBullets(sectionMap, 'Disproven'))
  const newRisks = bestArray(postStructured?.new_risks, parseSection(updateResult, 'New Risks Identified'))
  const newBuyingSignals = bestArray(postStructured?.new_buying_signals, parseSection(updateResult, 'New Buying Signals'))
  const nextActions = bestArray(postStructured?.next_actions, parseSection(updateResult, 'Recommended Next Actions'))

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new ImageRun({ data: logoData.buffer, transformation: { width: targetWidth, height: targetHeight } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: clean(company || 'Post-Discovery Update'), bold: true, color: '0B1F3A', font: 'Calibri', size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: 'Post-Discovery Update · Prepared by Risk Rising', italics: true, color: '64748B', font: 'Calibri', size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-GB')}`, color: '94A3B8', font: 'Calibri', size: 18 })],
    }),
    dividerParagraph(),

    // ─── Dashboard truth block (when present, printed first as the authoritative summary) ───
    ...(truth ? [
      subSectionBar('Dashboard Summary (Post-Discovery)'),
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: 120 },
        children: [
          new TextRun({ text: 'Prospect Match Score: ', bold: true, font: 'Calibri', size: 26, color: '0B1F3A' }),
          new TextRun({ text: `${score}%`, bold: true, font: 'Calibri', size: 36, color: scoreHex }),
          ...(truth.scoreDirection ? [new TextRun({ text: `   (${truth.scoreDirection})`, font: 'Calibri', size: 20, color: '64748B', italics: true })] : []),
        ],
      }),
      ...[
        labelValueParagraph('LogicGate Use Case Fit', truth.useCaseFit ? `${truth.useCaseFit}${truth.useCaseFitReason ? ' — ' + truth.useCaseFitReason : ''}` : ''),
        labelValueParagraph('Implementation Scope & Vision', truth.implementationScope ? `${truth.implementationScope}${truth.implementationScopeReason ? ' — ' + truth.implementationScopeReason : ''}` : ''),
        labelValueParagraph('Competition', truth.competitionStatus ? `${truth.competitionStatus}${truth.competitionDetail ? ' — ' + truth.competitionDetail : ''}` : ''),
        labelValueParagraph('Budget', truth.budgetStatus ? `${truth.budgetStatus}${truth.budgetDetail ? ' — ' + truth.budgetDetail : ''}` : ''),
        labelValueParagraph('Executive Sponsors', truth.executiveSponsors ? `${truth.executiveSponsors}${truth.executiveSponsorDetail ? ' — ' + truth.executiveSponsorDetail : ''}` : ''),
        labelValueParagraph('Compelling Event', truth.compellingEvent ? `${truth.compellingEvent}${truth.compellingEventDetail ? ' — ' + truth.compellingEventDetail : ''}` : ''),
        truth.nextSteps && !isWeakText(truth.nextSteps)
          ? new Paragraph({
              spacing: { after: 80, line: 276 },
              indent: { left: 120 },
              children: [
                new TextRun({ text: 'Next Steps: ', bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
                new TextRun({ text: clean(truth.nextSteps), font: 'Calibri', size: 22, color: '1E293B' }),
              ],
            })
          : null,
      ].filter(Boolean),
      dividerParagraph(),
    ] : []),

    // Updated deal snapshot
    subSectionBar('Updated Deal Snapshot'),
    new Paragraph({
      spacing: { after: 80 },
      indent: { left: 120 },
      children: [
        new TextRun({ text: 'Updated Score: ', bold: true, font: 'Calibri', size: 26, color: '0B1F3A' }),
        new TextRun({ text: `${score}%`, bold: true, font: 'Calibri', size: 36, color: scoreHex }),
        ...(prevScore && scoreDir ? [
          new TextRun({ text: `  (was ${prevScore} · ${scoreDir})`, font: 'Calibri', size: 20, color: '64748B', italics: true }),
        ] : []),
      ],
    }),
    ...[
      labelValueParagraph('Fit Level', fitLevel),
      labelValueParagraph('Stance', stance),
      rationale && !isWeakText(rationale)
        ? new Paragraph({
            spacing: { after: 80, line: 276 },
            indent: { left: 120 },
            children: [
              new TextRun({ text: 'Rationale: ', bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
              new TextRun({ text: clean(rationale), font: 'Calibri', size: 22, color: '1E293B' }),
            ],
          })
        : null,
      labelValueParagraph('Product Fit', productFit),
      labelValueParagraph('Commercial Fit', commercialFit),
      labelValueParagraph('Deal Maturity', dealMaturity),
      labelValueParagraph('ICP Fit', icpFit),
    ].filter(Boolean),
    dividerParagraph(),
  ]

  // Summary sections
  addBulletSection(children, 'What Changed', whatChanged)

  // Confirmed vs Assumed — three subsections
  if (confirmed.length || stillAssumed.length || disproven.length) {
    children.push(headerBar('Confirmed vs Assumed'))
    if (confirmed.length) {
      children.push(subheadingParagraph('Confirmed'))
      confirmed.forEach((b) => children.push(bulletParagraph(b)))
    }
    if (stillAssumed.length) {
      children.push(subheadingParagraph('Still Assumed'))
      stillAssumed.forEach((b) => children.push(bulletParagraph(b)))
    }
    if (disproven.length) {
      children.push(subheadingParagraph('Disproven'))
      disproven.forEach((b) => children.push(bulletParagraph(b)))
    }
    children.push(dividerParagraph())
  }

  addBulletSection(children, 'New Risks Identified', newRisks)
  addBulletSection(children, 'New Buying Signals', newBuyingSignals)
  addBulletSection(children, 'Recommended Next Actions', nextActions)

  // Full update text on page 2
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Full Update Report', bold: true, color: '0B1F3A', font: 'Calibri', size: 32 })],
    })
  )

  addDetailedSectionsFromText(children, updateResult, new Set([
    'Updated Deal Snapshot',
    'What Changed',
    'New Risks Identified',
    'New Buying Signals',
    'Recommended Next Actions',
  ]))

  const doc = new Document({
    creator: 'Risk Rising',
    title: clean(company || 'Post-Discovery Update'),
    description: 'Post-discovery update generated by Risk Rising',
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${clean(company) || 'update'}_post_discovery.docx`)
}

// ── Execution DOCX export ──

async function exportExecutionDoc(company, executionResult, strategyStructured) {
  const logoData = await loadLogo()
  const targetHeight = 28
  const targetWidth = Math.round((logoData.width / logoData.height) * targetHeight)

  const sectionMap = sectionMapFromText(executionResult)

  // Deal strategy call — from structured first, then text
  const dealCall = strategyStructured?.deal_strategy?.call || (() => {
    const section = sectionMap.get('Deal Strategy Call')
    if (!section) return ''
    for (const item of section.content) {
      const text = clean(item.text)
      const lc = text.toLowerCase()
      if (lc.includes('push') || lc.includes('shape') || lc.includes('slow') || lc.includes('qualify out')) {
        return removeBulletPrefix(text)
      }
    }
    return ''
  })()
  const dealWhy = strategyStructured?.deal_strategy?.why || getFieldValueFromSection(sectionMap, 'Deal Strategy Call', 'Why')

  const callColour = (() => {
    const lc = dealCall.toLowerCase()
    if (lc.includes('push')) return '15803d'
    if (lc.includes('qualify out') || lc.includes('slow')) return 'b91c1c'
    return 'b45309'
  })()

  // Bullet sections
  const nextObjectives = bestArray(strategyStructured?.next_call_objectives, parseSection(executionResult, 'Next Call Objectives (Non-Negotiable)'))
  const exactQuestions = bestArray(strategyStructured?.exact_questions, parseSection(executionResult, 'Exact Questions to Ask (Next Call)'))
  const positioning = bestArray(strategyStructured?.positioning_to_push, parseSection(executionResult, 'Positioning to Push'))
  const whatToAvoid = bestArray(strategyStructured?.what_to_avoid, parseSection(executionResult, 'What to Avoid'))
  const commercialStrategy = bestArray(strategyStructured?.commercial_strategy?.bullets, parseSection(executionResult, 'Commercial Strategy'))
  const realityCheck = bestArray(strategyStructured?.internal_reality_check, parseSection(executionResult, 'Internal Reality Check (Brutal)'))
  const winPath = bestArray(strategyStructured?.win_path, getSectionBullets(sectionMap, 'Win Path'))
  const losePath = bestArray(strategyStructured?.lose_path, getSectionBullets(sectionMap, 'Lose Path'))

  // Follow-up email body
  const emailBody = (() => {
    if (strategyStructured?.follow_up_email?.body) return strategyStructured.follow_up_email.body
    const section = sectionMap.get('Follow-Up Email (Send Immediately)')
    if (!section) return ''
    return section.content
      .filter((item) => item.type === 'paragraph' || item.type === 'bullet')
      .map((item) => clean(item.text))
      .filter(Boolean)
      .join('\n\n')
  })()

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new ImageRun({ data: logoData.buffer, transformation: { width: targetWidth, height: targetHeight } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: clean(company || 'Deal Execution Plan'), bold: true, color: '0B1F3A', font: 'Calibri', size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: 'Execution Strategy · Prepared by Risk Rising', italics: true, color: '64748B', font: 'Calibri', size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-GB')}`, color: '94A3B8', font: 'Calibri', size: 18 })],
    }),
    dividerParagraph(),
  ]

  // Deal Strategy Call — prominent header block
  if (dealCall) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        shading: { type: ShadingType.CLEAR, fill: 'EAF1F8', color: 'auto' },
        children: [
          new TextRun({ text: '  Deal Strategy Call: ', bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
          new TextRun({ text: clean(dealCall), bold: true, font: 'Calibri', size: 28, color: callColour }),
        ],
      })
    )
    if (dealWhy && !isWeakText(dealWhy)) {
      children.push(bodyParagraph(dealWhy))
    }
    children.push(dividerParagraph())
  }

  addBulletSection(children, 'Next Call Objectives (Non-Negotiable)', nextObjectives)
  addBulletSection(children, 'Exact Questions to Ask', exactQuestions)
  addBulletSection(children, 'Positioning to Push', positioning)
  addBulletSection(children, 'What to Avoid', whatToAvoid)
  addBulletSection(children, 'Commercial Strategy', commercialStrategy)

  // Stakeholder strategy — render full section content
  const stakeholderSection = sectionMap.get('Stakeholder Strategy')
  if (stakeholderSection) {
    children.push(headerBar('Stakeholder Strategy'))
    stakeholderSection.content.forEach((item) => {
      if (item.type === 'bullet') children.push(bulletParagraph(item.text))
      else if (item.type === 'paragraph' && clean(item.text)) children.push(bodyParagraph(item.text))
      else if (item.type === 'subheading') children.push(subheadingParagraph(item.text))
    })
    children.push(dividerParagraph())
  }

  // Follow-up email — formatted block
  if (emailBody) {
    children.push(headerBar('Follow-Up Email (Send Immediately)'))
    children.push(
      new Paragraph({
        spacing: { after: 80, line: 276 },
        indent: { left: 120, right: 120 },
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC', color: 'auto' },
        children: [new TextRun({ text: clean(emailBody), font: 'Calibri', size: 22, color: '1E293B' })],
      })
    )
    children.push(dividerParagraph())
  }

  addBulletSection(children, 'Internal Reality Check', realityCheck)

  // Win / Lose paths side by side as sequential sections
  if (winPath.length || losePath.length) {
    children.push(headerBar('Win Path vs Lose Path'))
    if (winPath.length) {
      children.push(subheadingParagraph('Win Path'))
      winPath.forEach((b) => children.push(bulletParagraph(b)))
    }
    if (losePath.length) {
      children.push(subheadingParagraph('Lose Path'))
      losePath.forEach((b) => children.push(bulletParagraph(b)))
    }
    children.push(dividerParagraph())
  }

  // Full output on page 2
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Full Execution Output', bold: true, color: '0B1F3A', font: 'Calibri', size: 32 })],
    })
  )

  addDetailedSectionsFromText(children, executionResult, new Set([
    'Deal Strategy Call',
    'Next Call Objectives (Non-Negotiable)',
    'Exact Questions to Ask (Next Call)',
    'Positioning to Push',
    'What to Avoid',
    'Commercial Strategy',
    'Stakeholder Strategy',
    'Follow-Up Email (Send Immediately)',
    'Internal Reality Check (Brutal)',
    'Win Path vs Lose Path',
  ]))

  const doc = new Document({
    creator: 'Risk Rising',
    title: clean(company || 'Execution Plan'),
    description: 'Execution strategy generated by Risk Rising',
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${clean(company) || 'execution'}_strategy.docx`)
}

// ── JSON export helper ──

function exportJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  saveAs(blob, filename)
}

// ── Label component ──

function FieldLabel({ children }) {
  return (
    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: MUTED, fontWeight: 600 }}>
      {children}
    </label>
  )
}

// ── Audit Trail component ──

const EVENT_LABELS = {
  pre_discovery_generated:  { label: 'Pre-Discovery Generated', colour: '#0B1F3A', bg: '#EAF1F8' },
  post_discovery_generated: { label: 'Post-Discovery Generated', colour: '#0B1F3A', bg: '#EAF1F8' },
  execution_generated:      { label: 'Execution Plan Generated', colour: '#0B1F3A', bg: '#EAF1F8' },
  file_uploaded:            { label: 'File Uploaded', colour: '#64748b', bg: '#f1f5f9' },
  transcript_added:         { label: 'Transcript Added', colour: '#64748b', bg: '#f1f5f9' },
  manual_note_added:        { label: 'Note Added', colour: '#334155', bg: '#f8fafc' },
  score_updated:            { label: 'Score Updated', colour: '#b45309', bg: '#fef9c3' },
  qualified_out:            { label: 'Qualified Out', colour: '#b91c1c', bg: '#fee2e2' },
  reopened:                 { label: 'Reopened', colour: '#15803d', bg: '#dcfce7' },
  manual_override:          { label: 'Manual Override', colour: '#7c3aed', bg: '#f5f3ff' },
}

function AuditTrail({ events, opportunityId, open, onToggle, manualNoteText, onNoteChange, onAddNote }) {
  if (!opportunityId && events.length === 0) return null

  const fmt = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const stageBadge = (stage) => {
    if (!stage) return null
    const labels = { pre_discovery: 'Pre-Discovery', post_discovery: 'Post-Discovery', execution: 'Execution' }
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 4,
        background: '#f1f5f9', color: '#475569', marginLeft: 6, flexShrink: 0,
      }}>
        {labels[stage] || stage}
      </span>
    )
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
    }}>
      {/* Header — always visible, click to toggle */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Opportunity Audit Trail</span>
          {events.length > 0 && (
            <span style={{
              background: NAVY, color: '#fff', fontSize: 11, fontWeight: 700,
              borderRadius: 999, padding: '1px 8px',
            }}>{events.length}</span>
          )}
          {opportunityId && (
            <span style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace' }}>
              {opportunityId.slice(0, 8)}…
            </span>
          )}
        </div>
        <span style={{ fontSize: 16, color: MUTED, lineHeight: 1 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 18px' }}>
          {/* Manual note input */}
          {opportunityId && (
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <input
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit',
                }}
                placeholder="Add a note to this opportunity…"
                value={manualNoteText}
                onChange={(e) => onNoteChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddNote() } }}
              />
              <button
                style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: manualNoteText.trim() ? NAVY : '#94a3b8',
                  color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                  cursor: manualNoteText.trim() ? 'pointer' : 'not-allowed',
                }}
                disabled={!manualNoteText.trim()}
                onClick={onAddNote}
              >
                Add Note
              </button>
            </div>
          )}

          {/* Event list */}
          {events.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13 }}>
              No events recorded yet. Events are created automatically when you generate output.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map((ev) => {
                const meta = EVENT_LABELS[ev.event_type] || { label: ev.event_type, colour: MUTED, bg: '#f8fafc' }
                const hasScoreChange = ev.score_before != null || ev.score_after != null
                return (
                  <div key={ev.event_id} style={{
                    padding: '10px 14px', borderRadius: 8,
                    border: `1px solid ${BORDER}`, background: '#fafafa',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{
                        background: meta.bg, color: meta.colour,
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}>
                        {meta.label}
                      </span>
                      {stageBadge(ev.stage)}
                      {hasScoreChange && (
                        <span style={{
                          fontSize: 12, color: MUTED, fontWeight: 600, flexShrink: 0,
                        }}>
                          {ev.score_before != null ? `${ev.score_before}%` : '—'}
                          {' → '}
                          {ev.score_after != null ? (
                            <span style={{ color: ev.score_after > (ev.score_before || 0) ? '#15803d' : ev.score_after < (ev.score_before || 0) ? '#b91c1c' : MUTED }}>
                              {ev.score_after}%
                            </span>
                          ) : '—'}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto', flexShrink: 0 }}>
                        {fmt(ev.timestamp)}
                      </span>
                    </div>
                    {ev.notes && (
                      <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, marginTop: 2 }}>
                        {ev.notes}
                      </div>
                    )}
                    {ev.output_snapshot?.resolved_snapshot?.stance && (
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        Stance: <strong>{ev.output_snapshot.resolved_snapshot.stance}</strong>
                        {ev.output_snapshot.resolved_snapshot.fit_level && (
                          <> · Fit: <strong>{ev.output_snapshot.resolved_snapshot.fit_level}</strong></>
                        )}
                      </div>
                    )}
                    {ev.output_snapshot?.deal_strategy?.call && (
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        Strategy: <strong>{ev.output_snapshot.deal_strategy.call}</strong>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Contact Capture component ──

const CONTACT_TYPES = ['Champion', 'User', 'Evaluator', 'Procurement', 'Economic Buyer', 'Technical Buyer', 'Influencer', 'Unknown']
const SENIORITY_LEVELS = ['C-Suite', 'VP', 'Director', 'Manager', 'Individual Contributor', 'Unknown']
const CONFIDENCE_LEVELS = ['High', 'Medium', 'Low']

function ContactCapture({
  open, onToggle,
  textInput, onTextChange,
  imageFiles, onImageChange, imageRef,
  proposedContacts, onUpdateProposed, onClear,
  savedContacts,
  loading, error,
  onExtract, onSave,
  opportunityId,
  // enrichment props
  enrichingId, onOpenEnrich, onCloseEnrich,
  enrichText, onEnrichTextChange,
  enrichImageFile, onEnrichImageChange, enrichImageRef,
  enrichLoading, enrichError, enrichResult,
  onEnrichSubmit,
}) {
  const hasPending = proposedContacts.length > 0
  const acceptedCount = proposedContacts.filter((c) => c._accepted).length

  const confColour = (c) => c === 'High' ? GREEN : c === 'Medium' ? AMBER : MUTED

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Contacts</span>
          {savedContacts.length > 0 && (
            <span style={{
              background: GREEN, color: '#fff', fontSize: 11, fontWeight: 700,
              borderRadius: 999, padding: '1px 8px',
            }}>{savedContacts.length} saved</span>
          )}
          {hasPending && (
            <span style={{
              background: AMBER, color: '#fff', fontSize: 11, fontWeight: 700,
              borderRadius: 999, padding: '1px 8px',
            }}>{proposedContacts.length} pending review</span>
          )}
        </div>
        <span style={{ fontSize: 16, color: MUTED, lineHeight: 1 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 18px' }}>

          {/* Input area — only shown when no pending contacts */}
          {!hasPending && (
            <>
              <div style={{ marginBottom: 10 }}>
                <textarea
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #cbd5e1', boxSizing: 'border-box',
                    fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6,
                    resize: 'vertical', minHeight: 80,
                  }}
                  placeholder="Paste names, titles, LinkedIn profiles, email signatures, or transcript snippets…"
                  value={textInput}
                  onChange={(e) => onTextChange(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div
                  onClick={() => imageRef.current?.click()}
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: '1px dashed #94a3b8',
                    cursor: 'pointer', fontSize: 13, color: MUTED, background: '#fafafa',
                  }}
                >
                  {imageFiles.length > 0 ? `${imageFiles.length} image(s) added` : '+ Add screenshot / photo'}
                </div>
                <input ref={imageRef} type="file" hidden multiple accept="image/*" onChange={onImageChange} />
                {imageFiles.length > 0 && (
                  <button
                    style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', padding: '4px 0' }}
                    onClick={() => onImageChange({ target: { files: [] } })}
                  >
                    Clear
                  </button>
                )}

                <button
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: (textInput.trim() || imageFiles.length > 0) && !loading ? NAVY : '#94a3b8',
                    color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                    cursor: (textInput.trim() || imageFiles.length > 0) && !loading ? 'pointer' : 'not-allowed',
                    marginLeft: 'auto',
                  }}
                  disabled={(!textInput.trim() && imageFiles.length === 0) || loading}
                  onClick={onExtract}
                >
                  {loading ? 'Extracting…' : 'Extract Contacts'}
                </button>
              </div>

              {error && (
                <div style={{ fontSize: 13, color: RED, marginBottom: 10 }}>{error}</div>
              )}
            </>
          )}

          {/* Pending review */}
          {hasPending && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Review extracted contacts — untick any you don't want to save
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {proposedContacts.map((c) => (
                  <div key={c._id} style={{
                    padding: '12px 14px', borderRadius: 8,
                    border: `1px solid ${c._accepted ? BORDER : '#f1f5f9'}`,
                    background: c._accepted ? '#fff' : '#f8fafc',
                    opacity: c._accepted ? 1 : 0.5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Accept toggle */}
                      <input
                        type="checkbox"
                        checked={c._accepted}
                        onChange={(e) => onUpdateProposed(c._id, '_accepted', e.target.checked)}
                        style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + confidence */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <input
                            style={{
                              fontWeight: 700, fontSize: 14, color: NAVY, border: 'none',
                              borderBottom: '1px solid #e2e8f0', background: 'transparent',
                              padding: '2px 0', fontFamily: 'inherit', flex: '1 1 140px', minWidth: 0,
                            }}
                            value={c.full_name}
                            onChange={(e) => onUpdateProposed(c._id, 'full_name', e.target.value)}
                            placeholder="Full name"
                          />
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: confColour(c.confidence),
                            textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                          }}>
                            {c.confidence} confidence
                          </span>
                        </div>

                        {/* Title + company */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <input
                            style={{
                              fontSize: 13, color: '#334155', border: 'none',
                              borderBottom: '1px solid #e2e8f0', background: 'transparent',
                              padding: '2px 0', fontFamily: 'inherit', flex: '2 1 160px', minWidth: 0,
                            }}
                            value={c.job_title}
                            onChange={(e) => onUpdateProposed(c._id, 'job_title', e.target.value)}
                            placeholder="Job title"
                          />
                          <input
                            style={{
                              fontSize: 13, color: MUTED, border: 'none',
                              borderBottom: '1px solid #e2e8f0', background: 'transparent',
                              padding: '2px 0', fontFamily: 'inherit', flex: '1 1 120px', minWidth: 0,
                            }}
                            value={c.company}
                            onChange={(e) => onUpdateProposed(c._id, 'company', e.target.value)}
                            placeholder="Company"
                          />
                        </div>

                        {/* Contact type + role in deal */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <select
                            value={c.contact_type}
                            onChange={(e) => onUpdateProposed(c._id, 'contact_type', e.target.value)}
                            style={{
                              fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6,
                              padding: '3px 8px', background: '#f8fafc', fontFamily: 'inherit',
                              color: '#334155', cursor: 'pointer',
                            }}
                          >
                            {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input
                            style={{
                              fontSize: 12, color: MUTED, border: '1px solid #e2e8f0',
                              borderRadius: 6, background: '#f8fafc', padding: '3px 8px',
                              fontFamily: 'inherit', flex: '1 1 120px', minWidth: 0,
                            }}
                            value={c.role_in_deal}
                            onChange={(e) => onUpdateProposed(c._id, 'role_in_deal', e.target.value)}
                            placeholder="Role in deal (optional)"
                          />
                        </div>

                        {/* Email + LinkedIn — only show if populated or as placeholders */}
                        {(c.business_email || c.linkedin_url) && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {c.business_email && (
                              <span style={{ fontSize: 12, color: MUTED }}>{c.business_email}</span>
                            )}
                            {c.linkedin_url && (
                              <a href={c.linkedin_url.startsWith('http') ? c.linkedin_url : `https://${c.linkedin_url}`}
                                target="_blank" rel="noreferrer"
                                style={{ fontSize: 12, color: NAVY }}>
                                LinkedIn ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: acceptedCount > 0 && !loading ? NAVY : '#94a3b8',
                    color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                    cursor: acceptedCount > 0 && !loading ? 'pointer' : 'not-allowed',
                  }}
                  disabled={acceptedCount === 0 || loading}
                  onClick={onSave}
                >
                  {loading ? 'Saving…' : `Save ${acceptedCount} Contact${acceptedCount !== 1 ? 's' : ''}`}
                </button>
                <button
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    border: '1px solid #cbd5e1', background: '#fff',
                    fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                  }}
                  onClick={() => onClear()}
                >
                  Start Over
                </button>
              </div>
              {error && <div style={{ fontSize: 13, color: RED, marginTop: 8 }}>{error}</div>}
            </div>
          )}

          {/* Saved contacts compact table */}
          {savedContacts.length > 0 && !hasPending && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Saved contacts ({savedContacts.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Name', 'Title', 'Company', 'Type', 'Confidence', ''].map((h) => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {savedContacts.map((c, i) => (
                      <React.Fragment key={c.contact_id || i}>
                        {/* Main row */}
                        <tr style={{ borderBottom: enrichingId === c.contact_id ? 'none' : `1px solid #f1f5f9` }}>
                          <td style={{ padding: '7px 10px', fontWeight: 600, color: NAVY }}>{c.full_name}</td>
                          <td style={{ padding: '7px 10px', color: '#334155' }}>{c.job_title || '—'}</td>
                          <td style={{ padding: '7px 10px', color: MUTED }}>{c.company || '—'}</td>
                          <td style={{ padding: '7px 10px', color: MUTED }}>{c.contact_type || '—'}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: confColour(c.confidence) }}>
                              {c.confidence || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            {enrichingId === c.contact_id ? (
                              <button
                                onClick={onCloseEnrich}
                                style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', padding: 0 }}
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                onClick={() => onOpenEnrich(c.contact_id)}
                                style={{
                                  background: 'none', border: '1px solid #cbd5e1',
                                  borderRadius: 6, color: NAVY, fontSize: 11,
                                  fontWeight: 600, cursor: 'pointer', padding: '2px 8px',
                                  fontFamily: 'inherit',
                                }}
                              >
                                Enrich
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Inline enrichment row */}
                        {enrichingId === c.contact_id && (
                          <tr>
                            <td colSpan={6} style={{ padding: '0 0 12px 0', borderBottom: `1px solid #f1f5f9` }}>
                              <div style={{
                                background: NAVY_LIGHT, borderRadius: 8, padding: '12px 14px',
                                margin: '0 10px',
                              }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                                  Enrich {c.full_name}
                                </div>

                                <textarea
                                  style={{
                                    width: '100%', padding: '8px 10px', borderRadius: 6,
                                    border: '1px solid #cbd5e1', boxSizing: 'border-box',
                                    fontSize: 12, fontFamily: 'inherit', lineHeight: 1.5,
                                    resize: 'vertical', minHeight: 60, marginBottom: 8,
                                  }}
                                  placeholder="Paste LinkedIn profile, bio, email signature, or any relevant text…"
                                  value={enrichText}
                                  onChange={(e) => onEnrichTextChange(e.target.value)}
                                />

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <div
                                    onClick={() => enrichImageRef.current?.click()}
                                    style={{
                                      padding: '5px 10px', borderRadius: 6, border: '1px dashed #94a3b8',
                                      cursor: 'pointer', fontSize: 11, color: MUTED, background: '#fff',
                                    }}
                                  >
                                    {enrichImageFile ? enrichImageFile.name : '+ Screenshot'}
                                  </div>
                                  <input
                                    ref={enrichImageRef}
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={onEnrichImageChange}
                                  />
                                  {enrichImageFile && (
                                    <button
                                      style={{ background: 'none', border: 'none', color: MUTED, fontSize: 11, cursor: 'pointer', padding: 0 }}
                                      onClick={() => onEnrichImageChange({ target: { files: [] } })}
                                    >
                                      Clear
                                    </button>
                                  )}

                                  <button
                                    style={{
                                      padding: '6px 12px', borderRadius: 6, border: 'none',
                                      background: (enrichText.trim() || enrichImageFile) && !enrichLoading ? NAVY : '#94a3b8',
                                      color: '#fff', fontWeight: 600, fontSize: 12,
                                      fontFamily: 'inherit', cursor: 'pointer', marginLeft: 'auto',
                                    }}
                                    disabled={(!enrichText.trim() && !enrichImageFile) || enrichLoading}
                                    onClick={() => onEnrichSubmit(c.contact_id)}
                                  >
                                    {enrichLoading ? 'Enriching…' : 'Enrich'}
                                  </button>
                                </div>

                                {enrichError && (
                                  <div style={{ fontSize: 12, color: RED, marginTop: 6 }}>{enrichError}</div>
                                )}
                                {enrichResult !== null && (
                                  <div style={{ fontSize: 12, color: GREEN, marginTop: 6, fontWeight: 600 }}>
                                    {enrichResult.length > 0
                                      ? `Updated: ${enrichResult.join(', ')}`
                                      : 'No new fields to update — contact is already fully enriched.'}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {opportunityId && (
                <div style={{ marginTop: 10 }}>
                  <a
                    href={getContactsExportUrl(opportunityId)}
                    download
                    style={{
                      fontSize: 13, fontWeight: 600, color: NAVY,
                      textDecoration: 'none', padding: '6px 12px',
                      border: '1px solid #cbd5e1', borderRadius: 8,
                      background: '#fff', display: 'inline-block',
                    }}
                  >
                    Export Contacts CSV
                  </a>
                </div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  )
}

// ── DashboardCard component ──
// Renders the new dashboard JSON contract returned by the backend.
// Pure presentational. Returns null if no dashboard data is present, so the
// rest of the existing UI keeps rendering exactly as before.

// ── RichBriefingPanel component ──
// Displays a generated rich briefing inline. Uses a simple monospace
// pre-wrapped renderer — Markdown is preserved verbatim so the user can
// scan it, then download as .md for proper rendering elsewhere.
// The download button is the primary export path.

function RichBriefingPanel({ briefing, company, stage, loading, error, onGenerate, onDownload, hasDashboard }) {
  const stageLabel = stage === 'post_discovery' ? 'Post-Discovery' : 'Pre-Discovery'
  const buttonLabel = briefing ? `Regenerate Rich Briefing` : `Generate Rich Briefing`

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: '16px 18px',
      marginBottom: 16,
      boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: briefing ? 14 : 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Rich Briefing — {stageLabel}
          </div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4, maxWidth: 540 }}>
            A long-form briefing pack derived from the dashboard. The dashboard remains the source of truth — this document explains and expands it without recalculating anything.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {briefing && (
            <button
              style={{ ...S.secondaryButton, fontSize: 12, padding: '7px 12px' }}
              onClick={onDownload}
            >
              Download .md
            </button>
          )}
          <button
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: !hasDashboard || loading ? '#94a3b8' : NAVY,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: !hasDashboard || loading ? 'not-allowed' : 'pointer',
            }}
            disabled={!hasDashboard || loading}
            onClick={onGenerate}
            title={!hasDashboard ? 'Generate a dashboard first' : ''}
          >
            {loading ? 'Generating… (~30s)' : buttonLabel}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: RED, marginBottom: briefing ? 10 : 0, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, border: `1px solid #fecaca` }}>
          {error}
        </div>
      )}

      {loading && !briefing && (
        <div style={{ fontSize: 13, color: MUTED, padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: `1px solid ${BORDER}` }}>
          Producing a long-form briefing pack… this typically takes 20–40 seconds because the model is writing a full structured document. The dashboard above is unchanged and will not be affected.
        </div>
      )}

      {briefing && (
        <div style={{
          maxHeight: 520,
          overflowY: 'auto',
          background: '#0f172a',
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: '14px 16px',
        }}>
          <pre style={{
            margin: 0,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 12.5,
            lineHeight: 1.55,
            color: '#e2e8f0',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}>
            {briefing}
          </pre>
        </div>
      )}
    </div>
  )
}

function DashboardCard({ dashboard, sourceNotes, title }) {
  if (!dashboard) return null

  const score = typeof dashboard.prospect_match_score === 'number' ? dashboard.prospect_match_score : 0
  const scoreCol = score >= 70 ? GREEN : score >= 50 ? AMBER : RED
  const scoreBg = score >= 70 ? '#dcfce7' : score >= 50 ? '#fef9c3' : '#fee2e2'

  const dirArrow = dashboard.score_direction === 'Improving' ? '↑'
    : dashboard.score_direction === 'Declining' ? '↓'
    : dashboard.score_direction === 'Flat' ? '→' : ''
  const dirCol = dashboard.score_direction === 'Improving' ? GREEN
    : dashboard.score_direction === 'Declining' ? RED : MUTED

  const statusCol = (status, type) => {
    const s = (status || '').toLowerCase()
    if (type === 'fit') {
      if (s === 'strong') return GREEN
      if (s === 'weak') return RED
      return AMBER
    }
    if (type === 'scope') {
      if (s === 'strategic' || s === 'expanding') return GREEN
      if (s === 'narrow') return AMBER
      return MUTED
    }
    if (type === 'competition') {
      if (s === 'none identified') return GREEN
      if (s === 'active competitor' || s === 'incumbent tool') return RED
      return MUTED
    }
    if (type === 'budget') {
      if (s === 'confirmed') return GREEN
      if (s === 'likely' || s === 'unclear') return AMBER
      return RED
    }
    if (type === 'sponsor') {
      if (s === 'confirmed') return GREEN
      if (s === 'likely') return AMBER
      if (s === 'missing') return RED
      return MUTED
    }
    if (type === 'event') {
      if (s === 'strong') return GREEN
      if (s === 'weak') return AMBER
      if (s === 'none evidenced') return RED
      return MUTED
    }
    return MUTED
  }

  const Field = ({ label, status, statusType, detail }) => (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: '#f8fafc', border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        display: 'inline-block',
        background: '#fff',
        color: statusCol(status, statusType),
        border: `1px solid ${statusCol(status, statusType)}`,
        fontSize: 12,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        marginBottom: detail ? 6 : 0,
      }}>
        {status || '—'}
      </div>
      {detail && (
        <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>{detail}</div>
      )}
    </div>
  )

  const sourceCount = (sourceNotes?.confirmed?.length || 0) + (sourceNotes?.unknown?.length || 0) + (sourceNotes?.assumptions?.length || 0)

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: '20px 22px',
      marginBottom: 16,
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {title || 'Deal Dashboard'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: scoreCol, lineHeight: 1 }}>{score}%</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match Score</span>
            {dashboard.score_direction && dashboard.score_direction !== 'New' && (
              <span style={{
                background: scoreBg,
                color: dirCol,
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 999,
              }}>
                {dirArrow} {dashboard.score_direction}
              </span>
            )}
            {dashboard.score_direction === 'New' && (
              <span style={{
                background: '#f1f5f9',
                color: MUTED,
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 999,
              }}>
                New
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
        <Field label="LogicGate Use Case Fit" status={dashboard.logicgate_use_case_fit_level} statusType="fit" detail={dashboard.logicgate_use_case_fit_reason} />
        <Field label="Implementation Scope & Vision" status={dashboard.implementation_scope_and_vision} statusType="scope" detail={dashboard.implementation_scope_reason} />
        <Field label="Competition" status={dashboard.competition_status} statusType="competition" detail={dashboard.competition_detail} />
        <Field label="Budget" status={dashboard.budget_status} statusType="budget" detail={dashboard.budget_detail} />
        <Field label="Executive Sponsors" status={dashboard.executive_sponsors} statusType="sponsor" detail={dashboard.executive_sponsor_detail} />
        <Field label="Compelling Event" status={dashboard.compelling_event} statusType="event" detail={dashboard.compelling_event_detail} />
      </div>

      {dashboard.next_steps && (
        <div style={{
          background: NAVY,
          color: '#fff',
          padding: '12px 14px',
          borderRadius: 8,
          marginBottom: sourceCount > 0 ? 14 : 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Next Steps
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{dashboard.next_steps}</div>
        </div>
      )}

      {sourceCount > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            color: MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '6px 0',
          }}>
            Source notes ({sourceCount})
          </summary>
          <div style={{ padding: '8px 0 4px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {sourceNotes?.confirmed?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginBottom: 5 }}>Confirmed</div>
                {sourceNotes.confirmed.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#334155', lineHeight: 1.45, marginBottom: 4 }}>• {b}</div>
                ))}
              </div>
            )}
            {sourceNotes?.unknown?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, marginBottom: 5 }}>Unknown</div>
                {sourceNotes.unknown.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#334155', lineHeight: 1.45, marginBottom: 4 }}>• {b}</div>
                ))}
              </div>
            )}
            {sourceNotes?.assumptions?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5 }}>Assumptions</div>
                {sourceNotes.assumptions.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#334155', lineHeight: 1.45, marginBottom: 4 }}>• {b}</div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

// ── DealDashboard component ──
// Renders after pre-discovery generation. Accepts all resolved derived values
// from the parent so it can be a pure presentational component.

function DealDashboard({
  // Score + snapshot
  stabilisedScore, numScore, fitLevel, stance, rationale,
  productFit, commercialFit, dealMaturity, icpFit,
  // Dashboard summary from API (may be null for older outputs)
  dashboardSummary,
  // Derived arrays
  executiveSummary, topRisks, reasonsToWin,
  structured,
  discoveryNarrative,
  // Full briefing content
  aeStance, aeWhy,
  likelySponsor, missingPeople, howToBringThemIn,
  demoFocus, commercialRecommendation,
  prep,
  // Export / scorecard controls
  onExportDocx, onExportJson, onScorecard, scorecardLoading, hasScorecard,
  preScorecard, onDismissScorecard,
  preDeltaNotes, onDeltaNotesChange, onDeltaUpdate, deltaLoading, preDeltaResult,
  onContinue,
}) {
  const [fullOpen, setFullOpen] = useState(false)
  const [meddpiccOpen, setMeddpiccOpen] = useState(false)

  // Resolve momentum — prefer dashboardSummary, fall back to structured
  const momentum = dashboardSummary?.momentum || structured?.momentum || ''

  // Resolve next action — prefer dashboardSummary, fall back to structured next_move
  const nextAction = dashboardSummary?.next_action ||
    (structured?.next_move?.action && !isWeakText(structured.next_move.action) ? structured.next_move.action : '')
  const nextConstraint = structured?.next_move?.constraint && !isWeakText(structured.next_move.constraint)
    ? structured.next_move.constraint : ''

  // Resolve questions — prefer dashboardSummary.next_call_questions, fall back to narrative
  const topQuestions = (() => {
    if (dashboardSummary?.next_call_questions?.length) return dashboardSummary.next_call_questions.slice(0, 5)
    const prioritySteps = discoveryNarrative.filter(s =>
      s.step && (s.step.toLowerCase().includes('stakeholder') || s.step.toLowerCase().includes('trigger') || s.step.toLowerCase().includes('urgency'))
    )
    const steps = prioritySteps.length > 0 ? prioritySteps : discoveryNarrative.filter(s => s.questions?.length > 0)
    return steps.flatMap(s => s.questions || []).slice(0, 5)
  })()

  // Stakeholder snapshot
  const stakeholder = dashboardSummary?.stakeholder_snapshot || structured?.stakeholder_summary || {}

  const momentumColour = momentum === 'Increasing' ? GREEN : momentum === 'Declining' ? RED : MUTED

  function CollapsibleSection({ title, open, onToggle, children }) {
    return (
      <div style={{ borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={onToggle}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{title}</span>
          <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{open ? '▲ Collapse' : '▼ Expand'}</span>
        </button>
        {open && <div style={{ paddingBottom: 20 }}>{children}</div>}
      </div>
    )
  }

  function BulletList({ items, colour = '#334155', arrow = '▸', arrowColour = NAVY, emptyMsg = '' }) {
    if (!items?.length) return emptyMsg ? <div style={{ fontSize: 13, color: MUTED }}>{emptyMsg}</div> : null
    return (
      <div>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ color: arrowColour, flexShrink: 0, marginTop: 1 }}>{arrow}</span>
            <span style={{ color: colour }}>{removeBulletPrefix(item)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* ── TOP STRIP: Score + Fit + Stance + Momentum ── */}
      <div style={{
        background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
        padding: '20px 24px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
      }}>
        {/* Score */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: scoreColour(numScore), lineHeight: 1 }}>
            {stabilisedScore !== null ? stabilisedScore : '—'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>Match Score</div>
          <div style={{ height: 4, background: BORDER, borderRadius: 999, overflow: 'hidden', marginTop: 6, width: 72, margin: '6px auto 0' }}>
            <div style={{ height: '100%', width: `${numScore}%`, background: scoreColour(numScore), borderRadius: 999 }} />
          </div>
        </div>

        <div style={{ width: 1, height: 52, background: BORDER, flexShrink: 0 }} />

        {/* Fit + Stance */}
        <div style={{ flexShrink: 0 }}>
          {fitLevel && <div style={{ ...S.fitPill(fitLevel), marginBottom: 6, display: 'inline-block' }}>{fitLevel}</div>}
          {stance && !isWeakText(stance) && (
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{stance}</div>
          )}
        </div>

        {/* Momentum */}
        {momentum && (
          <>
            <div style={{ width: 1, height: 40, background: BORDER, flexShrink: 0 }} />
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Momentum</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: momentumColour }}>
                {momentum === 'Increasing' ? '↑' : momentum === 'Declining' ? '↓' : '→'} {momentum}
              </div>
            </div>
          </>
        )}

        {/* Dimensions compact */}
        {(productFit || commercialFit || dealMaturity || icpFit) && (
          <>
            <div style={{ width: 1, height: 52, background: BORDER, flexShrink: 0 }} />
            <div style={{ flexShrink: 0 }}>
              {[
                { label: 'Product Fit', value: productFit },
                { label: 'Commercial Fit', value: commercialFit },
                { label: 'Deal Maturity', value: dealMaturity },
                { label: 'ICP Fit', value: icpFit },
              ].map(({ label: lbl, value }) =>
                value && !isWeakText(value) ? (
                  <div key={lbl} style={{ display: 'flex', gap: 8, marginBottom: 3, fontSize: 12 }}>
                    <span style={{ color: MUTED, minWidth: 105 }}>{lbl}</span>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>{value.split(' ')[0]}</span>
                  </div>
                ) : null
              )}
            </div>
          </>
        )}

        {/* Rationale — fills remaining space */}
        {rationale && !isWeakText(rationale) && (
          <>
            <div style={{ width: 1, height: 52, background: BORDER, flexShrink: 0 }} />
            <div style={{ flex: '1 1 220px', fontSize: 13, color: '#334155', lineHeight: 1.55 }}>{rationale}</div>
          </>
        )}
      </div>

      {/* ── MAIN TWO-COLUMN BODY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* LEFT: Executive Summary + Top Risks + Reasons to Win */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Executive Summary */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Executive Summary</div>
            <BulletList items={executiveSummary.slice(0, 4)} emptyMsg="No summary available." />
          </div>

          {/* Top Risks */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Top Risks</div>
            <BulletList items={topRisks.slice(0, 3)} arrowColour={RED} emptyMsg="No risks identified." />
          </div>

          {/* Reasons to Win */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Reasons to Win</div>
            <BulletList items={reasonsToWin.slice(0, 3)} arrowColour={GREEN} emptyMsg="No win themes." />
          </div>
        </div>

        {/* RIGHT: Next Action + Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Next Action — highlighted */}
          <div style={{
            background: nextAction ? NAVY : '#fff',
            border: `1px solid ${nextAction ? NAVY : BORDER}`,
            borderRadius: 12, padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: nextAction ? 'rgba(255,255,255,0.6)' : MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Next Action</div>
            {nextAction ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.5, marginBottom: nextConstraint ? 10 : 0 }}>
                  {nextAction}
                </div>
                {nextConstraint && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8 }}>
                    Not until: {nextConstraint}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: MUTED }}>No next action defined.</div>
            )}
          </div>

          {/* Stakeholder Snapshot */}
          {(stakeholder.current_shape || stakeholder.likely_sponsor || stakeholder.champion_status) && (
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Stakeholder Snapshot</div>
              {[
                { label: 'Shape', value: stakeholder.current_shape },
                { label: 'Missing', value: stakeholder.missing_roles },
                { label: 'Likely Sponsor', value: stakeholder.likely_sponsor },
                { label: 'Champion', value: stakeholder.champion_status },
              ].map(({ label: lbl, value }) =>
                value && !isWeakText(String(value)) ? (
                  <div key={lbl} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13 }}>
                    <span style={{ color: MUTED, minWidth: 100, flexShrink: 0 }}>{lbl}</span>
                    <span style={{ color: '#334155', fontWeight: 600 }}>{Array.isArray(value) ? value.join(', ') : value}</span>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Discovery Questions */}
          {topQuestions.length > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Top Discovery Questions</div>
              {topQuestions.map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ color: NAVY, fontWeight: 700, flexShrink: 0, minWidth: 22 }}>Q{i + 1}</span>
                  <span style={{ color: '#334155' }}>{removeBulletPrefix(q)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ACTION BAR ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button style={S.secondaryButton} onClick={onExportDocx}>Download DOCX</button>
        <button style={S.secondaryButton} onClick={onExportJson}>Download JSON</button>
        <button
          style={{ ...S.secondaryButton, opacity: scorecardLoading ? 0.6 : 1, cursor: scorecardLoading ? 'not-allowed' : 'pointer' }}
          disabled={scorecardLoading}
          onClick={onScorecard}
        >
          {scorecardLoading ? 'Scoring…' : hasScorecard ? 'Refresh Scorecard' : 'Scorecard'}
        </button>
        <button style={{ ...S.button, background: NAVY, color: '#fff', cursor: 'pointer', marginLeft: 'auto' }} onClick={onContinue}>
          Continue to Post-Discovery →
        </button>
      </div>

      {/* Scorecard + delta — shown when generated */}
      {preScorecard && (
        <>
          <ScorecardPanel scorecard={preScorecard} onDismiss={onDismissScorecard} />
          <DeltaScoreWidget
            currentScore={preDeltaResult?.deal_score ?? preScorecard.overall_score}
            stage="pre_discovery"
            notes={preDeltaNotes}
            onNotesChange={onDeltaNotesChange}
            onUpdate={onDeltaUpdate}
            loading={deltaLoading}
            result={preDeltaResult}
          />
        </>
      )}

      {/* ── COLLAPSIBLE SECTIONS ── */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '0 20px', marginBottom: 12 }}>

        <CollapsibleSection title="Full Analysis" open={fullOpen} onToggle={() => setFullOpen(v => !v)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={S.sectionHeaderBar}>Demo Focus</div>
              {renderBullets(demoFocus, 'No demo focus.')}
            </div>
            <div>
              <div style={S.sectionHeaderBar}>Commercial Recommendation</div>
              {renderBullets(commercialRecommendation, 'No commercial recommendation.')}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={S.sectionHeaderBar}>AE Recommendation</div>
              {aeStance && !isWeakText(aeStance) && <div style={{ fontWeight: 700, color: NAVY, marginBottom: 6 }}>{aeStance}</div>}
              {aeWhy && !isWeakText(aeWhy) && <div style={S.bodyText}>{aeWhy}</div>}
            </div>
            <div>
              <div style={S.sectionHeaderBar}>Sponsor Strategy</div>
              {likelySponsor && !isWeakText(likelySponsor) && <div style={{ marginBottom: 8, fontSize: 13 }}><strong>Likely Sponsor:</strong> {likelySponsor}</div>}
              {missingPeople.length > 0 && <><div style={{ fontWeight: 700, fontSize: 12, color: MUTED, marginBottom: 4 }}>Missing Roles</div>{renderBullets(missingPeople)}</>}
              {howToBringThemIn.length > 0 && <><div style={{ fontWeight: 700, fontSize: 12, color: MUTED, marginTop: 10, marginBottom: 4 }}>How to Engage</div>{renderBullets(howToBringThemIn)}</>}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={S.sectionHeaderBar}>Deal Intelligence</div>
            <DealIntelligencePanel structured={structured} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={S.sectionHeaderBar}>Discovery Call Narrative</div>
            {discoveryNarrative.map((step, idx) => (
              <div key={idx} style={{ marginBottom: 10, padding: '10px 12px', background: idx % 2 === 0 ? '#f8fafc' : '#fff', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: 3, fontSize: 13 }}>{step.step}</div>
                {step.purpose && !isWeakText(step.purpose) && <div style={{ color: MUTED, fontSize: 12, fontStyle: 'italic', marginBottom: 5 }}>{step.purpose}</div>}
                {renderBullets(step.questions, 'No questions.')}
              </div>
            ))}
          </div>
          <div style={S.outputWrap}>{renderDetailedSections(prep)}</div>
        </CollapsibleSection>

        <CollapsibleSection title="MEDDPICC" open={meddpiccOpen} onToggle={() => setMeddpiccOpen(v => !v)}>
          {structured?.meddpicc ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries(structured.meddpicc).map(([key, val]) => {
                if (!val || isWeakText(val)) return null
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                return (
                  <div key={key} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{val}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: MUTED }}>MEDDPICC data not available.</div>
          )}
        </CollapsibleSection>

      </div>
    </div>
  )
}

// ── Persistence helpers ──
// Save and restore the current opportunity state across browser refreshes.
// Stores only the fields that are safe and useful to rehydrate — nothing
// transient (loading flags, errors, file uploads), nothing sensitive
// (no API keys), and no derived values that can be recomputed from the
// stored fields. The stored payload is intentionally small.

const PERSIST_KEY = 'logicgate_rr_current_opportunity'
const PERSIST_VERSION = 1

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Version gate — if the stored format is older than the app expects,
    // discard rather than try to upgrade in-place. Cheap and safe.
    if (parsed?.__v !== PERSIST_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function persistState(payload) {
  try {
    const safe = { __v: PERSIST_VERSION, ...payload, savedAt: new Date().toISOString() }
    localStorage.setItem(PERSIST_KEY, JSON.stringify(safe))
  } catch {
    // Quota exceeded or storage unavailable — silently skip.
    // Persistence is best-effort, not load-bearing.
  }
}

function clearPersistedState() {
  try { localStorage.removeItem(PERSIST_KEY) } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// OperationalMetricsPanel — V1.5a
// Renders a per-app grouped capture form for operational metrics. Values
// flow into value driver suggestions at proposal time as ground-truth
// overrides. Used in both post-discovery and post-demo views — the `stage`
// prop controls how new captures are stamped.
// ─────────────────────────────────────────────────────────────────────────
function OperationalMetricsPanel({ library, metrics, stage, onEdit, onClear, disabled }) {
  if (!Array.isArray(library) || library.length === 0) return null

  // Group metrics by app for readability
  const byApp = library.reduce((acc, m) => {
    const key = m.app || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})
  const appOrder = Object.keys(byApp)

  const capturedCount = library.reduce((acc, m) => {
    const e = metrics?.[m.id]
    if (e && e.value !== '' && e.value !== null && e.value !== undefined) acc += 1
    return acc
  }, 0)

  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: '16px 18px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Operational Metrics
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            Facts about the prospect's current state. Captured here, used as ground truth in the proposal's value drivers.
          </div>
        </div>
        <div style={{ fontSize: 11, color: MUTED, padding: '4px 10px', background: '#F1F5F9', borderRadius: 12 }}>
          {capturedCount} of {library.length} captured
        </div>
      </div>

      {appOrder.map((appName) => (
        <div key={appName} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
            {appName}
          </div>
          {byApp[appName].map((m) => {
            const captured = metrics?.[m.id] || {}
            const hasValue = captured.value !== '' && captured.value !== null && captured.value !== undefined
            return (
              <div key={m.id} style={{
                border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px',
                marginBottom: 6, background: hasValue ? '#F8FAFC' : '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                      {m.label}
                    </div>
                    {m.helper && (
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>
                        {m.helper}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.type === 'currency' && <span style={{ color: MUTED, fontSize: 12 }}>$</span>}
                    <input
                      type="number"
                      min="0"
                      step={m.type === 'currency' ? '50' : '1'}
                      value={captured.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? '' : parseFloat(e.target.value)
                        onEdit(m.id, 'value', isNaN(v) ? '' : v, stage)
                      }}
                      disabled={disabled}
                      style={{
                        width: 100, padding: '6px 8px', borderRadius: 6,
                        border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                    <span style={{ color: MUTED, fontSize: 11 }}>{m.suffix}</span>
                  </div>
                </div>
                {/* Notes + provenance footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Notes (optional) — e.g. 'confirmed by CRO'"
                    value={captured.notes || ''}
                    onChange={(e) => onEdit(m.id, 'notes', e.target.value, stage)}
                    disabled={disabled}
                    style={{
                      flex: 1, minWidth: 200, padding: '5px 8px', borderRadius: 6,
                      border: `1px solid ${BORDER}`, fontSize: 12, fontFamily: 'inherit',
                      background: 'transparent',
                    }}
                  />
                  {hasValue && captured.capturedStage && (
                    <span style={{
                      fontSize: 10, color: MUTED, padding: '2px 6px',
                      background: '#F1F5F9', borderRadius: 4,
                    }}>
                      from {captured.capturedStage.replace('_', '-')}
                    </span>
                  )}
                  {hasValue && (
                    <button
                      onClick={() => onClear(m.id)}
                      disabled={disabled}
                      style={{
                        padding: '3px 8px', borderRadius: 6, border: `1px solid ${BORDER}`,
                        background: '#fff', color: MUTED, fontSize: 10, fontFamily: 'inherit',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Main App ──

export default function LogicGateModule() {
  const fileRef = useRef(null)

  // ── Restore-from-localStorage flow ──
  // Instead of restoring directly into state on mount, we hold the saved
  // snapshot in `pendingRestore` and surface a Resume / Discard banner.
  // The user explicitly chooses whether to resume — fresh sessions never
  // get auto-overwritten by stale data. The banner only appears if there's
  // actually a saved snapshot.
  //
  // After the user chooses (or the snapshot is empty), `restoreDecided`
  // flips to true and the persistence effect is allowed to write again.
  const [pendingRestore, setPendingRestore] = useState(null) // null | parsed snapshot
  const [restoreDecided, setRestoreDecided] = useState(false)
  // Legacy scoring banner — set when a resumed snapshot has dashboards from
  // the old scoring model (no scoring_model_version field). The user can
  // either regenerate (recommended) or dismiss to keep the old scores.
  const [legacyScoringDetected, setLegacyScoringDetected] = useState(null) // null | { pre, post }

  useEffect(() => {
    const saved = loadPersistedState()
    // Treat as "has data" only if it actually contains something useful,
    // otherwise just mark decided and move on.
    const hasUsefulData = Boolean(
      saved && (
        saved.dashboard ||
        saved.postDashboard ||
        (saved.company && saved.company.trim()) ||
        (saved.prep && saved.prep.trim()) ||
        (saved.postResult && saved.postResult.trim())
      )
    )
    if (hasUsefulData) {
      setPendingRestore(saved)
    } else {
      setRestoreDecided(true)
    }
  }, [])

  // ── Mode ──
  const [mode, setMode] = useState('pre') // 'pre' | 'post' | 'demo' | 'proposal' | 'strategy' | 'sow'

  // ── Opportunity / audit trail state ──
  const [opportunityId, setOpportunityId] = useState(null)
  const [auditEvents, setAuditEvents] = useState([])
  const [auditOpen, setAuditOpen] = useState(false)
  const [manualNoteText, setManualNoteText] = useState('')

  // ── Contact capture state ──
  const [contactsOpen, setContactsOpen] = useState(false)
  const [contactTextInput, setContactTextInput] = useState('')
  const [contactImageFiles, setContactImageFiles] = useState([])
  const [proposedContacts, setProposedContacts] = useState([])   // pending review
  const [savedContacts, setSavedContacts] = useState([])         // confirmed saved
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState('')
  const contactImageRef = useRef(null)

  // ── Contact enrichment state ──
  const [enrichingId, setEnrichingId] = useState(null)           // contact_id being enriched
  const [enrichText, setEnrichText] = useState('')
  const [enrichImageFile, setEnrichImageFile] = useState(null)
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichResult, setEnrichResult] = useState(null)         // { fields_updated }
  const [enrichError, setEnrichError] = useState('')
  const enrichImageRef = useRef(null)

  // ── Pre-discovery state ──
  // (initialisers read from `persisted` so a browser refresh restores the
  // current opportunity without re-calling Claude.)
  const [company, setCompany] = useState('')
  const [sdrNotes, setSdrNotes] = useState('')
  const [emailNotes, setEmailNotes] = useState('')
  const [uploadedText, setUploadedText] = useState('')
  const [fileNames, setFileNames] = useState([]) // intentionally not persisted — file objects can't be re-hydrated
  const [prep, setPrep] = useState('')
  const [structured, setStructured] = useState(null)
  const [resolvedSnapshot, setResolvedSnapshot] = useState(null)
  const [prepPacket, setPrepPacket] = useState(null)
  const [dashboardSummary, setDashboardSummary] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [sourceNotes, setSourceNotes] = useState(null)

  // ── Post-discovery state ──
  const [postCompany, setPostCompany] = useState('')
  const [previousPrep, setPreviousPrep] = useState('')
  const [transcript, setTranscript] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [postUploadedText, setPostUploadedText] = useState('')
  const [postFileNames, setPostFileNames] = useState([]) // intentionally not persisted
  const [postResult, setPostResult] = useState('')
  const [postStructured, setPostStructured] = useState(null)
  const [postResolvedSnapshot, setPostResolvedSnapshot] = useState(null)
  const [postDiscoveryPacket, setPostDiscoveryPacket] = useState(null)
  const [postDashboard, setPostDashboard] = useState(null)
  const [postSourceNotes, setPostSourceNotes] = useState(null)

  // ── Deal strategy state ──
  const [strategyInput, setStrategyInput] = useState('')
  const [strategyResult, setStrategyResult] = useState('')
  const [strategyStructured, setStrategyStructured] = useState(null)
  const [executionPacket, setExecutionPacket] = useState(null)

  // ── Scorecard state ──
  const [preScorecard, setPreScorecard] = useState(null)
  const [postScorecard, setPostScorecard] = useState(null)
  const [execScorecard, setExecScorecard] = useState(null)
  const [scorecardLoading, setScorecardLoading] = useState(false)

  // ── Delta score state (update score based on new information) ──
  const [preDeltaNotes, setPreDeltaNotes] = useState('')
  const [postDeltaNotes, setPostDeltaNotes] = useState('')
  const [execDeltaNotes, setExecDeltaNotes] = useState('')
  const [deltaLoading, setDeltaLoading] = useState(false)
  const [preDeltaResult, setPreDeltaResult] = useState(null)   // { deal_score, delta }
  const [postDeltaResult, setPostDeltaResult] = useState(null)
  const [execDeltaResult, setExecDeltaResult] = useState(null)

  // ── Shared UI state ──
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // ── Dashboard detail expand state ──
  const [preDetailOpen, setPreDetailOpen] = useState(false)
  const [postDetailOpen, setPostDetailOpen] = useState(false)
  const [stratDetailOpen, setStratDetailOpen] = useState(false)

  // ── SoW generator state ──
  const [sowProfiles, setSowProfiles] = useState([])
  const [sowSelectedProfile, setSowSelectedProfile] = useState(null)   // full profile object
  const [sowProfileId, setSowProfileId] = useState('')
  const [sowSelectedModules, setSowSelectedModules] = useState([])
  const [sowSelectedComplexity, setSowSelectedComplexity] = useState([])
  const [sowInputs, setSowInputs] = useState({})                       // { field_id: value }
  const [sowResult, setSowResult] = useState(null)                     // full API response
  const [sowLoading, setSowLoading] = useState(false)
  const [sowError, setSowError] = useState('')

  // ── Enrichment state ──
  const [enrichmentSections, setEnrichmentSections] = useState([])     // [{ title, bullets }]
  const [enrichingKey, setEnrichingKey] = useState(null)               // 'risk' | 'questions' | 'product' | null

  // ── Rich briefing state ──
  // Long-form post-discovery briefing generated on demand by the user.
  // Stored separately from the dashboard so it never affects scoring.
  // `richBriefingStage` records which stage's dashboard was used to produce
  // it, so we know which output to render in which tab.
  // ── Rolling rich briefing state ──
  // Single document that evolves stage by stage. Each generation overwrites
  // the prior; the prior is archived to briefingHistory before overwrite,
  // preserving the audit chain. Same pattern as dashboardHistory in refactor17.
  // richBriefingStage records which stage produced the current brief, used
  // for the download filename and visible label.
  const [richBriefing, setRichBriefing] = useState('')
  const [richBriefingStage, setRichBriefingStage] = useState('') // '' | 'pre_discovery' | 'post_discovery' | 'post_demo'
  const [briefingHistory, setBriefingHistory] = useState([]) // [{ stage, generatedAt, briefing }]
  const [richBriefingLoading, setRichBriefingLoading] = useState(false)
  const [richBriefingError, setRichBriefingError] = useState('')

  // ── Email modal state ──
  // The modal is the only surface for the follow-up email feature — no panel,
  // no card, no permanent UI. State only exists while the modal is open;
  // closing the modal returns the app to its prior visible state.
  const [emailsModalOpen, setEmailsModalOpen] = useState(false)
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailsError, setEmailsError] = useState('')
  const [emailsResult, setEmailsResult] = useState(null) // null | { followup, clarification, nudge }
  const [emailsCopiedKey, setEmailsCopiedKey] = useState('') // transient — flashes "Copied"

  // ── Post-demo stage state ──
  // demoSummary holds the post_demo_summary block (what changed, signals,
  // risks, effectiveness, follow-ups). demoSourceNotes mirrors the source
  // notes block from the response. demoResult is kept for backward-compat
  // (rendered as a textual recap if no structured summary is available)
  // but the structured payload is preferred.
  const [demoTranscript, setDemoTranscript] = useState('')
  const [demoNotes, setDemoNotes] = useState('')
  const [demoResult, setDemoResult] = useState('')
  const [demoSummary, setDemoSummary] = useState(null) // null | { what_changed, buying_signals, new_risks, demo_effectiveness, recommended_follow_up }
  const [demoSourceNotes, setDemoSourceNotes] = useState(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState('')
  // Post-demo detail toggle — closed by default. Honours the brief's
  // "do not add extra cards" rule: the summary lives behind a small toggle.
  const [demoDetailOpen, setDemoDetailOpen] = useState(false)

  // Rolling dashboard history. When a stage produces a new dashboard that
  // overwrites the prior one, the prior is pushed here with a timestamp and
  // stage tag. Not surfaced in the UI today — kept for audit and potential
  // future "compare prior dashboard" features. localStorage carries it
  // forward across reloads.
  const [dashboardHistory, setDashboardHistory] = useState([]) // [{ stage, archivedAt, dashboard }]

  // ── Solution Breakdown state ──
  // Phased Risk Cloud app scope synthesised from the dashboard, post-demo
  // summary, and transcripts. Read-only — does not write to dashboard.
  // Result shape: { proposed_scope: { phase_1, phase_2, optional }, commercial_view }
  const [solutionResult, setSolutionResult] = useState(null)
  const [solutionLoading, setSolutionLoading] = useState(false)
  const [solutionError, setSolutionError] = useState('')
  // V1.7 — Apps Considered collapsible section state. Defaults to collapsed
  // because the section is only visible when there are excluded "mentioned"
  // apps (potential misses), which is itself a contained list.
  const [appsConsideredOpen, setAppsConsideredOpen] = useState(false)

  // ── Proposal stage state ──
  // Two outputs:
  //   proposalEmail — { subject, body }, displayed in modal (same UX as
  //     Generate Follow-up Email). Closing the modal clears the visible
  //     surface but the email content persists in localStorage.
  //   proposalDocument — markdown string, rendered inline in the proposal
  //     view. Downloaded as .docx via the existing handleDownloadDocx
  //     pipeline (same renderer as rich briefing — consistent style).
  const [proposalEmail, setProposalEmail] = useState(null) // null | { subject, body }
  const [proposalEmailLoading, setProposalEmailLoading] = useState(false)
  const [proposalEmailError, setProposalEmailError] = useState('')
  const [proposalEmailModalOpen, setProposalEmailModalOpen] = useState(false)
  const [proposalEmailCopied, setProposalEmailCopied] = useState(false)

  const [proposalDocument, setProposalDocument] = useState('')
  const [proposalDocumentLoading, setProposalDocumentLoading] = useState(false)
  const [proposalDocumentError, setProposalDocumentError] = useState('')

  // ── Proposal pricing inputs ──
  // Commercial figures used to deterministically build the Commercial
  // Structure block of the proposal document. Per-app prices are keyed
  // by app name and pre-populate to $25,000 each when the user opens
  // the proposal view (handled by the per-app sync effect below).
  // Deal-level toggles default OFF so the user explicitly opts each line in.
  const PROPOSAL_PRICING_DEFAULTS = {
    perAppDefault: 25000,
    powerUsersPrice: 5000,
    powerUsersQty: 0,
    apiPrice: 10000,
    implementationPerApp: 15000,
    managedServicePrice: 24000,
  }
  const [proposalPricing, setProposalPricing] = useState({
    perAppPrices: {},        // { 'TPRM': 25000, 'ERM': 25000, ... }
    powerUsersEnabled: false,
    powerUsersPrice: PROPOSAL_PRICING_DEFAULTS.powerUsersPrice,
    powerUsersQty: PROPOSAL_PRICING_DEFAULTS.powerUsersQty,
    apiEnabled: false,
    apiPrice: PROPOSAL_PRICING_DEFAULTS.apiPrice,
    implementationEnabled: false,
    implementationPerApp: PROPOSAL_PRICING_DEFAULTS.implementationPerApp,
    managedServiceEnabled: false,
    managedServicePrice: PROPOSAL_PRICING_DEFAULTS.managedServicePrice,
    term: '',                // e.g. '3 years'
    billingFrequency: '',    // e.g. 'Annual'
  })

  // ── Value Case state (V1) ──
  // Library is the static driver catalogue from the backend, fetched once
  // per session and cached. valueDrivers is the per-deal selection — array
  // of { instanceId, key, app, label, unit, rationale, inputs, enabled }.
  // instanceId is a uuid generated client-side so users can add the same
  // driver type twice (e.g. two different vendor types). enabled lets the
  // user keep a driver in state but exclude it from totals.
  // valueCaseDayRate converts time savings to currency. Default $800/day
  // (UK mid-level analyst, conservative).
  const [valueCaseLibrary, setValueCaseLibrary] = useState(null) // null until fetched
  const [valueDrivers, setValueDrivers] = useState([])
  const [valueDriversLoading, setValueDriversLoading] = useState(false)
  const [valueDriversError, setValueDriversError] = useState('')
  const [valueCaseDayRate, setValueCaseDayRate] = useState(800)
  const [addDriverPickerOpen, setAddDriverPickerOpen] = useState(false)

  // ── Business Case Narrative state (V1.6) ──
  // Aggregate narrative produced alongside Suggest Value Drivers. Editable.
  // narrativeEdited tracks whether the rep has modified it — purely for a
  // visual badge so the rep knows what they're working with. Cleared
  // automatically when narrative is regenerated via Resuggest.
  const [valueCaseNarrative, setValueCaseNarrative] = useState('')
  const [valueCaseNarrativeEdited, setValueCaseNarrativeEdited] = useState(false)

  // ── Operational Metrics state (V1.5a) ──
  // Captured during discovery / demo. Flow into the value driver suggest at
  // proposal time as ground-truth overrides. Library is the static metric
  // catalogue from the backend; operationalMetrics is the per-deal record.
  // Shape: { metricId: { value, notes, capturedAt, capturedStage }, ... }
  // capturedStage tracks where the metric was set: 'post_discovery' or
  // 'post_demo'. Edits in either stage update the same record.
  const [operationalMetricsLibrary, setOperationalMetricsLibrary] = useState(null)
  const [operationalMetrics, setOperationalMetrics] = useState({})

  // ── Stage-gate / opportunity status state ──
  // 'open'      — opportunity is live and editable
  // 'declined'  — user has declined the opportunity post-discovery; data
  //               is preserved read-only, mutating actions disabled.
  // declineReason is captured optionally on the inline confirm banner.
  // declineConfirmOpen toggles that inline banner — no modal.
  const [opportunityStatus, setOpportunityStatus] = useState('open')
  const [declineReason, setDeclineReason] = useState('')
  const [declineConfirmOpen, setDeclineConfirmOpen] = useState(false)
  const [declineReasonDraft, setDeclineReasonDraft] = useState('')

  // ── Proposal pricing sync ──
  // When solutionResult changes (Solution Breakdown generated/regenerated),
  // make sure every Phase 1 + Phase 2 app has an entry in proposalPricing.
  // perAppPrices. Existing user-edited values are preserved; only missing
  // apps get the default. Apps that have been removed from scope stay in
  // the object (cheap to keep, matters if they come back into scope).
  useEffect(() => {
    if (!solutionResult?.proposed_scope) return
    const scoped = [
      ...(solutionResult.proposed_scope.phase_1 || []),
      ...(solutionResult.proposed_scope.phase_2 || []),
    ]
    setProposalPricing((prev) => {
      const next = { ...prev.perAppPrices }
      let changed = false
      for (const app of scoped) {
        if (next[app] === undefined) {
          next[app] = PROPOSAL_PRICING_DEFAULTS.perAppDefault
          changed = true
        }
      }
      if (!changed) return prev
      return { ...prev, perAppPrices: next }
    })
    // PROPOSAL_PRICING_DEFAULTS is a stable const declared in the component
    // body — the eslint dep-warning is acceptable here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solutionResult])

  // ── Value Case library fetch ──
  // Pull the static driver catalogue once per session. Cached for the lifetime
  // of the page — no need to refetch unless the backend version changes.
  // Failure is logged but non-fatal — the user can still use suggest, and
  // suggest's response includes everything the form needs to render drivers.
  useEffect(() => {
    if (valueCaseLibrary !== null) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await getValueDriverLibrary()
        if (!cancelled && Array.isArray(data?.library)) {
          setValueCaseLibrary(data.library)
        }
      } catch (err) {
        console.error('Value driver library fetch failed:', err)
        if (!cancelled) setValueCaseLibrary([]) // empty fallback so UI doesn't loop
      }
    })()
    return () => { cancelled = true }
  }, [valueCaseLibrary])

  // ── Operational Metrics library fetch ──
  // Same pattern as value driver library. Cached for the session — static.
  useEffect(() => {
    if (operationalMetricsLibrary !== null) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await getOperationalMetricsLibrary()
        if (!cancelled && Array.isArray(data?.library)) {
          setOperationalMetricsLibrary(data.library)
        }
      } catch (err) {
        console.error('Operational metrics library fetch failed:', err)
        if (!cancelled) setOperationalMetricsLibrary([])
      }
    })()
    return () => { cancelled = true }
  }, [operationalMetricsLibrary])

  // ── Value Case savings helpers ──
  // computeDriverSavings: per-driver maths. Returns { annualSavings,
  // threeYearSavings, isQualitative }. For currency_via_time: converts
  // day-saving to dollars via dayRate. For currency: direct multiplication.
  // For risk: returns 0 / qualitative=true so the aggregate skips it.
  function computeDriverSavings(driver, dayRate) {
    if (!driver || !driver.unit) return { annualSavings: 0, threeYearSavings: 0, isQualitative: true }
    const inputs = driver.inputs || {}
    const num = (v) => {
      if (v === null || v === undefined || v === '') return 0
      const n = typeof v === 'number' ? v : parseFloat(v)
      return isNaN(n) || n < 0 ? 0 : n
    }
    if (driver.unit === 'currency_via_time') {
      const current = num(inputs.currentDays)
      const target = num(inputs.targetDays)
      const volume = num(inputs.cyclesPerYear ?? inputs.vendorsPerYear ?? inputs.auditsPerYear)
      const daysSaved = Math.max(0, current - target)
      const annual = daysSaved * volume * dayRate
      return { annualSavings: annual, threeYearSavings: annual * 3, isQualitative: false }
    }
    if (driver.unit === 'currency') {
      const currentCost = num(inputs.currentCost)
      const targetCost = num(inputs.targetCost)
      const volume = num(inputs.vendorsPerYear ?? inputs.cyclesPerYear ?? inputs.auditsPerYear)
      const annual = Math.max(0, currentCost - targetCost) * volume
      return { annualSavings: annual, threeYearSavings: annual * 3, isQualitative: false }
    }
    if (driver.unit === 'risk') {
      return { annualSavings: 0, threeYearSavings: 0, isQualitative: true }
    }
    return { annualSavings: 0, threeYearSavings: 0, isQualitative: true }
  }

  // computeAggregateSavings: roll-up across enabled, non-qualitative drivers.
  // Returns ROI ratio + payback against the 3-year deal cost from
  // proposalPricing — only meaningful when both savings and pricing are real.
  function computeAggregateSavings(drivers, dayRate, pricing) {
    let year1 = 0
    let threeYear = 0
    for (const d of drivers || []) {
      if (!d.enabled) continue
      const { annualSavings, threeYearSavings, isQualitative } = computeDriverSavings(d, dayRate)
      if (isQualitative) continue
      year1 += annualSavings
      threeYear += threeYearSavings
    }
    // Pull TCV from proposalPricing if Term is parseable; otherwise leave as null.
    // Same shape as refactor24's TCV maths but read-only (no validation here).
    let tcv = null
    if (pricing) {
      const term = (pricing.term || '').toLowerCase().trim()
      const match = term.match(/(\d+(?:\.\d+)?)/)
      let termYears = null
      if (match) {
        const value = parseFloat(match[1])
        if (!isNaN(value) && value > 0) {
          if (/month/.test(term)) termYears = Math.max(1, Math.floor(value / 12))
          else if (/year|yr/.test(term)) termYears = Math.max(1, Math.floor(value))
          else termYears = value >= 12 ? Math.max(1, Math.floor(value / 12)) : Math.max(1, Math.floor(value))
        }
      }
      if (termYears) {
        const num = (v) => {
          if (v === null || v === undefined || v === '') return 0
          const n = typeof v === 'number' ? v : parseFloat(v)
          return isNaN(n) || n < 0 ? 0 : n
        }
        let annualSoftware = 0
        const perAppPrices = pricing.perAppPrices || {}
        for (const k of Object.keys(perAppPrices)) annualSoftware += num(perAppPrices[k])
        if (pricing.powerUsersEnabled) annualSoftware += num(pricing.powerUsersPrice)
        if (pricing.apiEnabled) annualSoftware += num(pricing.apiPrice)
        const implementationTotal = pricing.implementationEnabled
          ? num(pricing.implementationPerApp) * Object.keys(perAppPrices).length
          : 0
        const managedServiceAnnual = pricing.managedServiceEnabled ? num(pricing.managedServicePrice) : 0
        tcv = (annualSoftware * termYears) + implementationTotal + (managedServiceAnnual * termYears)
      }
    }

    // ROI ratio: only compute if TCV is positive AND savings exceed cost
    let roiRatio = null
    let paybackMonths = null
    if (tcv && tcv > 0 && threeYear > tcv) {
      roiRatio = threeYear / tcv
      paybackMonths = year1 > 0 ? Math.ceil((tcv / year1) * 12) : null
    }

    return { year1, threeYear, tcv, roiRatio, paybackMonths }
  }

  // ── Persistence ──
  // Save the current opportunity to localStorage whenever the relevant
  // fields change. Gated on `restoreDecided` so the effect doesn't write
  // empty state over a saved snapshot before the user has chosen Resume
  // or Discard. Transient state (loading, errors, modal visibility, file
  // uploads) is not persisted — only the things needed to reconstruct a
  // generated opportunity.
  useEffect(() => {
    if (!restoreDecided) return
    persistState({
      mode,
      opportunityId,
      // Pre-discovery
      company,
      sdrNotes,
      emailNotes,
      uploadedText,
      prep,
      structured,
      resolvedSnapshot,
      prepPacket,
      dashboardSummary,
      dashboard,
      sourceNotes,
      // Post-discovery
      postCompany,
      previousPrep,
      transcript,
      extraNotes,
      postUploadedText,
      postResult,
      postStructured,
      postResolvedSnapshot,
      postDiscoveryPacket,
      postDashboard,
      postSourceNotes,
      // Rich briefings
      // Rolling rich briefing
      richBriefing,
      richBriefingStage,
      briefingHistory,
      // Post-demo stage
      demoTranscript,
      demoNotes,
      demoResult,
      demoSummary,
      demoSourceNotes,
      // Solution breakdown
      solutionResult,
      // Proposal stage
      proposalEmail,
      proposalDocument,
      proposalPricing,
      // Value Case (V1 — drivers + day rate; library not persisted, refetched)
      valueDrivers,
      valueCaseDayRate,
      // Business case narrative (V1.6)
      valueCaseNarrative,
      valueCaseNarrativeEdited,
      // Operational metrics (V1.5a) — flow into value drivers as overrides
      operationalMetrics,
      // Rolling dashboard history (audit chain)
      dashboardHistory,
      // Stage-gate / status
      opportunityStatus,
      declineReason,
    })
  }, [
    restoreDecided,
    mode, opportunityId,
    company, sdrNotes, emailNotes, uploadedText,
    prep, structured, resolvedSnapshot, prepPacket, dashboardSummary, dashboard, sourceNotes,
    postCompany, previousPrep, transcript, extraNotes, postUploadedText,
    postResult, postStructured, postResolvedSnapshot, postDiscoveryPacket, postDashboard, postSourceNotes,
    richBriefing, richBriefingStage, briefingHistory,
    demoTranscript, demoNotes, demoResult, demoSummary, demoSourceNotes,
    solutionResult,
    proposalEmail, proposalDocument, proposalPricing,
    valueDrivers, valueCaseDayRate,
    valueCaseNarrative, valueCaseNarrativeEdited,
    operationalMetrics,
    dashboardHistory,
    opportunityStatus, declineReason,
  ])

  // ── Pre-discovery derived values ──

  const hasPreInput = useMemo(
    () => Boolean(company.trim() || sdrNotes.trim() || emailNotes.trim() || uploadedText.trim() || fileNames.length > 0),
    [company, sdrNotes, emailNotes, uploadedText, fileNames]
  )

  const sectionMap = useMemo(() => sectionMapFromText(prep), [prep])

  const stabilisedScore = useMemo(() => {
    if (!prep) return null
    const baseScore = resolvedSnapshot?.score ?? structured?.deal_snapshot?.score ?? null
    const baseFitLevel = resolvedSnapshot?.fit_level || structured?.deal_snapshot?.fit_level || ''
    return stabiliseScore(baseScore, prep, baseFitLevel)
  }, [prep, structured, resolvedSnapshot])

  const numScore = typeof stabilisedScore === 'number' ? stabilisedScore : 0

  const executiveSummary = useMemo(
    () => bestArray(structured?.executive_summary, parseSection(prep, 'Executive Summary')),
    [structured, prep]
  )
  const topRisks = useMemo(
    () => bestArray(structured?.top_risks, parseSection(prep, 'Top 3 Deal Risks')),
    [structured, prep]
  )
  const reasonsToWin = useMemo(
    () => bestArray(structured?.top_reasons_to_win, parseSection(prep, 'Top 3 Reasons This Could Win')),
    [structured, prep]
  )
  const demoFocus = useMemo(
    () => bestArray(structured?.demo_focus_recommendations, parseSection(prep, 'Demo Focus Recommendations')),
    [structured, prep]
  )
  const commercialRecommendation = useMemo(
    () => bestArray(structured?.commercial_recommendation, parseSection(prep, 'Commercial Recommendation')),
    [structured, prep]
  )

  const fitLevel = bestValue(resolvedSnapshot?.fit_level, bestValue(structured?.deal_snapshot?.fit_level, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Fit Level')))
  const stance = bestValue(resolvedSnapshot?.stance, bestValue(structured?.deal_snapshot?.stance, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Stance')))
  const rationale = bestValue(resolvedSnapshot?.rationale, bestValue(structured?.deal_snapshot?.rationale, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Rationale')))
  const productFit = bestValue(resolvedSnapshot?.product_fit, bestValue(structured?.deal_snapshot?.product_fit, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Product Fit')))
  const commercialFit = bestValue(resolvedSnapshot?.commercial_fit, bestValue(structured?.deal_snapshot?.commercial_fit, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Commercial Fit')))
  const dealMaturity = bestValue(resolvedSnapshot?.deal_maturity, bestValue(structured?.deal_snapshot?.deal_maturity, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'Deal Maturity')))
  const icpFit = bestValue(resolvedSnapshot?.icp_fit, bestValue(structured?.deal_snapshot?.icp_fit, getFieldValueFromSection(sectionMap, 'Deal Snapshot', 'ICP Fit')))

  const aeStance = bestValue(structured?.ae_recommendation?.stance, getFieldValueFromSection(sectionMap, 'AE Recommendation', 'Stance'))
  const aeWhy = bestValue(structured?.ae_recommendation?.why, getFieldValueFromSection(sectionMap, 'AE Recommendation', 'Why'))

  const sponsorFromText = useMemo(() => getSponsorStrategyFromText(sectionMap), [sectionMap])
  const likelySponsor = bestValue(structured?.sponsor_strategy?.likely_sponsor, sponsorFromText.likelySponsor)
  const missingPeople = useMemo(
    () => bestArray(structured?.sponsor_strategy?.missing_people, sponsorFromText.missingPeople),
    [structured, sponsorFromText]
  )
  const howToBringThemIn = useMemo(
    () => bestArray(structured?.sponsor_strategy?.how_to_bring_them_in, sponsorFromText.howToBringThemIn),
    [structured, sponsorFromText]
  )

  const narrativeFromText = useMemo(() => getDiscoveryNarrativeFromText(sectionMap), [sectionMap])
  const discoveryNarrative = useMemo(
    () => resolveNarrative(narrativeFromText, structured?.discovery_call_narrative),
    [narrativeFromText, structured]
  )

  // ── Post-discovery derived values ──

  const hasPostInput = useMemo(
    () => Boolean(transcript.trim() || previousPrep.trim()),
    [transcript, previousPrep]
  )

  const postSectionMap = useMemo(() => sectionMapFromText(postResult), [postResult])

  const postStabilisedScore = useMemo(() => {
    if (!postResult) return null
    const baseScore = postResolvedSnapshot?.score ?? postStructured?.deal_snapshot?.score ?? null
    const baseFitLevel = postResolvedSnapshot?.fit_level || postStructured?.deal_snapshot?.fit_level || ''
    return stabiliseScore(baseScore, postResult, baseFitLevel)
  }, [postResult, postStructured, postResolvedSnapshot])

  const postNumScore = typeof postStabilisedScore === 'number' ? postStabilisedScore : 0

  const postFitLevel = bestValue(postResolvedSnapshot?.fit_level, getFieldValueFromSection(postSectionMap, 'Updated Deal Snapshot', 'Fit Level'))
  const postStance = bestValue(postResolvedSnapshot?.stance, getFieldValueFromSection(postSectionMap, 'Updated Deal Snapshot', 'Stance'))
  const postRationale = bestValue(postResolvedSnapshot?.rationale, getFieldValueFromSection(postSectionMap, 'Updated Deal Snapshot', 'Rationale'))
  const postProductFit = bestValue(postResolvedSnapshot?.product_fit, getFieldValueFromSection(postSectionMap, 'Updated Deal Snapshot', 'Product Fit'))
  const postCommercialFit = bestValue(postResolvedSnapshot?.commercial_fit, getFieldValueFromSection(postSectionMap, 'Updated Deal Snapshot', 'Commercial Fit'))
  const postDealMaturity = bestValue(postResolvedSnapshot?.deal_maturity, getFieldValueFromSection(postSectionMap, 'Updated Deal Snapshot', 'Deal Maturity'))
  const postIcpFit = bestValue(postResolvedSnapshot?.icp_fit, getFieldValueFromSection(postSectionMap, 'Updated Deal Snapshot', 'ICP Fit'))

  const whatChanged = useMemo(
    () => bestArray(postStructured?.what_changed, parseSection(postResult, 'What Changed')),
    [postStructured, postResult]
  )
  const confirmed = useMemo(
    () => bestArray(postStructured?.confirmed, getSectionBullets(postSectionMap, 'Confirmed')),
    [postStructured, postSectionMap]
  )
  const stillAssumed = useMemo(
    () => bestArray(postStructured?.still_assumed, getSectionBullets(postSectionMap, 'Still Assumed')),
    [postStructured, postSectionMap]
  )
  const disproven = useMemo(
    () => bestArray(postStructured?.disproven, getSectionBullets(postSectionMap, 'Disproven')),
    [postStructured, postSectionMap]
  )
  const newRisks = useMemo(
    () => bestArray(postStructured?.new_risks, parseSection(postResult, 'New Risks Identified')),
    [postStructured, postResult]
  )
  const newBuyingSignals = useMemo(
    () => bestArray(postStructured?.new_buying_signals, parseSection(postResult, 'New Buying Signals')),
    [postStructured, postResult]
  )
  const nextActions = useMemo(
    () => bestArray(postStructured?.next_actions, parseSection(postResult, 'Recommended Next Actions')),
    [postStructured, postResult]
  )
  const postAeStance = bestValue(postStructured?.ae_recommendation?.stance, getFieldValueFromSection(postSectionMap, 'Updated AE Recommendation', 'Stance'))
  const postAeWhy = bestValue(postStructured?.ae_recommendation?.why, getFieldValueFromSection(postSectionMap, 'Updated AE Recommendation', 'Why'))

  // Score movement — read from structured first, then parse from text
  const scoreMovement = useMemo(() => {
    if (postStructured?.score_movement?.direction) return postStructured.score_movement
    const section = postSectionMap.get('Score Movement')
    if (!section) return null
    const result = { previous_score: '', updated_score: '', direction: '', why: '' }
    for (const item of section.content) {
      const text = clean(item.text)
      const lc = text.toLowerCase()
      if (lc.startsWith('previous score:')) result.previous_score = text.slice(text.indexOf(':') + 1).trim()
      else if (lc.startsWith('updated score:')) result.updated_score = text.slice(text.indexOf(':') + 1).trim()
      else if (lc.startsWith('direction:')) result.direction = text.slice(text.indexOf(':') + 1).trim()
      else if (lc.startsWith('why:')) result.why = text.slice(text.indexOf(':') + 1).trim()
    }
    return result.direction ? result : null
  }, [postStructured, postSectionMap])

  // ── Handlers ──

  function switchMode(newMode) {
    setMode(newMode)
    setStatus('')
    setError('')
    if (newMode === 'sow') handleSowModeEnter()
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setError('')
    setStatus('Extracting uploaded files…')
    setExtracting(true)
    try {
      let extracted = ''
      try { extracted = await extractFiles(files) } catch (err) {
        console.warn('Extraction failed:', err)
      }
      setFileNames(files.map((f) => f.name))
      setUploadedText(extracted || '')
      setStatus('Files added successfully.')
      setTimeout(() => setStatus(''), 1500)
    } catch (err) {
      setError(err.message || 'File extraction failed.')
      setStatus('')
    } finally {
      setExtracting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handlePostFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setError('')
    setStatus('Extracting uploaded files…')
    setExtracting(true)
    try {
      let extracted = ''
      try { extracted = await extractFiles(files) } catch (err) {
        console.warn('Extraction failed:', err)
      }
      setPostFileNames(files.map((f) => f.name))
      setPostUploadedText(extracted || '')
      setStatus('Files added successfully.')
      setTimeout(() => setStatus(''), 1500)
    } catch (err) {
      setError(err.message || 'File extraction failed.')
      setStatus('')
    } finally {
      setExtracting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function clearFiles() { setFileNames([]); setUploadedText('') }
  function clearPostFiles() { setPostFileNames([]); setPostUploadedText('') }

  async function handleGenerate() {
    if (!hasPreInput) {
      setError('Add company details, notes, or files first.')
      return
    }
    setError('')
    setStatus('Generating discovery prep…')
    setLoading(true)
    try {
      // Ensure an opportunity record exists before generating
      let oppId = opportunityId
      if (!oppId && company.trim()) {
        try {
          const opp = await createOpportunity({ company })
          if (opp?.opportunity_id) {
            oppId = opp.opportunity_id
            setOpportunityId(oppId)
          }
        } catch (e) { console.warn('[audit] createOpportunity failed silently', e) }
      }

      const data = await generatePrep({
        company, sdrNotes, emailNotes, uploadedText,
        previousDealScore: resolvedSnapshot?.score ?? null,
        previousStructuredOutput: structured || null,
        opportunityId: oppId,
      })
      if (!data?.result?.trim()) throw new Error('No discovery prep text was returned.')
      setPrep(data.result)
      setStructured(data.structured || null)
      setResolvedSnapshot(data.resolved_snapshot || null)
      setPrepPacket(data.prep_packet || null)
      setDashboardSummary(data.dashboard_summary || null)
      setDashboard(data.dashboard || null)
      setSourceNotes(data.source_notes || null)
      setPreviousPrep(data.result)
      setEnrichmentSections([])
      if (company.trim() && !postCompany.trim()) setPostCompany(company)
      setStatus('Discovery prep ready.')
      setTimeout(() => setStatus(''), 1800)

      // Refresh audit trail (non-blocking)
      if (oppId) {
        try {
          const opp = await getOpportunity(oppId)
          if (opp?.events) setAuditEvents([...opp.events].reverse())
        } catch (e) { /* silent */ }
      }
    } catch (err) {
      setError(err.message || 'Generation failed.')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  async function handlePostDiscovery() {
    if (!hasPostInput) {
      setError('Paste a call transcript or previous prep to generate an update.')
      return
    }
    setError('')
    setStatus('Generating post-discovery update…')
    setLoading(true)
    try {
      const data = await postDiscovery({
        company: postCompany,
        previousPrep,
        transcript,
        extraNotes,
        uploadedText: postUploadedText,
        previousDealScore: postResolvedSnapshot?.score ?? resolvedSnapshot?.score ?? null,
        previousStructuredOutput: postStructured || structured || null,
        opportunityId: opportunityId,
      })
      if (!data?.result?.trim()) throw new Error('No post-discovery update was returned.')
      setPostResult(data.result)
      setPostStructured(data.structured || null)
      setPostResolvedSnapshot(data.resolved_snapshot || null)
      setPostDiscoveryPacket(data.post_discovery_packet || null)
      setPostDashboard(data.dashboard || null)
      setPostSourceNotes(data.source_notes || null)
      setStrategyInput(data.result)
      setStatus('Post-discovery update ready.')
      setTimeout(() => setStatus(''), 1800)

      // Refresh audit trail (non-blocking)
      if (opportunityId) {
        try {
          const opp = await getOpportunity(opportunityId)
          if (opp?.events) setAuditEvents([...opp.events].reverse())
        } catch (e) { /* silent */ }
      }
    } catch (err) {
      setError(err.message || 'Post-discovery update failed.')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  async function handleDealStrategy() {
    if (!strategyInput.trim()) {
      setError('Paste a post-discovery output to generate a deal strategy.')
      return
    }
    setError('')
    setStatus('Generating deal strategy…')
    setLoading(true)
    try {
      const data = await dealStrategy({
        postDiscoveryOutput: strategyInput,
        company: postCompany || company,
        opportunityId: opportunityId,
      })
      if (!data?.result?.trim()) throw new Error('No deal strategy was returned.')
      setStrategyResult(data.result)
      setStrategyStructured(data.structured || null)
      setExecutionPacket(data.execution_packet || null)
      setStatus('Deal strategy ready.')
      setTimeout(() => setStatus(''), 1800)

      // Refresh audit trail (non-blocking)
      if (opportunityId) {
        try {
          const opp = await getOpportunity(opportunityId)
          if (opp?.events) setAuditEvents([...opp.events].reverse())
        } catch (e) { /* silent */ }
      }
    } catch (err) {
      setError(err.message || 'Deal strategy generation failed.')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  // ── Rich briefing generation ──
  // Long-form post-discovery / pre-discovery briefing. Calls the backend
  // /generate-rich-briefing endpoint with the dashboard as the authoritative
  // source of truth. Does NOT modify any dashboard or scoring state — the
  // briefing is a separate artefact that explains and expands the dashboard.
  async function handleGenerateRichBriefing(stage) {
    setRichBriefingError('')

    // Pick the right dashboard for the stage. For post-demo, the rolling
    // dashboard model from refactor17 means postDashboard already reflects
    // the latest demo update — use it.
    const sourceDash = (stage === 'post_discovery' || stage === 'post_demo')
      ? (postDashboard || dashboard)
      : dashboard
    const sourceNotesForStage = (stage === 'post_discovery' || stage === 'post_demo')
      ? (postSourceNotes || sourceNotes)
      : sourceNotes
    const companyForStage = (stage === 'post_discovery' || stage === 'post_demo')
      ? (postCompany || company)
      : company

    if (!hasCurrentDashboard(sourceDash)) {
      setRichBriefingError('Generate a dashboard first — the rich briefing uses the dashboard as its source of truth.')
      return
    }

    // Stage-specific supporting context. Pre uses prep text. Post-discovery
    // layers in the call transcript. Post-demo layers in the demo transcript
    // and notes (combined into a labelled block) plus the post-demo summary
    // serialised compactly into extraNotes.
    let stagePreviousOutput = prep
    let stageTranscript = ''
    let stageExtraNotes = ''

    if (stage === 'post_discovery') {
      stagePreviousOutput = previousPrep || prep
      stageTranscript = transcript
      stageExtraNotes = extraNotes
    } else if (stage === 'post_demo') {
      // Use post-discovery prep + the demo materials. Combine demo transcript
      // and demo notes into one transcript-shaped block so the prompt's
      // existing TRANSCRIPT slot consumes them naturally.
      stagePreviousOutput = postResult || previousPrep || prep
      const demoCombined = []
      if (demoTranscript?.trim()) demoCombined.push(`DEMO TRANSCRIPT:\n${demoTranscript.trim()}`)
      if (demoNotes?.trim()) demoCombined.push(`DEMO NOTES:\n${demoNotes.trim()}`)
      stageTranscript = demoCombined.join('\n\n')
      // Pack post-demo summary structured data into extraNotes so the model
      // sees the canonical "what changed" record alongside the raw transcript.
      if (demoSummary) {
        const lines = []
        if (Array.isArray(demoSummary.what_changed) && demoSummary.what_changed.length) {
          lines.push('What changed during the demo:')
          demoSummary.what_changed.forEach((b) => lines.push(`- ${b}`))
        }
        if (Array.isArray(demoSummary.buying_signals) && demoSummary.buying_signals.length) {
          lines.push('\nBuying signals from the demo:')
          demoSummary.buying_signals.forEach((b) => lines.push(`- ${b}`))
        }
        if (Array.isArray(demoSummary.new_risks) && demoSummary.new_risks.length) {
          lines.push('\nNew risks surfaced:')
          demoSummary.new_risks.forEach((b) => lines.push(`- ${b}`))
        }
        if (demoSummary.demo_effectiveness) {
          lines.push(`\nDemo effectiveness: ${demoSummary.demo_effectiveness}`)
        }
        stageExtraNotes = lines.join('\n')
      }
    }

    setRichBriefingLoading(true)
    try {
      const data = await generateRichBriefing({
        company: companyForStage,
        stage,
        dashboard: sourceDash,
        source_notes: sourceNotesForStage,
        previousOutput: stagePreviousOutput,
        transcript: stageTranscript,
        extraNotes: stageExtraNotes,
        // Send the current rolling brief so the model accretes onto it
        // rather than restating from scratch. Empty string = first generation.
        previousBriefing: richBriefing || '',
      })

      if (!data?.briefing?.trim()) {
        throw new Error('Empty briefing returned from server.')
      }

      // Archive the prior brief before overwriting. Audit chain in localStorage.
      if (richBriefing) {
        setBriefingHistory((prev) => [
          ...prev,
          { stage: richBriefingStage || 'unknown', generatedAt: new Date().toISOString(), briefing: richBriefing },
        ])
      }

      setRichBriefing(data.briefing)
      setRichBriefingStage(stage)
    } catch (err) {
      setRichBriefingError(err.message || 'Rich briefing generation failed.')
    } finally {
      setRichBriefingLoading(false)
    }
  }

  // Generate three follow-up email variants from the current dashboard.
  // Result lives in modal-only state — closing the modal clears the visible
  // surface but keeps the result in memory so reopening shows the same
  // emails without re-calling Claude. To force regeneration the user closes
  // the modal and clicks Generate Follow-up Email again, which calls anew.
  async function handleGenerateEmails(stage) {
    setEmailsError('')
    setEmailsResult(null)
    setEmailsCopiedKey('')

    const sourceDash = stage === 'post_discovery' ? (postDashboard || dashboard) : dashboard
    const sourceNotesForStage = stage === 'post_discovery' ? (postSourceNotes || sourceNotes) : sourceNotes
    const companyForStage = stage === 'post_discovery' ? (postCompany || company) : company

    if (!hasCurrentDashboard(sourceDash)) {
      setEmailsError('Generate a dashboard first — emails use the dashboard as their source of truth.')
      setEmailsModalOpen(true)
      return
    }

    setEmailsModalOpen(true)
    setEmailsLoading(true)
    try {
      const data = await generateEmails({
        company: companyForStage,
        stage,
        dashboard: sourceDash,
        source_notes: sourceNotesForStage,
        previousOutput: stage === 'post_discovery' ? (previousPrep || prep) : prep,
        transcript: stage === 'post_discovery' ? transcript : '',
        extraNotes: stage === 'post_discovery' ? extraNotes : '',
      })

      if (!data?.emails) throw new Error('Empty email response from server.')
      setEmailsResult(data.emails)
    } catch (err) {
      setEmailsError(err.message || 'Email generation failed.')
    } finally {
      setEmailsLoading(false)
    }
  }

  // Close the modal and clear all visible email state. Returns the app to
  // its prior visible state — no permanent surface remains.
  function handleCloseEmailsModal() {
    setEmailsModalOpen(false)
    setEmailsResult(null)
    setEmailsError('')
    setEmailsLoading(false)
    setEmailsCopiedKey('')
  }

  // Copy an email's subject + body to the clipboard. Flashes a "Copied"
  // confirmation on the relevant button for ~1.5s.
  async function handleCopyEmail(key, email) {
    if (!email) return
    const text = `Subject: ${email.subject || ''}\n\n${email.body || ''}`
    try {
      await navigator.clipboard.writeText(text)
      setEmailsCopiedKey(key)
      setTimeout(() => setEmailsCopiedKey((current) => (current === key ? '' : current)), 1500)
    } catch (err) {
      console.error('Email copy failed:', err)
    }
  }

  // ── Stage-gate handlers ──

  // Progress past the post-discovery gate to the demo stage. Preserves all
  // existing data — pre-discovery, post-discovery, source notes, briefings.
  // Just changes the active mode so the demo input area becomes visible.
  function handleProgressToDemo() {
    setMode('demo')
    // Cancel any open decline confirmer if the user changes their mind
    setDeclineConfirmOpen(false)
    setDeclineReasonDraft('')
  }

  // Open the inline decline-confirmation banner. The banner asks for explicit
  // confirmation and offers an optional reason field. No modal dialog —
  // the banner sits directly under the post-discovery action area.
  function handleRequestDecline() {
    setDeclineReasonDraft('')
    setDeclineConfirmOpen(true)
  }

  // Confirm the decline. Sets opportunity status to 'declined', captures the
  // optional reason, and disables further mutation. The dashboard stays
  // visible read-only — data is preserved in localStorage exactly as-is.
  function handleConfirmDecline() {
    setOpportunityStatus('declined')
    setDeclineReason((declineReasonDraft || '').trim())
    setDeclineConfirmOpen(false)
    setDeclineReasonDraft('')
  }

  // Cancel the inline decline confirmer without changing status.
  function handleCancelDecline() {
    setDeclineConfirmOpen(false)
    setDeclineReasonDraft('')
  }

  // ── Post-demo handlers ──

  // Generate the post-demo update via the backend. Payload includes the
  // prior dashboard (post-discovery preferred), demo transcript, demo notes,
  // and supporting context. On success:
  //   - The returned dashboard OVERWRITES postDashboard (rolling dashboard).
  //   - The prior postDashboard is archived to dashboardHistory before
  //     overwrite, preserving the audit chain.
  //   - post_demo_summary is stored separately and rendered behind a toggle.
  //   - source_notes are merged into postSourceNotes.
  // On failure: prior dashboard stays put. Error surfaces inline.
  async function handleGeneratePostDemo() {
    setDemoError('')
    if (opportunityStatus === 'declined') {
      setDemoError('This opportunity is declined. Start a new opportunity to continue.')
      return
    }
    if (!demoTranscript.trim() && !demoNotes.trim()) {
      setDemoError('Provide a demo transcript or demo notes (or both) before generating an update.')
      return
    }

    // Determine the prior dashboard for the delta operation. Prefer the
    // post-discovery dashboard; fall back to pre-discovery only if there's
    // no post-discovery yet (which is unusual but defensively handled).
    const priorDashboard = postDashboard || dashboard
    if (!priorDashboard || typeof priorDashboard.prospect_match_score !== 'number') {
      setDemoError('Generate a pre-discovery or post-discovery dashboard first — post-demo updates from a prior dashboard.')
      return
    }

    setDemoLoading(true)
    try {
      const data = await generatePostDemo({
        company: postCompany || company,
        previousDashboard: dashboard,
        postDiscoveryDashboard: postDashboard,
        demoTranscript,
        demoNotes,
        source_notes: postSourceNotes || sourceNotes,
        previousOutput: postResult || prep,
        currentStage: 'demo',
      })

      const result = data?.result
      if (!result || !result.dashboard) throw new Error('Empty post-demo response from server.')

      // Archive the prior post-discovery dashboard before overwriting. If
      // there is no postDashboard (post-demo is jumping ahead), archive the
      // pre-discovery one. Either way, the audit chain is preserved.
      if (priorDashboard) {
        setDashboardHistory((prev) => [
          ...prev,
          {
            stage: postDashboard ? 'post_discovery' : 'pre_discovery',
            archivedAt: new Date().toISOString(),
            dashboard: priorDashboard,
          },
        ])
      }

      // Overwrite the rolling dashboard. The post-discovery view will now
      // surface post-demo values; that's the design intent for "rolling
      // dashboard updated each stage". The history array preserves audit.
      setPostDashboard(result.dashboard)

      // Merge source notes — demo evidence becomes the new authoritative set.
      if (result.source_notes) setPostSourceNotes(result.source_notes)

      // Structured summary
      setDemoSummary(result.post_demo_summary || null)
      if (result.source_notes) setDemoSourceNotes(result.source_notes)

      // Backward-compat: synthesise a short markdown recap into demoResult
      // so the existing result preview area shows something even when the
      // detail panel is collapsed.
      const direction = result.dashboard.score_direction || 'Flat'
      const newScore = result.dashboard.prospect_match_score
      const priorScore = priorDashboard.prospect_match_score
      const recap = `Post-demo update applied. Score ${priorScore} → ${newScore} (${direction}). ${result.post_demo_summary?.what_changed?.length || 0} dashboard fields moved.`
      setDemoResult(recap)
    } catch (err) {
      setDemoError(err.message || 'Post-demo generation failed.')
    } finally {
      setDemoLoading(false)
    }
  }

  // Generate the phased Risk Cloud app scope. Reads dashboard, post-demo
  // summary, demo transcript+notes, and post-discovery transcript. Does NOT
  // mutate dashboard, scoring, or any other state — pure read synthesis.
  // The returned scope is rendered inline in the demo view (no toggle —
  // the output is small enough to surface directly).
  async function handleGenerateSolutionBreakdown() {
    setSolutionError('')
    if (opportunityStatus === 'declined') {
      setSolutionError('This opportunity is declined. Start a new opportunity to continue.')
      return
    }

    // Use the latest available dashboard. Prefer postDashboard (which already
    // reflects post-demo updates by design — see refactor17 rolling dashboard)
    // but fall back to pre-discovery if needed.
    const sourceDash = postDashboard || dashboard
    if (!sourceDash || typeof sourceDash.prospect_match_score !== 'number') {
      setSolutionError('Generate a dashboard first — solution breakdown reads from the current dashboard.')
      return
    }

    setSolutionLoading(true)
    try {
      const data = await generateSolutionBreakdown({
        company: postCompany || company,
        dashboard: sourceDash,
        postDemoSummary: demoSummary,
        demoTranscript,
        demoNotes,
        postDiscoveryTranscript: transcript,
        sourceNotes: postSourceNotes || sourceNotes,
        // Pre-discovery context — apps mentioned in the prep packet or
        // SDR/rep notes often never reappear in later transcripts and were
        // being missed by the breakdown. Pass them so all named apps are
        // candidates for the scope.
        prepNotes: prep,
        sdrNotes: sdrNotes,
      })

      const result = data?.result
      if (!result || !result.proposed_scope) throw new Error('Empty solution-breakdown response from server.')
      setSolutionResult(result)
    } catch (err) {
      setSolutionError(err.message || 'Solution breakdown failed.')
    } finally {
      setSolutionLoading(false)
    }
  }

  // ── Proposal stage handlers ──

  // Progress past the post-demo gate to the proposal stage. Preserves all
  // existing data — pre-discovery, post-discovery, post-demo, briefings.
  function handleProgressToProposal() {
    setMode('proposal')
  }

  // Generate a proposal email (single email, modal-displayed). Same UX
  // pattern as Generate Follow-up Email — opens the modal, runs the call,
  // shows the result. Closing the modal hides the surface but the email
  // content persists in localStorage so reopening shows the same content
  // without re-calling Claude.
  async function handleGenerateProposalEmail() {
    setProposalEmailError('')
    setProposalEmailCopied(false)
    if (opportunityStatus === 'declined') {
      setProposalEmailError('This opportunity is declined. Start a new opportunity to continue.')
      setProposalEmailModalOpen(true)
      return
    }
    const sourceDash = postDashboard || dashboard
    if (!hasCurrentDashboard(sourceDash)) {
      setProposalEmailError('Generate a dashboard first — proposal email uses the dashboard as its source of truth.')
      setProposalEmailModalOpen(true)
      return
    }

    setProposalEmailModalOpen(true)
    setProposalEmailLoading(true)
    try {
      const data = await generateProposalEmail({
        company: postCompany || company,
        dashboard: sourceDash,
        postDemoSummary: demoSummary,
        solutionResult,
        demoTranscript,
        demoNotes,
      })
      const email = data?.email
      if (!email || !email.body) throw new Error('Empty proposal email response from server.')
      setProposalEmail(email)
    } catch (err) {
      setProposalEmailError(err.message || 'Proposal email generation failed.')
    } finally {
      setProposalEmailLoading(false)
    }
  }

  // Close the proposal email modal. Hides the visible surface but keeps
  // the content in state and localStorage — same approach as the existing
  // Follow-up Email modal in refactor15.
  function handleCloseProposalEmailModal() {
    setProposalEmailModalOpen(false)
    setProposalEmailError('')
    setProposalEmailLoading(false)
    setProposalEmailCopied(false)
  }

  // Copy proposal email subject + body to clipboard. Same pattern as
  // handleCopyEmail in refactor15.
  async function handleCopyProposalEmail() {
    if (!proposalEmail) return
    const text = `Subject: ${proposalEmail.subject || ''}\n\n${proposalEmail.body || ''}`
    try {
      await navigator.clipboard.writeText(text)
      setProposalEmailCopied(true)
      setTimeout(() => setProposalEmailCopied(false), 1500)
    } catch (err) {
      console.error('Proposal email copy failed:', err)
    }
  }

  // Generate the proposal document (markdown). REQUIRES solutionResult —
  // the backend returns 400 if missing, but we surface a clearer message
  // here before making the call to save the round trip.
  async function handleGenerateProposalDocument() {
    setProposalDocumentError('')
    if (opportunityStatus === 'declined') {
      setProposalDocumentError('This opportunity is declined. Start a new opportunity to continue.')
      return
    }
    const sourceDash = postDashboard || dashboard
    if (!hasCurrentDashboard(sourceDash)) {
      setProposalDocumentError('Generate a dashboard first — proposal document uses the dashboard as its source of truth.')
      return
    }
    if (!solutionResult || !solutionResult.proposed_scope) {
      setProposalDocumentError('Generate a Solution Breakdown first — the proposal document uses its Phase 1 / Phase 2 scope.')
      return
    }
    // Term must be parseable to compute Total Contract Value. Same parser
    // logic as backend (regex on first number + unit detection). Backend
    // re-validates so this is just for fast feedback.
    const termRaw = (proposalPricing.term || '').toLowerCase().trim()
    const termHasNumber = /\d/.test(termRaw)
    if (!termHasNumber) {
      setProposalDocumentError('Enter a valid Term (e.g. "36 months", "3 years", "12 months") before generating the proposal document.')
      return
    }

    setProposalDocumentLoading(true)
    try {
      const data = await generateProposalDocument({
        company: postCompany || company,
        dashboard: sourceDash,
        postDemoSummary: demoSummary,
        solutionResult,
        demoTranscript,
        demoNotes,
        richBriefing,
        pricing: proposalPricing,
      })
      const document = data?.document
      if (!document || !document.trim()) throw new Error('Empty proposal document response from server.')
      setProposalDocument(document)
    } catch (err) {
      setProposalDocumentError(err.message || 'Proposal document generation failed.')
    } finally {
      setProposalDocumentLoading(false)
    }
  }

  // ── Value Case handlers (V1) ──

  // Suggest value drivers from the deal context. Replaces existing drivers
  // (with confirm if there are any). Each suggested driver is added with
  // enabled=true so it counts toward totals immediately.
  async function handleSuggestValueDrivers() {
    setValueDriversError('')
    if (opportunityStatus === 'declined') {
      setValueDriversError('This opportunity is declined. Start a new opportunity to continue.')
      return
    }
    const sourceDash = postDashboard || dashboard
    if (!hasCurrentDashboard(sourceDash)) {
      setValueDriversError('Generate a dashboard first — value driver suggestions use the dashboard for context.')
      return
    }
    if (!solutionResult || !solutionResult.proposed_scope) {
      setValueDriversError('Generate a Solution Breakdown first — value drivers map to the Phase 1 / Phase 2 apps.')
      return
    }
    // Confirm replace — covers both drivers and narrative since they're
    // generated together. If the rep has edited narrative or drivers, this
    // wipes that work.
    if (valueDrivers.length > 0 || valueCaseNarrative) {
      const willLoseEdits = valueCaseNarrativeEdited
      const message = willLoseEdits
        ? 'Replace the current value drivers AND business case narrative with fresh suggestions? Your narrative edits will be lost.'
        : 'Replace the current value drivers and business case narrative with fresh suggestions?'
      const ok = window.confirm(message)
      if (!ok) return
    }

    setValueDriversLoading(true)
    try {
      const data = await suggestValueDrivers({
        company: postCompany || company,
        dashboard: sourceDash,
        solutionResult,
        postDemoSummary: demoSummary,
        demoTranscript,
        demoNotes,
        operationalMetrics,
      })
      const suggestions = Array.isArray(data?.drivers) ? data.drivers : []
      // Each suggestion gets a fresh instanceId for stable React keys
      const drivers = suggestions.map((d) => ({
        ...d,
        instanceId: makeInstanceId(),
        enabled: true,
      }))
      setValueDrivers(drivers)
      // Narrative arrives in the same payload — store it and clear edited
      // flag so the rep knows this is the fresh AI version.
      const narrative = typeof data?.narrative === 'string' ? data.narrative : ''
      setValueCaseNarrative(narrative)
      setValueCaseNarrativeEdited(false)
    } catch (err) {
      setValueDriversError(err.message || 'Value driver suggestion failed.')
    } finally {
      setValueDriversLoading(false)
    }
  }

  // Edit narrative — sets edited flag so the panel shows "Edited" badge and
  // the resuggest confirmation surfaces a stronger warning. Cleared on
  // successful resuggest.
  function handleEditValueCaseNarrative(text) {
    setValueCaseNarrative(text)
    setValueCaseNarrativeEdited(true)
  }

  // Add a driver from the library manually. Pre-populates inputs from the
  // catalogue defaults. Same driver can be added multiple times — useful
  // when you want two TPRM cycles for different vendor types, etc.
  function handleAddValueDriver(driverKey) {
    setValueDriversError('')
    setAddDriverPickerOpen(false)
    if (!Array.isArray(valueCaseLibrary)) return
    const cat = valueCaseLibrary.find((d) => d.key === driverKey)
    if (!cat) return
    const defaultInputs = {}
    for (const inp of cat.inputs) defaultInputs[inp.key] = inp.defaultValue
    const newDriver = {
      instanceId: makeInstanceId(),
      key: cat.key,
      app: cat.app,
      label: cat.label,
      unit: cat.unit,
      rationale: '', // user-added — no rationale
      inputs: defaultInputs,
      enabled: true,
    }
    setValueDrivers((prev) => [...prev, newDriver])
  }

  // Edit a single input value on a driver. Identifies driver by instanceId
  // so duplicates of the same key still edit independently.
  function handleEditValueDriverInput(instanceId, inputKey, value) {
    setValueDrivers((prev) =>
      prev.map((d) => {
        if (d.instanceId !== instanceId) return d
        return { ...d, inputs: { ...d.inputs, [inputKey]: value } }
      })
    )
  }

  // Remove a driver entirely.
  function handleRemoveValueDriver(instanceId) {
    setValueDrivers((prev) => prev.filter((d) => d.instanceId !== instanceId))
  }

  // Toggle enabled state — kept in state but excluded from totals.
  function handleToggleValueDriverEnabled(instanceId) {
    setValueDrivers((prev) =>
      prev.map((d) => (d.instanceId === instanceId ? { ...d, enabled: !d.enabled } : d))
    )
  }

  // Generate a stable client-side instanceId for value drivers. Doesn't
  // need true uniqueness across sessions — only stable within one session
  // for React keys.
  function makeInstanceId() {
    return `vd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  // ── Operational metrics handlers (V1.5a) ──
  // Edit a single metric's value or notes. The capturedAt + capturedStage are
  // stamped at the time of edit so we know when and where the metric was set.
  // capturedStage is passed in by the caller — post-discovery / post-demo
  // call sites pass their own stage value.
  function handleEditOperationalMetric(metricId, field, value, capturedStage) {
    setOperationalMetrics((prev) => {
      const existing = prev[metricId] || { value: '', notes: '', capturedAt: null, capturedStage: null }
      const next = { ...existing, [field]: value }
      // Only stamp when value field is being set to a non-empty value
      if (field === 'value' && value !== '' && value !== null && value !== undefined) {
        next.capturedAt = new Date().toISOString()
        next.capturedStage = capturedStage || existing.capturedStage || 'post_discovery'
      }
      return { ...prev, [metricId]: next }
    })
  }

  function handleClearOperationalMetric(metricId) {
    setOperationalMetrics((prev) => {
      const next = { ...prev }
      delete next[metricId]
      return next
    })
  }

  // Download a rich briefing as a Markdown file.
  function downloadRichBriefing(briefingText, companyName, stage) {
    if (!briefingText) return
    const safeCompany = clean(companyName) || 'briefing'
    const stageSuffix = stage === 'post_discovery' ? 'post_discovery' : 'pre_discovery'
    const filename = `${safeCompany}_${stageSuffix}_pack.md`
    const blob = new Blob([briefingText], { type: 'text/markdown;charset=utf-8' })
    saveAs(blob, filename)
  }

  // Convert the briefing markdown into a styled .docx using the parser above
  // and trigger a browser save. Markdown is the source — we never re-call
  // Claude, never re-evaluate the dashboard, just format what's already there.
  async function handleDownloadDocx(briefingText, companyName, stage) {
    if (!briefingText) return
    try {
      await exportRichBriefingDocx(briefingText, companyName, stage)
    } catch (err) {
      console.error('Rich briefing DOCX export failed:', err)
      setRichBriefingError(err?.message || 'Failed to build Word document.')
    }
  }

  // Build a scorecard-shaped panel from the existing dashboard.
  // No Claude call. The score and statuses are taken verbatim from the dashboard
  // — refreshing this panel must NEVER produce a different score for the same data.
  function buildScorecardFromDashboard(dash, stage) {
    const truth = getDashboardTruth(dash)
    if (!truth) return null

    const score = truth.prospectMatchScore ?? 0

    // Map dashboard fit level to ScorecardPanel's fit_level vocabulary
    const fit_level = truth.useCaseFit === 'Strong' ? 'Strong'
      : truth.useCaseFit === 'Weak' ? 'Weak'
      : 'Moderate'

    // Derive stance the same way prep.routes does (consistency)
    const stance = score >= 80 ? 'Prioritise and pursue'
      : score >= 65 ? 'Qualify and advance'
      : score >= 45 ? 'Qualify carefully'
      : score >= 25 ? 'Deprioritise'
      : 'Disqualify'

    // Map the eight authoritative statuses onto the four scorecard dimensions
    // in a way that reflects the dashboard, not a separate AI judgement.
    const fitToScore = (level) => level === 'Strong' ? 80 : level === 'Weak' ? 30 : 55
    const sponsorToScore = (s) => s === 'Confirmed' ? 80 : s === 'Likely' ? 60 : s === 'Missing' ? 25 : 40
    const budgetToScore = (s) => s === 'Confirmed' ? 80 : s === 'Likely' ? 60 : s === 'Unclear' ? 40 : 25
    const eventToScore = (s) => s === 'Strong' ? 80 : s === 'Weak' ? 45 : s === 'None evidenced' ? 25 : 40
    const scopeToScore = (s) => s === 'Strategic' ? 80 : s === 'Expanding' ? 70 : s === 'Narrow' ? 45 : 40

    return {
      stage,
      overall_score: score,
      fit_level,
      stance,
      score_rationale: truth.useCaseFitReason || '',
      weighting: { product_fit: 0.30, commercial_fit: 0.25, deal_maturity: 0.25, icp_fit: 0.20 },
      scorecard: {
        product_fit: {
          score: fitToScore(truth.useCaseFit),
          reason: truth.useCaseFitReason || '',
        },
        commercial_fit: {
          score: budgetToScore(truth.budgetStatus),
          reason: truth.budgetDetail || '',
        },
        deal_maturity: {
          // Average of sponsor + event signals — both indicate maturity
          score: Math.round((sponsorToScore(truth.executiveSponsors) + eventToScore(truth.compellingEvent)) / 2),
          reason: [truth.executiveSponsorDetail, truth.compellingEventDetail].filter(Boolean).join(' '),
        },
        icp_fit: {
          score: scopeToScore(truth.implementationScope),
          reason: truth.implementationScopeReason || '',
        },
      },
    }
  }

  // Display the scorecard for the current stage. Reads from the dashboard
  // and is therefore deterministic — refreshing produces the same result
  // until the user generates new dashboard data.
  // NOTE: deliberately does NOT call Claude. The old AI scorecard endpoint
  // (/generate-scorecard) is still available in the backend but is not used
  // from the UI any more, since the dashboard is the source of truth.
  function handleGenerateScorecard(stage, _context, setScorecardFn) {
    setError('')
    // Pick the latest authoritative dashboard for the stage:
    //   post_discovery → postDashboard
    //   execution      → postDashboard if present, else pre-discovery dashboard
    //   pre_discovery  → dashboard
    let sourceDash
    if (stage === 'post_discovery') sourceDash = postDashboard
    else if (stage === 'execution') sourceDash = postDashboard || dashboard
    else sourceDash = dashboard

    if (!hasCurrentDashboard(sourceDash)) {
      setError('Generate a dashboard first to see the scorecard.')
      return
    }
    const card = buildScorecardFromDashboard(sourceDash, stage)
    setScorecardFn(card)
  }

  async function handleUpdateScore({ stage, previousScore, newInformation, setResultFn }) {
    if (!newInformation?.trim()) return
    if (previousScore == null) {
      setError('Generate a scorecard first to establish a baseline score.')
      return
    }
    setDeltaLoading(true)
    setError('')
    try {
      const data = await updateScore({ previousScore, stage, newInformation })
      setResultFn(data)
    } catch (err) {
      setError(err.message || 'Score update failed.')
    } finally {
      setDeltaLoading(false)
    }
  }

  // Restore the saved opportunity into state. Called when the user clicks
  // Resume in the banner. After this, restoreDecided flips so the
  // persistence effect resumes saving normally.
  function handleResume() {
    if (!pendingRestore) return
    const s = pendingRestore

    // Pre-discovery
    if (s.mode) setMode(s.mode)
    if (s.opportunityId !== undefined) setOpportunityId(s.opportunityId)
    if (s.company !== undefined) setCompany(s.company || '')
    if (s.sdrNotes !== undefined) setSdrNotes(s.sdrNotes || '')
    if (s.emailNotes !== undefined) setEmailNotes(s.emailNotes || '')
    if (s.uploadedText !== undefined) setUploadedText(s.uploadedText || '')
    if (s.prep !== undefined) setPrep(s.prep || '')
    if (s.structured !== undefined) setStructured(s.structured || null)
    if (s.resolvedSnapshot !== undefined) setResolvedSnapshot(s.resolvedSnapshot || null)
    if (s.prepPacket !== undefined) setPrepPacket(s.prepPacket || null)
    if (s.dashboardSummary !== undefined) setDashboardSummary(s.dashboardSummary || null)
    if (s.dashboard !== undefined) setDashboard(s.dashboard || null)
    if (s.sourceNotes !== undefined) setSourceNotes(s.sourceNotes || null)

    // Post-discovery
    if (s.postCompany !== undefined) setPostCompany(s.postCompany || '')
    if (s.previousPrep !== undefined) setPreviousPrep(s.previousPrep || '')
    if (s.transcript !== undefined) setTranscript(s.transcript || '')
    if (s.extraNotes !== undefined) setExtraNotes(s.extraNotes || '')
    if (s.postUploadedText !== undefined) setPostUploadedText(s.postUploadedText || '')
    if (s.postResult !== undefined) setPostResult(s.postResult || '')
    if (s.postStructured !== undefined) setPostStructured(s.postStructured || null)
    if (s.postResolvedSnapshot !== undefined) setPostResolvedSnapshot(s.postResolvedSnapshot || null)
    if (s.postDiscoveryPacket !== undefined) setPostDiscoveryPacket(s.postDiscoveryPacket || null)
    if (s.postDashboard !== undefined) setPostDashboard(s.postDashboard || null)
    if (s.postSourceNotes !== undefined) setPostSourceNotes(s.postSourceNotes || null)

    // Rich briefings
    if (s.richBriefing !== undefined) setRichBriefing(s.richBriefing || '')
    if (s.richBriefingStage !== undefined) setRichBriefingStage(s.richBriefingStage || '')
    if (Array.isArray(s.briefingHistory)) setBriefingHistory(s.briefingHistory)
    // Backward-compat: older saved state used preRichBriefing / postRichBriefing.
    // If we see those and no consolidated richBriefing, take whichever is more recent.
    if (!s.richBriefing && (s.preRichBriefing || s.postRichBriefing)) {
      if (s.postRichBriefing) {
        setRichBriefing(s.postRichBriefing)
        setRichBriefingStage('post_discovery')
      } else if (s.preRichBriefing) {
        setRichBriefing(s.preRichBriefing)
        setRichBriefingStage('pre_discovery')
      }
    }

    // Post-demo
    if (s.demoTranscript !== undefined) setDemoTranscript(s.demoTranscript || '')
    if (s.demoNotes !== undefined) setDemoNotes(s.demoNotes || '')
    if (s.demoResult !== undefined) setDemoResult(s.demoResult || '')
    if (s.demoSummary !== undefined) setDemoSummary(s.demoSummary || null)
    if (s.demoSourceNotes !== undefined) setDemoSourceNotes(s.demoSourceNotes || null)

    // Solution breakdown
    if (s.solutionResult !== undefined) setSolutionResult(s.solutionResult || null)

    // Proposal stage
    if (s.proposalEmail !== undefined) setProposalEmail(s.proposalEmail || null)
    if (s.proposalDocument !== undefined) setProposalDocument(s.proposalDocument || '')
    if (s.proposalPricing && typeof s.proposalPricing === 'object') {
      // Merge with current defaults so any new fields added in future have
      // sensible values rather than coming through as undefined.
      setProposalPricing((prev) => ({ ...prev, ...s.proposalPricing }))
    }

    // Value Case
    if (Array.isArray(s.valueDrivers)) setValueDrivers(s.valueDrivers)
    if (typeof s.valueCaseDayRate === 'number' && s.valueCaseDayRate > 0) {
      setValueCaseDayRate(s.valueCaseDayRate)
    }
    if (typeof s.valueCaseNarrative === 'string') setValueCaseNarrative(s.valueCaseNarrative)
    if (typeof s.valueCaseNarrativeEdited === 'boolean') setValueCaseNarrativeEdited(s.valueCaseNarrativeEdited)

    // Operational metrics
    if (s.operationalMetrics && typeof s.operationalMetrics === 'object') {
      setOperationalMetrics(s.operationalMetrics)
    }

    // Dashboard history (audit chain)
    if (Array.isArray(s.dashboardHistory)) setDashboardHistory(s.dashboardHistory)

    // Stage-gate / status
    if (s.opportunityStatus !== undefined) setOpportunityStatus(s.opportunityStatus || 'open')
    if (s.declineReason !== undefined) setDeclineReason(s.declineReason || '')

    setPendingRestore(null)
    setRestoreDecided(true)

    // Legacy scoring detection — dashboards generated under the old scoring
    // model don't carry scoring_model_version. The new strict 4-pillar model
    // produces materially different scores, so we surface a regeneration
    // prompt rather than letting old and new scores sit side-by-side.
    const preIsLegacy = s.dashboard && s.dashboard.scoring_model_version !== 2
    const postIsLegacy = s.postDashboard && s.postDashboard.scoring_model_version !== 2
    if (preIsLegacy || postIsLegacy) {
      setLegacyScoringDetected({
        pre: !!preIsLegacy,
        post: !!postIsLegacy,
      })
    }
  }

  // Discard the saved snapshot. Wipes localStorage and starts the session
  // clean. Does not touch backend audit / opportunity records.
  function handleDiscard() {
    clearPersistedState()
    setPendingRestore(null)
    setRestoreDecided(true)
  }

  // Clear dashboards generated under the old scoring model so the user can
  // regenerate with the new strict 4-pillar prompts. Inputs (company, SDR
  // notes, transcript, etc.) are preserved so regeneration is one click.
  function handleRegenerateLegacyScores() {
    const flags = legacyScoringDetected || {}
    if (flags.pre) {
      setDashboard(null)
      setSourceNotes(null)
      setPrep('')
      setStructured(null)
      setResolvedSnapshot(null)
      setPrepPacket(null)
      setDashboardSummary(null)
    }
    if (flags.post) {
      setPostDashboard(null)
      setPostSourceNotes(null)
      setPostResult('')
      setPostStructured(null)
      setPostResolvedSnapshot(null)
      setPostDiscoveryPacket(null)
    }
    // Rolling brief is invalidated by any dashboard reset — its content
    // references a dashboard that's about to be regenerated under the new
    // scoring model. Archive the prior brief if one exists so it isn't lost.
    if (richBriefing) {
      setBriefingHistory((prev) => [
        ...prev,
        { stage: richBriefingStage || 'unknown', generatedAt: new Date().toISOString(), briefing: richBriefing },
      ])
    }
    setRichBriefing('')
    setRichBriefingStage('')
    setLegacyScoringDetected(null)
    // If the cleared stage is the current mode, the user lands back on the
    // input form with their inputs preserved — one click to regenerate.
  }

  // Dismiss the legacy banner without regenerating. The old scores stay.
  function handleDismissLegacyScoring() {
    setLegacyScoringDetected(null)
  }

  // Reset all working opportunity state and clear the persisted snapshot.
  // Confirmation prompt prevents accidental loss. Backend audit / opportunities
  // are untouched — this only clears what's in front of the user right now.
  function handleNewOpportunity() {
    const ok = window.confirm('Start a new opportunity and clear the current saved dashboard?')
    if (!ok) return

    // Pre-discovery
    setCompany('')
    setSdrNotes('')
    setEmailNotes('')
    setUploadedText('')
    setFileNames([])
    setPrep('')
    setStructured(null)
    setResolvedSnapshot(null)
    setPrepPacket(null)
    setDashboardSummary(null)
    setDashboard(null)
    setSourceNotes(null)

    // Post-discovery
    setPostCompany('')
    setPreviousPrep('')
    setTranscript('')
    setExtraNotes('')
    setPostUploadedText('')
    setPostFileNames([])
    setPostResult('')
    setPostStructured(null)
    setPostResolvedSnapshot(null)
    setPostDiscoveryPacket(null)
    setPostDashboard(null)
    setPostSourceNotes(null)

    // Strategy / execution
    setStrategyInput('')
    setStrategyResult('')
    setStrategyStructured(null)
    setExecutionPacket(null)

    // Scorecards + delta widgets
    setPreScorecard(null)
    setPostScorecard(null)
    setExecScorecard(null)
    setPreDeltaNotes('')
    setPostDeltaNotes('')
    setExecDeltaNotes('')
    setPreDeltaResult(null)
    setPostDeltaResult(null)
    setExecDeltaResult(null)

    // Rolling rich briefing
    setRichBriefing('')
    setRichBriefingStage('')
    setBriefingHistory([])
    setRichBriefingError('')

    // Post-demo stage
    setDemoTranscript('')
    setDemoNotes('')
    setDemoResult('')
    setDemoSummary(null)
    setDemoSourceNotes(null)
    setDemoLoading(false)
    setDemoError('')
    setDemoDetailOpen(false)

    // Solution breakdown
    setSolutionResult(null)
    setSolutionLoading(false)
    setSolutionError('')

    // Proposal stage
    setProposalEmail(null)
    setProposalEmailLoading(false)
    setProposalEmailError('')
    setProposalEmailModalOpen(false)
    setProposalEmailCopied(false)
    setProposalDocument('')
    setProposalDocumentLoading(false)
    setProposalDocumentError('')
    // Reset pricing to defaults — perAppPrices is wiped (will be re-seeded
    // by the sync effect once a new solutionResult exists)
    setProposalPricing({
      perAppPrices: {},
      powerUsersEnabled: false,
      powerUsersPrice: PROPOSAL_PRICING_DEFAULTS.powerUsersPrice,
      powerUsersQty: PROPOSAL_PRICING_DEFAULTS.powerUsersQty,
      apiEnabled: false,
      apiPrice: PROPOSAL_PRICING_DEFAULTS.apiPrice,
      implementationEnabled: false,
      implementationPerApp: PROPOSAL_PRICING_DEFAULTS.implementationPerApp,
      managedServiceEnabled: false,
      managedServicePrice: PROPOSAL_PRICING_DEFAULTS.managedServicePrice,
      term: '',
      billingFrequency: '',
    })

    // Value Case reset (library stays cached — it's static, not deal-specific)
    setValueDrivers([])
    setValueDriversLoading(false)
    setValueDriversError('')
    setValueCaseDayRate(800)
    setAddDriverPickerOpen(false)
    setValueCaseNarrative('')
    setValueCaseNarrativeEdited(false)

    // Operational metrics reset (library stays cached, per-deal record wiped)
    setOperationalMetrics({})

    // Dashboard history wiped on new opportunity
    setDashboardHistory([])

    // Stage-gate / status reset to open
    setOpportunityStatus('open')
    setDeclineReason('')
    setDeclineConfirmOpen(false)
    setDeclineReasonDraft('')

    // Enrichment
    setEnrichmentSections([])
    setEnrichingKey(null)

    // Opportunity / audit context (frontend only — backend events untouched)
    setOpportunityId(null)
    setAuditEvents([])
    setManualNoteText('')

    // Transient UI flags
    setError('')
    setStatus('')
    setMode('pre')

    // Wipe the persisted snapshot so a refresh doesn't bring it back
    clearPersistedState()

    // Cancel any pending restore banner and lock further writes as decided
    setPendingRestore(null)
    setRestoreDecided(true)
  }

  async function handleAddManualNote() {
    if (!manualNoteText.trim() || !opportunityId) return
    try {
      const event = await addManualEvent(opportunityId, {
        eventType: 'manual_note_added',
        notes: manualNoteText,
        stage: mode === 'post' ? 'post_discovery' : mode === 'strategy' ? 'execution' : 'pre_discovery',
      })
      if (event) {
        setAuditEvents((prev) => [event, ...prev])
        setManualNoteText('')
      }
    } catch (e) { console.warn('[audit] addManualNote failed', e) }
  }

  async function handleExtractContacts() {
    if (!contactTextInput.trim() && contactImageFiles.length === 0) {
      setContactsError('Paste text or upload images to extract contacts.')
      return
    }
    setContactsError('')
    setContactsLoading(true)
    try {
      const sourceStage = mode === 'post' ? 'post_discovery' : mode === 'strategy' ? 'execution' : 'pre_discovery'
      const data = await extractContacts({
        textContent: contactTextInput,
        images: contactImageFiles,
        opportunityId,
        company: postCompany || company,
        sourceStage,
      })
      if (!data?.contacts?.length) {
        setContactsError('No contacts found in the provided input.')
        setProposedContacts([])
      } else {
        // Add a local _accepted flag for the review UI
        setProposedContacts(data.contacts.map((c, i) => ({ ...c, _id: `prop_${i}`, _accepted: true })))
        setContactsError('')
      }
    } catch (err) {
      setContactsError(err.message || 'Extraction failed.')
    } finally {
      setContactsLoading(false)
    }
  }

  async function handleSaveContacts() {
    const toSave = proposedContacts.filter((c) => c._accepted)
    if (!toSave.length) return
    setContactsLoading(true)
    try {
      // Strip local UI flags before saving
      const clean = toSave.map(({ _id, _accepted, ...rest }) => rest)
      const data = await saveContacts(clean)
      setSavedContacts((prev) => [...prev, ...data.saved])
      setProposedContacts([])
      setContactTextInput('')
      setContactImageFiles([])
    } catch (err) {
      setContactsError(err.message || 'Save failed.')
    } finally {
      setContactsLoading(false)
    }
  }

  function handleContactImageFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setContactImageFiles(files)
    if (contactImageRef.current) contactImageRef.current.value = ''
  }

  function updateProposedContact(id, field, value) {
    setProposedContacts((prev) =>
      prev.map((c) => c._id === id ? { ...c, [field]: value } : c)
    )
  }

  function handleClearContacts() {
    setProposedContacts([])
    setContactTextInput('')
    setContactImageFiles([])
    setContactsError('')
  }

  // ── SoW handlers ──

  async function handleSowModeEnter() {
    if (sowProfiles.length === 0) {
      try {
        const profiles = await listSowProfiles()
        setSowProfiles(profiles || [])
      } catch (e) { console.warn('Failed to load SoW profiles', e) }
    }
  }

  async function handleSowProfileSelect(profileId) {
    setSowProfileId(profileId)
    setSowSelectedProfile(null)
    setSowSelectedModules([])
    setSowSelectedComplexity([])
    setSowInputs({})
    setSowResult(null)
    setSowError('')
    if (!profileId) return
    try {
      const profile = await getSowProfile(profileId)
      if (profile) {
        setSowSelectedProfile(profile)
        // Pre-select all core modules
        const coreIds = (profile.modules?.core || []).map((m) => m.id)
        setSowSelectedModules(coreIds)
        // Pre-fill customer name from deal context if available
        const customerName = postCompany || company
        if (customerName) setSowInputs((prev) => ({ ...prev, customer_name: customerName }))
      }
    } catch (e) { console.warn('Failed to load profile', e) }
  }

  function handleSowModuleToggle(moduleId) {
    setSowSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    )
  }

  function handleSowComplexityToggle(driverId) {
    setSowSelectedComplexity((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId]
    )
  }

  function handleSowInputChange(fieldId, value) {
    setSowInputs((prev) => ({ ...prev, [fieldId]: value }))
  }

  async function handleGenerateSoW() {
    if (!sowProfileId || !sowSelectedModules.length) {
      setSowError('Select a profile and at least one module.')
      return
    }
    setSowError('')
    setSowLoading(true)
    try {
      const inputsArray = Object.entries(sowInputs).map(([id, value]) => ({ id, value }))
      const data = await generateSoW({
        profileId: sowProfileId,
        selectedModules: sowSelectedModules,
        consultantInputs: inputsArray,
        selectedComplexity: sowSelectedComplexity,
      })
      setSowResult(data)
    } catch (err) {
      setSowError(err.message || 'SoW generation failed.')
    } finally {
      setSowLoading(false)
    }
  }

  // ── Enrichment handlers ──

  async function handleEnrichment(key, apiFn) {
    if (!prep) return
    setEnrichingKey(key)
    try {
      const result = await apiFn(prep, company)
      if (result?.title && result?.bullets?.length) {
        setEnrichmentSections((prev) => {
          // Replace if same title already exists, otherwise append
          const exists = prev.findIndex((s) => s.title === result.title)
          if (exists >= 0) {
            const next = [...prev]
            next[exists] = result
            return next
          }
          return [...prev, result]
        })
      }
    } catch (err) {
      console.error(`[enrichment] ${key} failed:`, err.message)
    } finally {
      setEnrichingKey(null)
    }
  }

  function handleSowExportText() {
    if (!sowResult?.result) return
    const blob = new Blob([sowResult.result], { type: 'text/plain' })
    saveAs(blob, `${(sowResult.customer_name || 'sow').replace(/\s+/g, '_').toLowerCase()}_sow_draft.txt`)
  }

  function openEnrich(contactId) {
    setEnrichingId(contactId)
    setEnrichText('')
    setEnrichImageFile(null)
    setEnrichResult(null)
    setEnrichError('')
  }

  function closeEnrich() {
    setEnrichingId(null)
    setEnrichText('')
    setEnrichImageFile(null)
    setEnrichResult(null)
    setEnrichError('')
  }

  async function handleEnrichContact(contactId) {
    if (!enrichText.trim() && !enrichImageFile) {
      setEnrichError('Paste text or upload an image to enrich.')
      return
    }
    setEnrichLoading(true)
    setEnrichError('')
    setEnrichResult(null)
    try {
      const existingContact = savedContacts.find((c) => c.contact_id === contactId) || null
      const data = await enrichContactApi({
        contactId,
        textInput: enrichText,
        imageFile: enrichImageFile,
        existingContact,
      })
      if (!data?.contact) {
        setEnrichError('No enrichment data returned.')
        return
      }
      // Update the saved contacts list in place
      setSavedContacts((prev) =>
        prev.map((c) => c.contact_id === contactId ? data.contact : c)
      )
      setEnrichResult(data.fields_updated || [])
    } catch (err) {
      setEnrichError(err.message || 'Enrichment failed.')
    } finally {
      setEnrichLoading(false)
    }
  }

  // ── Render ──

  const label = (text) => (
    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: MUTED, fontWeight: 600 }}>
      {text}
    </label>
  )

  return (
    <div style={S.page}>
      <div style={S.shell}>

        {/* Resume / Discard banner — shown only when a saved snapshot is detected on load */}
        {pendingRestore && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 12,
            background: NAVY_LIGHT,
            border: `1px solid ${BORDER}`,
            borderLeft: `4px solid ${NAVY}`,
            borderRadius: 10,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                Saved Opportunity Found
              </div>
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                Resume previous opportunity{pendingRestore.company ? `: ${pendingRestore.company}` : ''}?
                {pendingRestore.savedAt && (
                  <span style={{ color: MUTED, marginLeft: 6 }}>
                    (saved {new Date(pendingRestore.savedAt).toLocaleString('en-GB')})
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={handleResume}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: NAVY,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Resume
              </button>
              <button
                onClick={handleDiscard}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: '#fff',
                  color: MUTED,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Legacy scoring banner — appears when restored dashboards predate
            the v2 strict scoring model. Offers regeneration with inputs
            preserved, or dismissal if the user wants to keep the old scores. */}
        {legacyScoringDetected && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 12,
            background: '#FEF3C7',
            border: `1px solid #FDE68A`,
            borderLeft: `4px solid #D97706`,
            borderRadius: 10,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                Scoring Model Updated
              </div>
              <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>
                {legacyScoringDetected.pre && legacyScoringDetected.post
                  ? 'Your saved pre and post-discovery dashboards were generated under an older scoring model. Regenerate to apply the stricter four-pillar scoring with mandatory penalties.'
                  : legacyScoringDetected.pre
                    ? 'Your saved pre-discovery dashboard was generated under an older scoring model. Regenerate to apply the stricter four-pillar scoring with mandatory penalties.'
                    : 'Your saved post-discovery dashboard was generated under an older scoring model. Regenerate to apply the stricter four-pillar scoring with mandatory penalties.'}
                <span style={{ color: '#92400E', marginLeft: 4 }}>Inputs are preserved.</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={handleRegenerateLegacyScores}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#D97706',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Regenerate
              </button>
              <button
                onClick={handleDismissLegacyScoring}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid #FDE68A`,
                  background: '#fff',
                  color: '#92400E',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Keep old scores
              </button>
            </div>
          </div>
        )}

        {/* Top utility bar — New Opportunity / Reset */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        }}>
          <button
            onClick={handleNewOpportunity}
            title="Clear all current opportunity data and start fresh"
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: '#fff',
              color: MUTED,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            New Opportunity
          </button>
        </div>

        {/* Pipeline stage indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 0,
          marginBottom: 24,
          background: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}>
          {[
            { key: 'pre', num: '1', label: 'Pre-Discovery', sub: 'Prep brief', done: Boolean(prep) },
            { key: 'post', num: '2', label: 'Post-Discovery', sub: 'Update & delta', done: Boolean(postResult) },
            { key: 'demo', num: '3', label: 'Post-Demo', sub: 'Demo update', done: Boolean(demoResult) },
            { key: 'proposal', num: '4', label: 'Proposal', sub: 'Email & document', done: Boolean(proposalEmail || proposalDocument) },
            { key: 'strategy', num: '5', label: 'Execution', sub: 'Strategy plan', done: Boolean(strategyResult) },
            { key: 'sow', num: '6', label: 'SoW', sub: 'Scope of work', done: Boolean(sowResult) },
          ].map(({ key, num, label: lbl, sub, done }, idx, arr) => {
            const isActive = mode === key
            const isLocked = false // all stages always accessible
            return (
              <React.Fragment key={key}>
                <button
                  onClick={() => switchMode(key)}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    border: 'none',
                    background: isActive ? NAVY : done ? '#f0fdf4' : '#fff',
                    color: isActive ? '#fff' : done ? GREEN : MUTED,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: isActive ? 'rgba(255,255,255,0.2)' : done ? GREEN : BORDER,
                      color: isActive ? '#fff' : done ? '#fff' : MUTED,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {done && !isActive ? '✓' : num}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{lbl}</div>
                      <div style={{ fontSize: 11, opacity: isActive ? 0.8 : 0.6, lineHeight: 1.3 }}>{sub}</div>
                    </div>
                  </div>
                </button>
                {idx < arr.length - 1 && (
                  <div style={{
                    width: 1,
                    background: BORDER,
                    alignSelf: 'stretch',
                    flexShrink: 0,
                  }} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* ── PRE-DISCOVERY MODE ── */}
        {mode === 'pre' && (
          <>
            {/* ── Header always visible ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <img src={logo} alt="Risk Rising" style={{ height: 34, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }} />
              <div>
                <h2 style={{ margin: 0, color: NAVY }}>Discovery Prep</h2>
                <div style={{ fontSize: 13, color: MUTED }}>Powered by Risk Rising</div>
              </div>
            </div>

            {status ? <div style={S.status}>{status}</div> : null}
            {error ? <div style={S.error}>{error}</div> : null}

            {/* ── INPUT FORM — only shown when no dashboard exists yet ── */}
            {!hasCurrentDashboard(dashboard) && (
              <div style={S.card}>
                {label('Company')}
                <input style={S.input} placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
                <div style={{ height: 16 }} />

                {label('SDR Notes')}
                <textarea style={S.textarea} placeholder="Paste SDR qualification notes here…" value={sdrNotes} onChange={(e) => setSdrNotes(e.target.value)} />
                <div style={{ height: 16 }} />

                {label('Email / Call Notes')}
                <textarea style={S.textarea} placeholder="Paste email threads or call notes…" value={emailNotes} onChange={(e) => setEmailNotes(e.target.value)} />
                <div style={{ height: 16 }} />

                {label('Supporting Files')}
                <div onClick={() => fileRef.current?.click()} style={S.uploadBox}>
                  {fileNames.length ? fileNames.join(', ') : 'Click to upload files (PDF, DOCX, XLSX, CSV, TXT)'}
                </div>
                <input ref={fileRef} type="file" hidden multiple onChange={handleFiles} />
                {fileNames.length > 0 && (
                  <div style={S.fileList}>
                    <div>{fileNames.length} file(s) added</div>
                    <div style={{ marginTop: 8 }}>
                      <button style={S.secondaryButton} onClick={clearFiles}>Clear Files</button>
                    </div>
                  </div>
                )}

                <div style={S.helper}>Research and prep generation run together when you click Generate.</div>

                <div style={{ marginTop: 18 }}>
                  <button
                    style={{
                      ...S.button,
                      background: !hasPreInput || loading || extracting ? '#94a3b8' : NAVY,
                      color: '#fff',
                      cursor: !hasPreInput || loading || extracting ? 'not-allowed' : 'pointer',
                    }}
                    disabled={!hasPreInput || loading || extracting}
                    onClick={handleGenerate}
                  >
                    {loading ? 'Generating…' : 'Generate Discovery Prep'}
                  </button>
                </div>
              </div>
            )}

            {/* ── DASHBOARD-ONLY VIEW — once a dashboard exists ── */}
            {hasCurrentDashboard(dashboard) && (
              <>
                <DashboardCard dashboard={dashboard} sourceNotes={sourceNotes} title="Pre-Discovery Dashboard" />

                {/* Three-button action row + Download (when briefing exists) */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button
                    onClick={() => handleGenerateRichBriefing('pre_discovery')}
                    disabled={richBriefingLoading}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: richBriefingLoading ? '#94a3b8' : NAVY,
                      color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                      cursor: richBriefingLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {richBriefingLoading ? 'Generating…' : richBriefing ? 'Regenerate Rich Briefing' : 'Generate Rich Briefing'}
                  </button>
                  <button
                    onClick={() => switchMode('post')}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: NAVY, color: '#fff', fontWeight: 600, fontSize: 14,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    Continue to Post-Discovery →
                  </button>
                  <button
                    onClick={() => handleGenerateEmails('pre_discovery')}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                      background: '#fff', color: NAVY, fontWeight: 600, fontSize: 14,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    Generate Follow-up Email
                  </button>
                  <button
                    onClick={handleNewOpportunity}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                      background: '#fff', color: MUTED, fontWeight: 600, fontSize: 14,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    New Opportunity
                  </button>
                  {/* Single Download Brief button — disabled until a brief exists.
                      Downloads the rolling rich briefing as .docx, named for
                      whichever stage produced it (richBriefingStage). */}
                  <button
                    onClick={() => handleDownloadDocx(richBriefing, company, richBriefingStage || 'pre_discovery')}
                    disabled={!richBriefing}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: !richBriefing ? '#94a3b8' : NAVY,
                      color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                      cursor: !richBriefing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Download Brief
                  </button>
                </div>

                {/* Inline rich briefing error */}
                {richBriefingError && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
                    color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12,
                  }}>
                    {richBriefingError}
                  </div>
                )}

                {/* Rich briefing preview — shown immediately once generated.
                    Single rolling brief; the stage label reflects whichever
                    stage produced the current content. */}
                {richBriefing && (
                  <div style={{
                    background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                    padding: '14px 18px', marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      Rich Briefing — {richBriefingStage === 'post_demo' ? 'Post-Demo Pack' : richBriefingStage === 'post_discovery' ? 'Post-Discovery Pack' : 'Discovery Pack'} ({richBriefing.length.toLocaleString()} chars)
                    </div>
                    <div style={{
                      background: '#f8fafc', border: `1px solid ${BORDER}`, borderRadius: 8,
                      padding: '14px 16px', maxHeight: 600, overflowY: 'auto',
                    }}>
                      <pre style={{
                        margin: 0,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: 12, lineHeight: 1.6, color: '#1e293b',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>{richBriefing}</pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── POST-DISCOVERY MODE ── */}
        {mode === 'post' && (
          <>
            {/* Header always visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <img src={logo} alt="Risk Rising" style={{ height: 34, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }} />
              <div>
                <h2 style={{ margin: 0, color: NAVY }}>Post-Discovery Update</h2>
                <div style={{ fontSize: 13, color: MUTED }}>Compare what we assumed vs what we learned</div>
              </div>
            </div>

            {status ? <div style={S.status}>{status}</div> : null}
            {error ? <div style={S.error}>{error}</div> : null}

            {/* Input form — only shown when no postDashboard exists yet */}
            {!hasCurrentDashboard(postDashboard) && (
            <div style={S.card}>
              {label('Company')}
              <input
                style={S.input}
                placeholder="Company name"
                value={postCompany}
                onChange={(e) => setPostCompany(e.target.value)}
              />
              <div style={{ height: 16 }} />

              {label('Call Transcript *')}
              <textarea
                style={S.textareaLarge}
                placeholder="Paste the full call transcript here…"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
              <div style={{ height: 16 }} />

              {label('Previous Discovery Prep')}
              {prep && previousPrep === prep && (
                <div style={{
                  fontSize: 12,
                  color: GREEN,
                  fontWeight: 600,
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}>
                  ✓ Auto-populated from Stage 1 output
                </div>
              )}
              <textarea
                style={S.textareaLarge}
                placeholder="Paste the pre-call discovery prep output (optional but strongly recommended)…"
                value={previousPrep}
                onChange={(e) => setPreviousPrep(e.target.value)}
              />
              <div style={{ height: 16 }} />

              {label('Additional Notes')}
              <textarea
                style={S.textarea}
                placeholder="Any other notes from the call, follow-up emails, or context…"
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
              />
              <div style={{ height: 16 }} />

              {label('Supporting Files (optional)')}
              <div onClick={() => fileRef.current?.click()} style={S.uploadBox}>
                {postFileNames.length ? postFileNames.join(', ') : 'Click to upload supporting files'}
              </div>
              <input ref={fileRef} type="file" hidden multiple onChange={handlePostFiles} />
              {postFileNames.length > 0 && (
                <div style={S.fileList}>
                  <div>{postFileNames.length} file(s) added</div>
                  <div style={{ marginTop: 8 }}>
                    <button style={S.secondaryButton} onClick={clearPostFiles}>Clear Files</button>
                  </div>
                </div>
              )}

              <div style={S.helper}>The transcript is the primary input. Previous prep helps the model compare what changed.</div>

              <div style={{ marginTop: 18 }}>
                <button
                  style={{
                    ...S.button,
                    background: !hasPostInput || loading || extracting ? '#94a3b8' : NAVY,
                    color: '#fff',
                    cursor: !hasPostInput || loading || extracting ? 'not-allowed' : 'pointer',
                  }}
                  disabled={!hasPostInput || loading || extracting}
                  onClick={handlePostDiscovery}
                >
                  {loading ? 'Generating…' : 'Generate Post-Discovery Update'}
                </button>
              </div>
            </div>
            )}

            {/* Post-discovery dashboard */}
            {postResult ? (
              <>
                <DashboardCard dashboard={postDashboard} sourceNotes={postSourceNotes} title="Post-Discovery Dashboard" />

                {/* Operational Metrics — V1.5a. Capture facts about the
                    prospect's current state. Same panel used in post-demo;
                    edits there carry forward. Stage tag = 'post_discovery'. */}
                <OperationalMetricsPanel
                  library={operationalMetricsLibrary}
                  metrics={operationalMetrics}
                  stage="post_discovery"
                  onEdit={handleEditOperationalMetric}
                  onClear={handleClearOperationalMetric}
                  disabled={opportunityStatus === 'declined'}
                />

                {/* Three-button action row (default view) */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button
                    onClick={() => handleGenerateRichBriefing('post_discovery')}
                    disabled={richBriefingLoading || !hasCurrentDashboard(postDashboard) || opportunityStatus === 'declined'}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: richBriefingLoading || !hasCurrentDashboard(postDashboard) || opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                      color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                      cursor: richBriefingLoading || !hasCurrentDashboard(postDashboard) || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {richBriefingLoading ? 'Generating…' : richBriefing ? 'Regenerate Rich Briefing' : 'Generate Rich Briefing'}
                  </button>
                  <button
                    onClick={handleProgressToDemo}
                    disabled={opportunityStatus === 'declined'}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                      color: '#fff', fontWeight: 600, fontSize: 14,
                      fontFamily: 'inherit',
                      cursor: opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Progress to Demo →
                  </button>
                  <button
                    onClick={handleRequestDecline}
                    disabled={opportunityStatus === 'declined'}
                    style={{
                      padding: '10px 16px', borderRadius: 8,
                      border: opportunityStatus === 'declined' ? `1px solid ${BORDER}` : `1px solid #FCA5A5`,
                      background: '#fff',
                      color: opportunityStatus === 'declined' ? MUTED : '#B91C1C',
                      fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                      cursor: opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Decline Opportunity
                  </button>
                  <button
                    onClick={() => handleGenerateEmails('post_discovery')}
                    disabled={opportunityStatus === 'declined'}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                      background: '#fff',
                      color: opportunityStatus === 'declined' ? MUTED : NAVY,
                      fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                      cursor: opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Generate Follow-up Email
                  </button>
                  <button
                    onClick={handleNewOpportunity}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                      background: '#fff', color: MUTED, fontWeight: 600, fontSize: 14,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    New Opportunity
                  </button>
                  {/* Single Download Brief button — disabled until a brief exists. */}
                  <button
                    onClick={() => handleDownloadDocx(richBriefing, postCompany || company, richBriefingStage || 'post_discovery')}
                    disabled={!richBriefing}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: !richBriefing ? '#94a3b8' : NAVY,
                      color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                      cursor: !richBriefing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Download Brief
                  </button>
                </div>

                {/* Inline decline confirmation — appears between the action row
                    and any briefing preview when the user clicks Decline. No
                    modal. Optional reason field. Confirm or Cancel. */}
                {declineConfirmOpen && opportunityStatus === 'open' && (
                  <div style={{
                    padding: '14px 16px',
                    marginBottom: 16,
                    background: '#FEF2F2',
                    border: `1px solid #FECACA`,
                    borderLeft: `4px solid #B91C1C`,
                    borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 6 }}>
                      Decline this opportunity and save the current record?
                    </div>
                    <div style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 10, lineHeight: 1.5 }}>
                      All current data is preserved. The dashboard will remain visible read-only. You can start a new opportunity at any time.
                    </div>
                    <input
                      type="text"
                      placeholder="Optional reason (e.g. timing, budget, scope)"
                      value={declineReasonDraft}
                      onChange={(e) => setDeclineReasonDraft(e.target.value)}
                      maxLength={200}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: `1px solid #FECACA`,
                        background: '#fff',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        marginBottom: 10,
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleConfirmDecline}
                        style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none',
                          background: '#B91C1C', color: '#fff',
                          fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        Confirm Decline
                      </button>
                      <button
                        onClick={handleCancelDecline}
                        style={{
                          padding: '8px 16px', borderRadius: 8,
                          border: `1px solid #FECACA`,
                          background: '#fff', color: '#991B1B',
                          fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Declined banner — appears once the opportunity has been
                    declined. Read-only indicator. Disappears only on
                    New Opportunity. */}
                {opportunityStatus === 'declined' && (
                  <div style={{
                    padding: '12px 14px',
                    marginBottom: 16,
                    background: '#F1F5F9',
                    border: `1px solid ${BORDER}`,
                    borderLeft: `4px solid ${MUTED}`,
                    borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      Declined
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                      This opportunity is declined. Dashboard is read-only.
                      {declineReason ? <span style={{ color: MUTED }}> Reason: {declineReason}</span> : null}
                    </div>
                  </div>
                )}

                {/* Inline rich briefing error */}
                {richBriefingError && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
                    color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12,
                  }}>
                    {richBriefingError}
                  </div>
                )}

                {/* Rich briefing preview — shown immediately once generated.
                    Single rolling brief; the stage label reflects whichever
                    stage produced the current content. */}
                {richBriefing && (
                  <div style={{
                    background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                    padding: '14px 18px', marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      Rich Briefing — {richBriefingStage === 'post_demo' ? 'Post-Demo Pack' : richBriefingStage === 'post_discovery' ? 'Post-Discovery Pack' : 'Discovery Pack'} ({richBriefing.length.toLocaleString()} chars)
                    </div>
                    <div style={{
                      background: '#f8fafc', border: `1px solid ${BORDER}`, borderRadius: 8,
                      padding: '14px 16px', maxHeight: 600, overflowY: 'auto',
                    }}>
                      <pre style={{
                        margin: 0,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: 12, lineHeight: 1.6, color: '#1e293b',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>{richBriefing}</pre>
                    </div>
                  </div>
                )}

              </>
            ) : null}

            {!postResult && (
              <div style={S.card}>
                <div style={{ color: MUTED }}>Paste a transcript and click Generate to see the update.</div>
              </div>
            )}
          </>
        )}

        {/* ── POST-DEMO MODE ── */}
        {/* Simple input area + stub backend call. Dashboard-first means we
            keep the latest available dashboard visible at the top (post if
            available, else pre) and put inputs underneath. No extra cards. */}
        {mode === 'demo' && (
          <>
            {/* Header always visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <img src={logo} alt="Risk Rising" style={{ height: 34, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }} />
              <div>
                <h2 style={{ margin: 0, color: NAVY }}>Post-Demo</h2>
                <div style={{ fontSize: 13, color: MUTED }}>Capture demo transcript and notes; generate an updated assessment</div>
              </div>
            </div>

            {/* Declined banner (read-only mode) */}
            {opportunityStatus === 'declined' && (
              <div style={{
                padding: '12px 14px',
                marginBottom: 16,
                background: '#F1F5F9',
                border: `1px solid ${BORDER}`,
                borderLeft: `4px solid ${MUTED}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Declined
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  This opportunity is declined. Read-only.
                  {declineReason ? <span style={{ color: MUTED }}> Reason: {declineReason}</span> : null}
                </div>
              </div>
            )}

            {/* Surface the latest available dashboard for context */}
            {hasCurrentDashboard(postDashboard) ? (
              <DashboardCard dashboard={postDashboard} sourceNotes={postSourceNotes} title="Post-Discovery Dashboard" />
            ) : hasCurrentDashboard(dashboard) ? (
              <DashboardCard dashboard={dashboard} sourceNotes={sourceNotes} title="Pre-Discovery Dashboard" />
            ) : null}

            {/* Operational Metrics — V1.5a. Same panel as post-discovery.
                Refine here as the demo surfaces more accurate numbers.
                Edits stamp capturedStage = 'post_demo'. */}
            <OperationalMetricsPanel
              library={operationalMetricsLibrary}
              metrics={operationalMetrics}
              stage="post_demo"
              onEdit={handleEditOperationalMetric}
              onClear={handleClearOperationalMetric}
              disabled={opportunityStatus === 'declined'}
            />

            {/* Inputs */}
            <div style={S.card}>
              {label('Demo Transcript')}
              <textarea
                style={S.textarea}
                placeholder="Paste demo transcript here…"
                value={demoTranscript}
                onChange={(e) => setDemoTranscript(e.target.value)}
                disabled={opportunityStatus === 'declined'}
              />
              <div style={{ height: 16 }} />

              {label('Demo Notes')}
              <textarea
                style={S.textarea}
                placeholder="Paste demo notes, observations, follow-ups…"
                value={demoNotes}
                onChange={(e) => setDemoNotes(e.target.value)}
                disabled={opportunityStatus === 'declined'}
              />

              <div style={S.helper}>Post-demo updates the dashboard incrementally based on demo evidence. The prior dashboard is preserved in audit history.</div>

              {/* Solution Breakdown required hint — surface BEFORE the action
                  row so the user notices it before scrolling. The Progress
                  to Proposal button is gated on solutionResult so this is
                  the user's signal to act. */}
              {!solutionResult && opportunityStatus !== 'declined' && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: '#FEF9C3', border: '1px solid #FDE68A',
                  fontSize: 13, color: '#854D0E', lineHeight: 1.5,
                }}>
                  <strong>Solution Breakdown required.</strong> Generate the Solution Breakdown below before progressing to Proposal — it defines the Phase 1 / Phase 2 app scope used in the proposal document and value drivers.
                </div>
              )}

              <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={handleGeneratePostDemo}
                  disabled={demoLoading || opportunityStatus === 'declined'}
                  style={{
                    ...S.button,
                    background: demoLoading || opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                    color: '#fff',
                    cursor: demoLoading || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {demoLoading ? 'Generating…' : 'Generate Post-Demo Update'}
                </button>
                <button
                  onClick={handleGenerateSolutionBreakdown}
                  disabled={solutionLoading || opportunityStatus === 'declined'}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                    background: '#fff',
                    color: solutionLoading || opportunityStatus === 'declined' ? MUTED : NAVY,
                    fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                    cursor: solutionLoading || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {solutionLoading ? 'Generating…' : solutionResult ? 'Regenerate Solution Breakdown' : 'Generate Solution Breakdown'}
                </button>
                <button
                  onClick={() => handleGenerateRichBriefing('post_demo')}
                  disabled={richBriefingLoading || !hasCurrentDashboard(postDashboard) || opportunityStatus === 'declined'}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: richBriefingLoading || !hasCurrentDashboard(postDashboard) || opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                    color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                    cursor: richBriefingLoading || !hasCurrentDashboard(postDashboard) || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {richBriefingLoading ? 'Generating…' : richBriefing ? 'Regenerate Rich Briefing' : 'Generate Rich Briefing'}
                </button>
                {/* Single Download Brief button — disabled until a brief exists. */}
                <button
                  onClick={() => handleDownloadDocx(richBriefing, postCompany || company, richBriefingStage || 'post_demo')}
                  disabled={!richBriefing}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: !richBriefing ? '#94a3b8' : NAVY,
                    color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                    cursor: !richBriefing ? 'not-allowed' : 'pointer',
                  }}
                >
                  Download Brief
                </button>
                <button
                  onClick={handleProgressToProposal}
                  disabled={opportunityStatus === 'declined' || !solutionResult}
                  title={!solutionResult ? 'Generate Solution Breakdown before progressing — the Proposal stage requires it.' : ''}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: (opportunityStatus === 'declined' || !solutionResult) ? '#94a3b8' : NAVY,
                    color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                    cursor: (opportunityStatus === 'declined' || !solutionResult) ? 'not-allowed' : 'pointer',
                  }}
                >
                  Progress to Proposal →
                </button>
                <button
                  onClick={() => switchMode('post')}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                    background: '#fff', color: MUTED, fontWeight: 600, fontSize: 14,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  ← Back to Post-Discovery
                </button>
                <button
                  onClick={handleNewOpportunity}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                    background: '#fff', color: MUTED, fontWeight: 600, fontSize: 14,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  New Opportunity
                </button>
              </div>
            </div>

            {/* Inline error */}
            {demoError && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
                color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12,
              }}>
                {demoError}
              </div>
            )}

            {/* Inline rich briefing error (demo view) */}
            {richBriefingError && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
                color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12,
              }}>
                {richBriefingError}
              </div>
            )}

            {/* Rolling rich briefing preview — shown immediately once generated.
                Same content surface visible across all stages; the preview
                here lets the user see the post-demo brief inline before
                downloading. */}
            {richBriefing && (
              <div style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: '14px 18px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Rich Briefing — {richBriefingStage === 'post_demo' ? 'Post-Demo Pack' : richBriefingStage === 'post_discovery' ? 'Post-Discovery Pack' : 'Discovery Pack'} ({richBriefing.length.toLocaleString()} chars)
                </div>
                <div style={{
                  background: '#f8fafc', border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: '14px 16px', maxHeight: 600, overflowY: 'auto',
                }}>
                  <pre style={{
                    margin: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 12, lineHeight: 1.6, color: '#1e293b',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>{richBriefing}</pre>
                </div>
              </div>
            )}

            {/* Result recap — short, always visible once a generation has completed.
                Shows the score movement and a count of fields that changed. */}
            {demoResult && (
              <div style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: '14px 18px', marginBottom: 12,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Post-Demo Update
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.5 }}>
                  {demoResult}
                </div>
              </div>
            )}

            {/* Show Post-Demo Detail toggle — only renders when there's
                actually structured detail to show. Default closed per the
                brief's "do not add extra cards by default" rule. */}
            {demoSummary && (
              <div style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                marginBottom: 16, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setDemoDetailOpen((v) => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
                    {demoDetailOpen ? 'Hide Post-Demo Detail' : 'Show Post-Demo Detail'}
                  </span>
                  <span style={{ fontSize: 14, color: MUTED }}>{demoDetailOpen ? '▲' : '▼'}</span>
                </button>

                {demoDetailOpen && (
                  <div style={{ padding: '4px 18px 18px', borderTop: `1px solid ${BORDER}` }}>
                    {/* Demo effectiveness chip */}
                    {demoSummary.demo_effectiveness && (
                      <div style={{ marginTop: 14, marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 }}>
                          Demo Effectiveness
                        </span>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background: demoSummary.demo_effectiveness === 'Strong' ? '#DCFCE7'
                            : demoSummary.demo_effectiveness === 'Weak' ? '#FEE2E2'
                            : '#FEF3C7',
                          color: demoSummary.demo_effectiveness === 'Strong' ? '#15803D'
                            : demoSummary.demo_effectiveness === 'Weak' ? '#B91C1C'
                            : '#92400E',
                        }}>
                          {demoSummary.demo_effectiveness}
                        </span>
                      </div>
                    )}

                    {Array.isArray(demoSummary.what_changed) && demoSummary.what_changed.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>What Changed</div>
                        {demoSummary.what_changed.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>
                            <span style={{ color: NAVY, flexShrink: 0 }}>▸</span>
                            <span style={{ color: '#334155' }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(demoSummary.buying_signals) && demoSummary.buying_signals.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>Buying Signals</div>
                        {demoSummary.buying_signals.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>
                            <span style={{ color: '#15803D', flexShrink: 0 }}>▸</span>
                            <span style={{ color: '#334155' }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(demoSummary.new_risks) && demoSummary.new_risks.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', marginBottom: 6 }}>New Risks</div>
                        {demoSummary.new_risks.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>
                            <span style={{ color: '#B91C1C', flexShrink: 0 }}>▸</span>
                            <span style={{ color: '#334155' }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(demoSummary.recommended_follow_up) && demoSummary.recommended_follow_up.length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Recommended Follow-up</div>
                        {demoSummary.recommended_follow_up.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>
                            <span style={{ color: NAVY, flexShrink: 0 }}>▸</span>
                            <span style={{ color: '#334155' }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Solution Breakdown error */}
            {solutionError && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
                color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12,
              }}>
                {solutionError}
              </div>
            )}

            {/* Solution Breakdown — phased Risk Cloud app scope.
                Output is small and structured so we render it inline rather
                than behind a toggle. No explanation text per the brief. */}
            {solutionResult && (
              <div style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: '14px 18px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Solution Breakdown
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Proposed Scope</div>

                  {[
                    { key: 'phase_1', label: 'Phase 1 (Core)', apps: solutionResult.proposed_scope?.phase_1 || [] },
                    { key: 'phase_2', label: 'Phase 2 (Expansion)', apps: solutionResult.proposed_scope?.phase_2 || [] },
                    { key: 'optional', label: 'Optional / Future', apps: solutionResult.proposed_scope?.optional || [] },
                  ].map(({ key, label: phaseLabel, apps }) => (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{phaseLabel}</div>
                      {apps.length > 0 ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {apps.map((app, i) => (
                            <span key={i} style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              background: key === 'phase_1' ? '#DBEAFE' : key === 'phase_2' ? '#E0E7FF' : '#F1F5F9',
                              color: key === 'phase_1' ? '#1E40AF' : key === 'phase_2' ? '#3730A3' : '#475569',
                            }}>
                              {app}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Apps Considered — V1.7. Collapsible section showing apps
                    classified as 'mentioned' that didn't make it into
                    Optional (potential misses). Hidden entirely if no such
                    apps exist. */}
                {(() => {
                  const signals = Array.isArray(solutionResult.app_signals)
                    ? solutionResult.app_signals
                    : []
                  const consideredButExcluded = signals.filter(
                    (s) => s.signal === 'mentioned' && s.phase_assigned === 'excluded'
                  )
                  if (consideredButExcluded.length === 0) return null
                  return (
                    <div style={{ marginBottom: 14, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                      <button
                        onClick={() => setAppsConsideredOpen((v) => !v)}
                        style={{
                          background: 'transparent', border: 'none', padding: 0,
                          cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 13, fontWeight: 600, color: MUTED,
                        }}
                      >
                        <span style={{ fontSize: 11, color: MUTED }}>
                          {appsConsideredOpen ? '▼' : '▶'}
                        </span>
                        Apps Considered ({consideredButExcluded.length})
                        <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>
                          — potential misses to review
                        </span>
                      </button>
                      {appsConsideredOpen && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {consideredButExcluded.map((s, i) => (
                            <div key={i} style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: '#F8FAFC',
                              border: `1px dashed ${BORDER}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#F1F5F9',
                                  color: '#64748B',
                                  textDecoration: 'line-through',
                                }}>
                                  {s.app}
                                </span>
                                <span style={{
                                  fontSize: 10,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: '#FEF3C7',
                                  color: '#A16207',
                                  fontWeight: 600,
                                }}>
                                  {s.signal}
                                </span>
                              </div>
                              {s.evidence_summary && (
                                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, paddingLeft: 4 }}>
                                  {s.evidence_summary}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {solutionResult.commercial_view && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Commercial View</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13 }}>
                      <div>
                        <span style={{ color: MUTED, marginRight: 6 }}>Estimated Apps:</span>
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>
                          {solutionResult.commercial_view.estimated_apps_min}
                          {solutionResult.commercial_view.estimated_apps_min !== solutionResult.commercial_view.estimated_apps_max
                            ? `–${solutionResult.commercial_view.estimated_apps_max}`
                            : ''}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: MUTED, marginRight: 6 }}>Approach:</span>
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>
                          {solutionResult.commercial_view.implementation_approach}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: MUTED, marginRight: 6 }}>Complexity:</span>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 600,
                          background: solutionResult.commercial_view.complexity === 'Low' ? '#DCFCE7'
                            : solutionResult.commercial_view.complexity === 'High' ? '#FEE2E2'
                            : '#FEF3C7',
                          color: solutionResult.commercial_view.complexity === 'Low' ? '#15803D'
                            : solutionResult.commercial_view.complexity === 'High' ? '#B91C1C'
                            : '#92400E',
                        }}>
                          {solutionResult.commercial_view.complexity}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── PROPOSAL MODE ── */}
        {/* Output-focused stage. Two generators: Proposal Email (modal) and
            Proposal Document (markdown rendered inline, downloadable as
            .docx via the existing handleDownloadDocx pipeline). The proposal
            document REQUIRES Solution Breakdown to have been run first —
            handler surfaces a clear message if missing. */}
        {mode === 'proposal' && (
          <>
            {/* Header always visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <img src={logo} alt="Risk Rising" style={{ height: 34, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }} />
              <div>
                <h2 style={{ margin: 0, color: NAVY }}>Proposal</h2>
                <div style={{ fontSize: 13, color: MUTED }}>Generate client-facing email and proposal document</div>
              </div>
            </div>

            {/* Declined banner (read-only mode) */}
            {opportunityStatus === 'declined' && (
              <div style={{
                padding: '12px 14px',
                marginBottom: 16,
                background: '#F1F5F9',
                border: `1px solid ${BORDER}`,
                borderLeft: `4px solid ${MUTED}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Declined
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  This opportunity is declined. Read-only.
                  {declineReason ? <span style={{ color: MUTED }}> Reason: {declineReason}</span> : null}
                </div>
              </div>
            )}

            {/* Surface the latest available dashboard for context — same pattern as demo view */}
            {hasCurrentDashboard(postDashboard) ? (
              <DashboardCard dashboard={postDashboard} sourceNotes={postSourceNotes} title="Latest Dashboard" />
            ) : hasCurrentDashboard(dashboard) ? (
              <DashboardCard dashboard={dashboard} sourceNotes={sourceNotes} title="Pre-Discovery Dashboard" />
            ) : null}

            {/* Value Drivers panel — V1 of Value Case feature.
                Lets the user pick value drivers from a fixed library and edit
                their inputs. Live computes annual + 3-year savings per driver
                and aggregates. Document generation comes in V2 — for now this
                is a working sheet that travels with the opportunity. */}
            {solutionResult?.proposed_scope && (() => {
              const aggregate = computeAggregateSavings(valueDrivers, valueCaseDayRate, proposalPricing)
              const fmtUsd = (n) => `$${Math.round(n).toLocaleString('en-US')}`
              return (
                <div style={{
                  background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                  padding: '16px 18px', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Value Drivers
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        Suggested by Claude or added from the library. Edit inputs to refine.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={handleSuggestValueDrivers}
                        disabled={valueDriversLoading || opportunityStatus === 'declined'}
                        style={{
                          padding: '8px 14px', borderRadius: 8, border: 'none',
                          background: valueDriversLoading || opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                          color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                          cursor: valueDriversLoading || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {valueDriversLoading ? 'Suggesting…' : valueDrivers.length > 0 ? 'Resuggest' : 'Suggest Value Drivers'}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setAddDriverPickerOpen((v) => !v)}
                          disabled={!Array.isArray(valueCaseLibrary) || valueCaseLibrary.length === 0 || opportunityStatus === 'declined'}
                          style={{
                            padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDER}`,
                            background: '#fff', color: NAVY, fontWeight: 600, fontSize: 13,
                            fontFamily: 'inherit', cursor: 'pointer',
                          }}
                        >
                          + Add Driver
                        </button>
                        {addDriverPickerOpen && Array.isArray(valueCaseLibrary) && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              right: 0,
                              zIndex: 5,
                              background: '#fff',
                              border: `1px solid ${BORDER}`,
                              borderRadius: 10,
                              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
                              minWidth: 280,
                              padding: '6px 0',
                            }}
                          >
                            {valueCaseLibrary.map((d) => (
                              <button
                                key={d.key}
                                onClick={() => handleAddValueDriver(d.key)}
                                style={{
                                  display: 'block', width: '100%', textAlign: 'left',
                                  padding: '8px 14px', border: 'none', background: 'transparent',
                                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#1e293b',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ fontWeight: 600 }}>{d.label}</div>
                                <div style={{ fontSize: 11, color: MUTED }}>{d.app} • {d.unit === 'risk' ? 'qualitative' : d.unit === 'currency' ? 'direct $' : 'time → $'}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Day rate global setting */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
                    <label style={{ fontSize: 12, color: MUTED, flex: '0 0 120px' }}>
                      Day Rate (USD)
                    </label>
                    <span style={{ color: MUTED, fontSize: 13 }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={valueCaseDayRate}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : parseFloat(e.target.value)
                        setValueCaseDayRate(isNaN(v) || v < 0 ? 0 : v)
                      }}
                      disabled={opportunityStatus === 'declined'}
                      style={{
                        width: 100, padding: '6px 8px', borderRadius: 6,
                        border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                    <span style={{ color: MUTED, fontSize: 11 }}>used to convert time savings to dollars</span>
                  </div>

                  {/* Inline error */}
                  {valueDriversError && (
                    <div style={{
                      padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
                      color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12,
                    }}>
                      {valueDriversError}
                    </div>
                  )}

                  {/* Empty state */}
                  {valueDrivers.length === 0 && !valueDriversError && (
                    <div style={{
                      padding: '20px', textAlign: 'center', fontSize: 13, color: MUTED,
                      background: '#F8FAFC', borderRadius: 8, border: `1px dashed ${BORDER}`,
                    }}>
                      No value drivers yet. Click <strong>Suggest Value Drivers</strong> to get Claude-generated suggestions, or use <strong>+ Add Driver</strong> to pick manually.
                    </div>
                  )}

                  {/* Driver cards */}
                  {valueDrivers.map((d) => {
                    const sav = computeDriverSavings(d, valueCaseDayRate)
                    const catalogue = Array.isArray(valueCaseLibrary)
                      ? valueCaseLibrary.find((c) => c.key === d.key)
                      : null
                    const inputDefs = catalogue?.inputs || []
                    return (
                      <div key={d.instanceId} style={{
                        border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
                        marginBottom: 10, background: d.enabled ? '#fff' : '#F8FAFC',
                        opacity: d.enabled ? 1 : 0.65,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <input
                                type="checkbox"
                                checked={d.enabled}
                                onChange={() => handleToggleValueDriverEnabled(d.instanceId)}
                                disabled={opportunityStatus === 'declined'}
                                style={{ accentColor: NAVY }}
                              />
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                                {d.label}
                              </div>
                              <span style={{
                                fontSize: 11, color: MUTED, padding: '2px 6px',
                                background: '#F1F5F9', borderRadius: 4,
                              }}>
                                {d.app}
                              </span>
                              <span style={{
                                fontSize: 11, color: MUTED, padding: '2px 6px',
                                background: '#F1F5F9', borderRadius: 4,
                              }}>
                                {d.unit === 'risk' ? 'qualitative' : d.unit === 'currency' ? 'direct $' : 'time → $'}
                              </span>
                            </div>
                            {d.rationale && (
                              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                                {d.rationale}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveValueDriver(d.instanceId)}
                            disabled={opportunityStatus === 'declined'}
                            style={{
                              padding: '4px 10px', borderRadius: 6, border: `1px solid ${BORDER}`,
                              background: '#fff', color: MUTED, fontWeight: 600, fontSize: 11,
                              fontFamily: 'inherit', cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </div>

                        {/* Inputs grid */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                          {inputDefs.map((inp) => {
                            const value = d.inputs[inp.key]
                            const prov = (d.inputProvenance && d.inputProvenance[inp.key]) || { source: 'from_default' }
                            const provBadge = prov.source === 'from_metrics'
                              ? { label: 'from discovery', bg: '#DCFCE7', color: '#15803D', title: prov.notes ? `Captured ${(prov.capturedStage || '').replace('_', '-')}: ${prov.notes}` : `Captured ${(prov.capturedStage || '').replace('_', '-')}` }
                              : prov.source === 'from_suggest'
                              ? { label: 'AI inferred', bg: '#FEF3C7', color: '#A16207', title: 'Suggested by Claude based on deal context' }
                              : null
                            if (inp.type === 'select') {
                              return (
                                <div key={inp.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <label style={{ fontSize: 11, color: MUTED }}>{inp.label}</label>
                                    {provBadge && (
                                      <span title={provBadge.title} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: provBadge.bg, color: provBadge.color, fontWeight: 600 }}>
                                        {provBadge.label}
                                      </span>
                                    )}
                                  </div>
                                  <select
                                    value={value ?? inp.defaultValue}
                                    onChange={(e) => handleEditValueDriverInput(d.instanceId, inp.key, e.target.value)}
                                    disabled={opportunityStatus === 'declined'}
                                    style={{
                                      padding: '6px 8px', borderRadius: 6,
                                      border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                                    }}
                                  >
                                    {(inp.options || []).map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </div>
                              )
                            }
                            return (
                              <div key={inp.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <label style={{ fontSize: 11, color: MUTED }}>{inp.label}</label>
                                  {provBadge && (
                                    <span title={provBadge.title} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: provBadge.bg, color: provBadge.color, fontWeight: 600 }}>
                                      {provBadge.label}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {inp.type === 'currency' && <span style={{ color: MUTED, fontSize: 12 }}>$</span>}
                                  <input
                                    type="number"
                                    min="0"
                                    step={inp.type === 'currency' ? '50' : '1'}
                                    value={value ?? inp.defaultValue ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                      handleEditValueDriverInput(d.instanceId, inp.key, isNaN(v) ? 0 : v)
                                    }}
                                    disabled={opportunityStatus === 'declined'}
                                    style={{
                                      width: 90, padding: '6px 8px', borderRadius: 6,
                                      border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                                    }}
                                  />
                                  <span style={{ color: MUTED, fontSize: 11 }}>{inp.suffix || ''}</span>
                                </div>
                                {inp.helper && (
                                  <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4, maxWidth: 220 }}>
                                    {inp.helper}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Per-driver computed savings line */}
                        <div style={{
                          marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`,
                          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                          fontSize: 12,
                        }}>
                          {sav.isQualitative ? (
                            <span style={{ color: MUTED, fontStyle: 'italic' }}>
                              Qualitative — surfaces in narrative, not in totals
                            </span>
                          ) : (
                            <>
                              <span style={{ color: MUTED }}>Annual savings:</span>
                              <strong style={{ color: NAVY }}>{fmtUsd(sav.annualSavings)}</strong>
                              <span style={{ color: MUTED }}>•</span>
                              <span style={{ color: MUTED }}>3-year:</span>
                              <strong style={{ color: NAVY }}>{fmtUsd(sav.threeYearSavings)}</strong>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Business Case Narrative panel — V1.6.
                      Aggregate narrative produced alongside drivers.
                      Editable inline; "Edited" badge appears once the rep
                      modifies it. Only shown when there's content (drivers
                      or narrative present) — empty state collapses. */}
                  {(valueCaseNarrative || valueDrivers.length > 0) && (
                    <div style={{
                      marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Business Case Narrative
                          </div>
                          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                            Cohesive story to brief the prospect — anchors the maths in their words. Edit freely.
                          </div>
                        </div>
                        {valueCaseNarrativeEdited && valueCaseNarrative && (
                          <span style={{
                            fontSize: 10, padding: '3px 8px', borderRadius: 4,
                            background: '#FEF3C7', color: '#A16207', fontWeight: 600,
                          }}>
                            Edited
                          </span>
                        )}
                      </div>
                      {valueCaseNarrative ? (
                        <textarea
                          value={valueCaseNarrative}
                          onChange={(e) => handleEditValueCaseNarrative(e.target.value)}
                          disabled={opportunityStatus === 'declined'}
                          rows={Math.min(20, Math.max(8, valueCaseNarrative.split('\n').length + 2))}
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 8,
                            border: `1px solid ${BORDER}`, fontSize: 13, lineHeight: 1.6,
                            fontFamily: 'inherit', color: '#1e293b', background: '#fff',
                            resize: 'vertical', boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <div style={{
                          padding: '20px', textAlign: 'center',
                          background: '#F8FAFC', borderRadius: 8, border: `1px dashed ${BORDER}`,
                        }}>
                          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
                            No business case narrative yet. {valueDrivers.length > 0
                              ? 'Generating will replace your current value drivers — they\'re produced together.'
                              : 'A cohesive story will be produced alongside the suggested drivers.'}
                          </div>
                          <button
                            onClick={handleSuggestValueDrivers}
                            disabled={valueDriversLoading || opportunityStatus === 'declined'}
                            style={{
                              padding: '8px 14px', borderRadius: 8, border: 'none',
                              background: valueDriversLoading || opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                              color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                              cursor: valueDriversLoading || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {valueDriversLoading ? 'Generating…' : 'Generate Narrative'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aggregate footer */}
                  {valueDrivers.length > 0 && (aggregate.year1 > 0 || aggregate.threeYear > 0) && (
                    <div style={{
                      marginTop: 14, paddingTop: 12, borderTop: `2px solid ${BORDER}`,
                      display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
                      fontSize: 13,
                    }}>
                      <div>
                        <span style={{ color: MUTED, fontSize: 11, display: 'block' }}>Year 1 Savings</span>
                        <strong style={{ color: NAVY, fontSize: 16 }}>{fmtUsd(aggregate.year1)}</strong>
                      </div>
                      <div>
                        <span style={{ color: MUTED, fontSize: 11, display: 'block' }}>3-Year Savings</span>
                        <strong style={{ color: NAVY, fontSize: 16 }}>{fmtUsd(aggregate.threeYear)}</strong>
                      </div>
                      {aggregate.tcv && (
                        <div>
                          <span style={{ color: MUTED, fontSize: 11, display: 'block' }}>3-Year Deal Cost (TCV)</span>
                          <strong style={{ color: NAVY, fontSize: 16 }}>{fmtUsd(aggregate.tcv)}</strong>
                        </div>
                      )}
                      {aggregate.roiRatio && (
                        <>
                          <div>
                            <span style={{ color: MUTED, fontSize: 11, display: 'block' }}>ROI Ratio</span>
                            <strong style={{ color: '#15803D', fontSize: 16 }}>{aggregate.roiRatio.toFixed(1)}x</strong>
                          </div>
                          {aggregate.paybackMonths && (
                            <div>
                              <span style={{ color: MUTED, fontSize: 11, display: 'block' }}>Payback</span>
                              <strong style={{ color: '#15803D', fontSize: 16 }}>{aggregate.paybackMonths} mo</strong>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
                    V1 — drivers persist with the opportunity. ROI ratio shown only when 3-year savings exceed deal TCV. Document generation arrives in V2.
                  </div>
                </div>
              )
            })()}

            {/* Commercial inputs — pricing for the Commercial Structure section
                of the proposal document. Per-app prices for Phase 1 + Phase 2
                apps from the Solution Breakdown. Deal-level toggles for power
                users, API, implementation, and managed service. The proposal
                document section is built deterministically server-side using
                these values; Claude does not invent numbers. Section is only
                shown if Solution Breakdown has been run (otherwise Generate
                Proposal Document is blocked anyway). */}
            {solutionResult?.proposed_scope && (
              <div style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: '16px 18px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Commercial Inputs (USD)
                </div>

                {/* Per-app subscription rows — Phase 1 + Phase 2 only */}
                {(() => {
                  const scopedApps = [
                    ...(solutionResult.proposed_scope.phase_1 || []),
                    ...(solutionResult.proposed_scope.phase_2 || []),
                  ]
                  if (scopedApps.length === 0) {
                    return (
                      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
                        No apps in scope yet — generate Solution Breakdown first.
                      </div>
                    )
                  }
                  return (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                        Software Subscription (annual, per app)
                      </div>
                      {scopedApps.map((app) => (
                        <div key={app} style={{
                          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                        }}>
                          <div style={{ flex: '0 0 200px', fontSize: 13, color: '#1e293b' }}>{app}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: MUTED, fontSize: 13 }}>$</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={proposalPricing.perAppPrices[app] ?? ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                setProposalPricing((prev) => ({
                                  ...prev,
                                  perAppPrices: { ...prev.perAppPrices, [app]: value },
                                }))
                              }}
                              disabled={opportunityStatus === 'declined'}
                              style={{
                                width: 110, padding: '6px 8px', borderRadius: 6,
                                border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  )
                })()}

                {/* Deal-level toggles */}
                <div style={{
                  marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                    Deal-Level Inputs (toggle to include in document)
                  </div>

                  {/* Power Users — special-case row with qty + price.
                      The qty appears in the document output as
                      "[Qty] Power Users: $[amount]" if > 0; if qty is 0 the
                      output drops to "Power Users: $[amount]" with no qty. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      flex: '0 0 220px', fontSize: 13, color: '#1e293b',
                      cursor: opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={Boolean(proposalPricing.powerUsersEnabled)}
                        onChange={(e) =>
                          setProposalPricing((prev) => ({ ...prev, powerUsersEnabled: e.target.checked }))
                        }
                        disabled={opportunityStatus === 'declined'}
                        style={{ accentColor: NAVY }}
                      />
                      Power Users
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Qty"
                        value={proposalPricing.powerUsersQty || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                          setProposalPricing((prev) => ({ ...prev, powerUsersQty: isNaN(value) ? 0 : value }))
                        }}
                        disabled={opportunityStatus === 'declined' || !proposalPricing.powerUsersEnabled}
                        style={{
                          width: 60, padding: '6px 8px', borderRadius: 6,
                          border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                          opacity: proposalPricing.powerUsersEnabled ? 1 : 0.5,
                        }}
                      />
                      <span style={{ color: MUTED, fontSize: 11 }}>users</span>
                      <span style={{ color: MUTED, fontSize: 13, marginLeft: 8 }}>$</span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={proposalPricing.powerUsersPrice ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value)
                          setProposalPricing((prev) => ({ ...prev, powerUsersPrice: value }))
                        }}
                        disabled={opportunityStatus === 'declined' || !proposalPricing.powerUsersEnabled}
                        style={{
                          width: 110, padding: '6px 8px', borderRadius: 6,
                          border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                          opacity: proposalPricing.powerUsersEnabled ? 1 : 0.5,
                        }}
                      />
                      <span style={{ color: MUTED, fontSize: 11 }}>annual</span>
                    </div>
                  </div>

                  {/* Remaining deal-level toggles (excluding Power Users) */}
                  {[
                    { key: 'api', label: 'API / Integrations', valueField: 'apiPrice', enabledField: 'apiEnabled', suffix: 'annual' },
                    { key: 'implementation', label: 'Implementation (per app)', valueField: 'implementationPerApp', enabledField: 'implementationEnabled', suffix: 'one-off' },
                    { key: 'managedService', label: 'Managed Service', valueField: 'managedServicePrice', enabledField: 'managedServiceEnabled', suffix: 'annual' },
                  ].map(({ key, label: rowLabel, valueField, enabledField, suffix }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        flex: '0 0 220px', fontSize: 13, color: '#1e293b',
                        cursor: opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={Boolean(proposalPricing[enabledField])}
                          onChange={(e) =>
                            setProposalPricing((prev) => ({ ...prev, [enabledField]: e.target.checked }))
                          }
                          disabled={opportunityStatus === 'declined'}
                          style={{ accentColor: NAVY }}
                        />
                        {rowLabel}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: MUTED, fontSize: 13 }}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={proposalPricing[valueField] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value)
                            setProposalPricing((prev) => ({ ...prev, [valueField]: value }))
                          }}
                          disabled={opportunityStatus === 'declined' || !proposalPricing[enabledField]}
                          style={{
                            width: 110, padding: '6px 8px', borderRadius: 6,
                            border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                            opacity: proposalPricing[enabledField] ? 1 : 0.5,
                          }}
                        />
                        <span style={{ color: MUTED, fontSize: 11 }}>{suffix}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Investment Summary metadata — Term + Billing Frequency.
                    Both optional free-text fields. Empty values are omitted
                    from the document. Sit beneath the deal-level toggles. */}
                <div style={{
                  marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                    Investment Summary Metadata (optional)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <label style={{ flex: '0 0 220px', fontSize: 13, color: '#1e293b' }}>
                      Term <span style={{ color: '#B91C1C' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 36 months, 3 years"
                      value={proposalPricing.term || ''}
                      onChange={(e) =>
                        setProposalPricing((prev) => ({ ...prev, term: e.target.value }))
                      }
                      disabled={opportunityStatus === 'declined'}
                      style={{
                        flex: 1, maxWidth: 220, padding: '6px 8px', borderRadius: 6,
                        border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <label style={{ flex: '0 0 220px', fontSize: 13, color: '#1e293b' }}>
                      Billing Frequency
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Annual"
                      value={proposalPricing.billingFrequency || ''}
                      onChange={(e) =>
                        setProposalPricing((prev) => ({ ...prev, billingFrequency: e.target.value }))
                      }
                      disabled={opportunityStatus === 'declined'}
                      style={{
                        flex: 1, maxWidth: 220, padding: '6px 8px', borderRadius: 6,
                        border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
                  Numbers above are passed verbatim into the Commercial Summary block of the proposal document. Implementation total = per-app cost × number of apps in scope. Lines without values are omitted.
                </div>
              </div>
            )}

            {/* Action row — three buttons + Back + New Opportunity */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button
                onClick={handleGenerateProposalEmail}
                disabled={proposalEmailLoading || opportunityStatus === 'declined'}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: proposalEmailLoading || opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                  color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                  cursor: proposalEmailLoading || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                }}
              >
                {proposalEmailLoading ? 'Generating…' : proposalEmail ? 'Regenerate Proposal Email' : 'Generate Proposal Email'}
              </button>
              <button
                onClick={handleGenerateProposalDocument}
                disabled={proposalDocumentLoading || opportunityStatus === 'declined'}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: proposalDocumentLoading || opportunityStatus === 'declined' ? '#94a3b8' : NAVY,
                  color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                  cursor: proposalDocumentLoading || opportunityStatus === 'declined' ? 'not-allowed' : 'pointer',
                }}
              >
                {proposalDocumentLoading ? 'Generating…' : proposalDocument ? 'Regenerate Proposal Document' : 'Generate Proposal Document'}
              </button>
              {/* Download Proposal — disabled until a document exists.
                  Uses the same .docx pipeline as the rich briefing for
                  consistent visual style. */}
              <button
                onClick={() => handleDownloadDocx(proposalDocument, postCompany || company, 'proposal')}
                disabled={!proposalDocument}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: !proposalDocument ? '#94a3b8' : NAVY,
                  color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                  cursor: !proposalDocument ? 'not-allowed' : 'pointer',
                }}
              >
                Download Proposal
              </button>
              <button
                onClick={() => switchMode('demo')}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                  background: '#fff', color: MUTED, fontWeight: 600, fontSize: 14,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                ← Back to Post-Demo
              </button>
              <button
                onClick={handleNewOpportunity}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
                  background: '#fff', color: MUTED, fontWeight: 600, fontSize: 14,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                New Opportunity
              </button>
            </div>

            {/* Inline error — proposal document */}
            {proposalDocumentError && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
                color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12,
              }}>
                {proposalDocumentError}
              </div>
            )}

            {/* Proposal Document preview — shown inline once generated */}
            {proposalDocument && (
              <div style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: '14px 18px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Proposal Document ({proposalDocument.length.toLocaleString()} chars)
                </div>
                <div style={{
                  background: '#f8fafc', border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: '14px 16px', maxHeight: 600, overflowY: 'auto',
                }}>
                  <pre style={{
                    margin: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 12, lineHeight: 1.6, color: '#1e293b',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>{proposalDocument}</pre>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DEAL STRATEGY MODE ── */}
        {mode === 'strategy' && (
          <>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <img src={logo} alt="Risk Rising" style={{ height: 34, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }} />
                <div>
                  <h2 style={{ margin: 0, color: NAVY }}>Deal Strategy</h2>
                  <div style={{ fontSize: 13, color: MUTED }}>Convert your post-discovery assessment into an execution plan</div>
                </div>
              </div>

              {label('Post-Discovery Output *')}
              {postResult && strategyInput === postResult && (
                <div style={{
                  fontSize: 12,
                  color: GREEN,
                  fontWeight: 600,
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}>
                  ✓ Auto-populated from Stage 2 output
                </div>
              )}
              <textarea
                style={{ ...S.textareaLarge, minHeight: '280px' }}
                placeholder="Paste the full post-discovery update output here…"
                value={strategyInput}
                onChange={(e) => setStrategyInput(e.target.value)}
              />

              <div style={S.helper}>
                Paste the output from the Post-Discovery Update tab. The strategy engine will convert it into a concrete execution plan — no re-analysis, just decisions and actions.
              </div>

              <div style={{ marginTop: 18 }}>
                <button
                  style={{
                    ...S.button,
                    background: !strategyInput.trim() || loading ? '#94a3b8' : NAVY,
                    color: '#fff',
                    cursor: !strategyInput.trim() || loading ? 'not-allowed' : 'pointer',
                  }}
                  disabled={!strategyInput.trim() || loading}
                  onClick={handleDealStrategy}
                >
                  {loading ? 'Generating…' : 'Generate Deal Strategy'}
                </button>
              </div>
            </div>

            {status ? <div style={S.status}>{status}</div> : null}
            {error ? <div style={S.error}>{error}</div> : null}

            {/* Strategy output */}
            {/* Strategy dashboard */}
            {strategyResult ? (
              <>
                {/* ── DASHBOARD CARD ── */}
                {(() => {
                  const stratMap = sectionMapFromText(strategyResult)
                  const callSection = stratMap.get('Deal Strategy Call')
                  let callDecision = ''
                  let callWhy = ''
                  if (callSection) {
                    for (const item of callSection.content) {
                      const text = clean(item.text)
                      const lc = text.toLowerCase()
                      if (lc.startsWith('why:')) callWhy = text.slice(text.indexOf(':') + 1).trim()
                      else if (!callDecision && (lc.includes('push') || lc.includes('shape') || lc.includes('slow') || lc.includes('qualify out'))) callDecision = removeBulletPrefix(text)
                    }
                  }
                  const isQualifyOut = callDecision.toLowerCase().includes('qualify out') || callDecision.toLowerCase().includes('slow')
                  const isPush = callDecision.toLowerCase().includes('push')
                  const col = isPush ? GREEN : isQualifyOut ? RED : AMBER
                  const bg = isPush ? '#dcfce7' : isQualifyOut ? '#fee2e2' : '#fef9c3'

                  const objectives = parseSection(strategyResult, 'Next Call Objectives (Non-Negotiable)').slice(0, 3)
                  const questions = parseSection(strategyResult, 'Exact Questions to Ask (Next Call)').slice(0, 3)

                  return (
                    <div style={S.card}>
                      {/* Deal call decision */}
                      {callDecision && (
                        <div style={{ background: bg, borderRadius: 8, padding: '12px 14px', marginBottom: 16, borderLeft: `4px solid ${col}` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Deal Strategy Call</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: col, marginBottom: callWhy ? 6 : 0 }}>{callDecision}</div>
                          {callWhy && <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{callWhy}</div>}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Next Call Objectives</div>
                          {objectives.map((o, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13, lineHeight: 1.45 }}>
                              <span style={{ color: NAVY, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                              <span style={{ color: '#334155' }}>{removeBulletPrefix(o)}</span>
                            </div>
                          ))}
                          {!objectives.length && <div style={{ fontSize: 13, color: MUTED }}>No objectives defined.</div>}
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Key Questions</div>
                          {questions.map((q, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13, lineHeight: 1.45 }}>
                              <span style={{ color: NAVY, fontWeight: 700, flexShrink: 0 }}>Q{i + 1}</span>
                              <span style={{ color: '#334155' }}>{removeBulletPrefix(q)}</span>
                            </div>
                          ))}
                          {!questions.length && <div style={{ fontSize: 13, color: MUTED }}>No questions defined.</div>}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Export + action buttons */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button style={S.secondaryButton} onClick={() => exportExecutionDoc(postCompany || company, strategyResult, strategyStructured)}>
                    Download DOCX
                  </button>
                  <button style={S.secondaryButton} onClick={() => exportJson({ company: postCompany || company, generated_at: new Date().toISOString(), structured: strategyStructured, execution_packet: executionPacket }, `${clean(postCompany || company) || 'execution'}_strategy.json`)}>
                    Download JSON
                  </button>
                  <button
                    style={{ ...S.secondaryButton, opacity: scorecardLoading ? 0.6 : 1, cursor: scorecardLoading ? 'not-allowed' : 'pointer' }}
                    disabled={scorecardLoading}
                    onClick={() => handleGenerateScorecard('execution', strategyResult, setExecScorecard)}
                  >
                    {scorecardLoading ? 'Scoring…' : execScorecard ? 'Refresh Scorecard' : 'Scorecard'}
                  </button>
                </div>

                {execScorecard && (
                  <>
                    <ScorecardPanel scorecard={execScorecard} onDismiss={() => setExecScorecard(null)} />
                    <DeltaScoreWidget
                      currentScore={execDeltaResult?.deal_score ?? execScorecard.overall_score}
                      stage="execution"
                      notes={execDeltaNotes}
                      onNotesChange={setExecDeltaNotes}
                      onUpdate={() => handleUpdateScore({ stage: 'execution', previousScore: execDeltaResult?.deal_score ?? execScorecard.overall_score, newInformation: execDeltaNotes, setResultFn: setExecDeltaResult })}
                      loading={deltaLoading}
                      result={execDeltaResult}
                    />
                  </>
                )}

                {/* Collapsible full strategy */}
                <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                  <button
                    onClick={() => setStratDetailOpen(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Full Strategy Output</span>
                    <span style={{ fontSize: 15, color: MUTED }}>{stratDetailOpen ? '▲' : '▼'}</span>
                  </button>
                  {stratDetailOpen && (
                    <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 18px' }}>
                      {/* Positioning + What to Avoid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={S.sectionHeaderBar}>Positioning to Push</div>
                          {renderBullets(parseSection(strategyResult, 'Positioning to Push'), 'No positioning defined.')}
                        </div>
                        <div>
                          <div style={{ ...S.sectionHeaderBar, background: '#fee2e2', color: RED }}>What to Avoid</div>
                          {renderBullets(parseSection(strategyResult, 'What to Avoid'), 'No avoidance items.')}
                        </div>
                      </div>
                      {/* Commercial + Stakeholder */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={S.sectionHeaderBar}>Commercial Strategy</div>
                          {renderBullets(parseSection(strategyResult, 'Commercial Strategy'), 'No commercial strategy.')}
                        </div>
                        <div>
                          <div style={S.sectionHeaderBar}>Stakeholder Strategy</div>
                          {(() => {
                            const stratMap = sectionMapFromText(strategyResult)
                            const section = stratMap.get('Stakeholder Strategy')
                            if (!section) return <div style={{ color: MUTED, fontSize: 13 }}>No stakeholder strategy defined.</div>
                            return section.content.map((item, idx) => {
                              if (item.type === 'blank') return null
                              if (item.type === 'bullet') return bulletRow(item.text, idx)
                              if (item.type === 'paragraph') {
                                const text = clean(item.text)
                                if (!text) return null
                                const isLabel = text.toLowerCase().startsWith('who you need:') || text.toLowerCase().startsWith('how to get them:')
                                return (
                                  <div key={idx} style={{ marginBottom: 6, fontSize: 14, lineHeight: 1.6 }}>
                                    {isLabel ? <><strong style={{ color: NAVY }}>{text.slice(0, text.indexOf(':') + 1)}</strong>{text.slice(text.indexOf(':') + 1)}</> : text}
                                  </div>
                                )
                              }
                              return null
                            })
                          })()}
                        </div>
                      </div>
                      {/* Follow-up email */}
                      {(() => {
                        const stratMap = sectionMapFromText(strategyResult)
                        const section = stratMap.get('Follow-Up Email (Send Immediately)')
                        if (!section) return null
                        const emailText = section.content.filter(i => i.type === 'paragraph' || i.type === 'bullet').map(i => clean(i.text)).filter(Boolean).join('\n\n')
                        if (!emailText) return null
                        return (
                          <div style={{ marginBottom: 16 }}>
                            <div style={S.sectionHeaderBar}>Follow-Up Email</div>
                            <div style={{ background: '#f8fafc', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#1e293b' }}>{emailText}</div>
                          </div>
                        )
                      })()}
                      {/* Reality check + Win/Lose */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={{ ...S.sectionHeaderBar, background: '#fee2e2', color: RED }}>Internal Reality Check</div>
                          {renderBullets(parseSection(strategyResult, 'Internal Reality Check (Brutal)'), 'No reality check.')}
                        </div>
                        <div>
                          <div style={S.sectionHeaderBar}>Win / Lose Path</div>
                          {(() => {
                            const stratMap = sectionMapFromText(strategyResult)
                            const winBullets = getSectionBullets(stratMap, 'Win Path')
                            const loseBullets = getSectionBullets(stratMap, 'Lose Path')
                            return (
                              <>
                                {winBullets.length > 0 && <><div style={{ fontWeight: 700, color: GREEN, marginBottom: 4, fontSize: 12 }}>Win Path</div>{renderBullets(winBullets)}</>}
                                {loseBullets.length > 0 && <><div style={{ fontWeight: 700, color: RED, marginTop: 10, marginBottom: 4, fontSize: 12 }}>Lose Path</div>{renderBullets(loseBullets)}</>}
                                {!winBullets.length && !loseBullets.length && <div style={{ color: MUTED, fontSize: 13 }}>No paths defined.</div>}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      <div style={S.outputWrap}>{renderDetailedSections(strategyResult)}</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={S.card}>
                <div style={{ color: MUTED }}>Paste a post-discovery output above and click Generate.</div>
              </div>
            )}
          </>
        )}

        {/* ── SOW GENERATOR MODE ── */}
        {mode === 'sow' && (
          <>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <img src={logo} alt="Risk Rising" style={{ height: 34, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }} />
                <div>
                  <h2 style={{ margin: 0, color: NAVY }}>Generate SoW</h2>
                  <div style={{ fontSize: 13, color: MUTED }}>Statement of Work scope generator</div>
                </div>
              </div>

              {/* Profile selector */}
              {label('Scope Profile')}
              <select
                style={{ ...S.input, marginBottom: 16, cursor: 'pointer' }}
                value={sowProfileId}
                onChange={(e) => handleSowProfileSelect(e.target.value)}
              >
                <option value="">— Select a profile —</option>
                {sowProfiles.map((p) => (
                  <option key={p.profile_id} value={p.profile_id}>{p.display_name}</option>
                ))}
              </select>

              {sowSelectedProfile && (
                <>
                  {/* Profile description */}
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 20, padding: '10px 14px', background: NAVY_LIGHT, borderRadius: 8 }}>
                    {sowSelectedProfile.description}
                    <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>
                      Typical delivery: {sowSelectedProfile.typical_duration_weeks} weeks · {sowSelectedProfile.typical_effort_days} consultant days
                    </div>
                  </div>

                  {/* Core modules (always included, shown but not toggleable) */}
                  {sowSelectedProfile.modules?.core?.length > 0 && (
                    <>
                      {label('Core Modules (always included)')}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                        {sowSelectedProfile.modules.core.map((m) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                            <span style={{ fontSize: 16, color: GREEN, flexShrink: 0, marginTop: 1 }}>✓</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{m.name}</div>
                              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{m.internal_description}</div>
                              <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{m.effort_days}d estimated</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Optional modules */}
                  {sowSelectedProfile.modules?.optional?.length > 0 && (
                    <>
                      {label('Optional Modules')}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                        {sowSelectedProfile.modules.optional.map((m) => {
                          const selected = sowSelectedModules.includes(m.id)
                          return (
                            <div
                              key={m.id}
                              onClick={() => handleSowModuleToggle(m.id)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                                border: `1px solid ${selected ? NAVY : BORDER}`,
                                background: selected ? NAVY_LIGHT : '#fff',
                                transition: 'all 0.1s',
                              }}
                            >
                              <span style={{ fontSize: 16, color: selected ? NAVY : '#cbd5e1', flexShrink: 0, marginTop: 1 }}>
                                {selected ? '☑' : '☐'}
                              </span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: selected ? NAVY : '#334155' }}>{m.name}</div>
                                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{m.internal_description}</div>
                                <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                                  {m.effort_days}d estimated
                                  {!m.ai_safe && <span style={{ marginLeft: 8, color: AMBER, fontWeight: 600 }}>· Consultant review required</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Complexity drivers */}
                  {sowSelectedProfile.complexity_drivers?.length > 0 && (
                    <>
                      {label('Complexity Drivers (tick any that apply)')}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {sowSelectedProfile.complexity_drivers.map((d) => {
                          const selected = sowSelectedComplexity.includes(d.id)
                          return (
                            <button
                              key={d.id}
                              onClick={() => handleSowComplexityToggle(d.id)}
                              style={{
                                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                border: `1px solid ${selected ? NAVY : BORDER}`,
                                background: selected ? NAVY : '#fff',
                                color: selected ? '#fff' : '#334155',
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              {d.label} (+{d.effort_adjustment_days}d)
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Effort estimate */}
                  {(() => {
                    const allMods = [...(sowSelectedProfile.modules?.core || []), ...(sowSelectedProfile.modules?.optional || [])]
                    const modDays = allMods.filter(m => sowSelectedModules.includes(m.id)).reduce((s, m) => s + (m.effort_days || 0), 0)
                    const compDays = (sowSelectedProfile.complexity_drivers || []).filter(d => sowSelectedComplexity.includes(d.id)).reduce((s, d) => s + (d.effort_adjustment_days || 0), 0)
                    const total = modDays + compDays
                    return (
                      <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 16, fontSize: 13 }}>
                        <span style={{ color: MUTED }}>Estimated effort: </span>
                        <strong style={{ color: NAVY }}>{total} consultant days</strong>
                        {compDays > 0 && <span style={{ color: MUTED }}> ({modDays}d modules + {compDays}d complexity)</span>}
                      </div>
                    )
                  })()}

                  {/* Consultant input fields */}
                  {sowSelectedProfile.consultant_inputs?.length > 0 && (
                    <>
                      {label('Engagement Details')}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        {sowSelectedProfile.consultant_inputs.map((field) => (
                          <div key={field.id}>
                            <label style={{ display: 'block', fontSize: 12, color: MUTED, fontWeight: 600, marginBottom: 4 }}>
                              {field.label}{field.required && <span style={{ color: RED }}> *</span>}
                            </label>
                            <input
                              style={{ ...S.input, fontSize: 13 }}
                              placeholder={field.placeholder}
                              value={sowInputs[field.id] || ''}
                              onChange={(e) => handleSowInputChange(field.id, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {sowError && <div style={S.error}>{sowError}</div>}

                  <button
                    style={{
                      ...S.button,
                      background: sowLoading ? '#94a3b8' : NAVY,
                      color: '#fff',
                      cursor: sowLoading ? 'not-allowed' : 'pointer',
                    }}
                    disabled={sowLoading}
                    onClick={handleGenerateSoW}
                  >
                    {sowLoading ? 'Generating SoW…' : 'Generate SoW Draft'}
                  </button>
                </>
              )}
            </div>

            {/* SoW output */}
            {sowResult && (
              <>
                {/* Summary bar */}
                <div style={{ padding: '12px 16px', background: NAVY_LIGHT, borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                  <span><strong style={{ color: NAVY }}>{sowResult.customer_name}</strong></span>
                  <span style={{ color: MUTED }}>|</span>
                  <span style={{ color: MUTED }}>{sowResult.profile_name}</span>
                  <span style={{ color: MUTED }}>|</span>
                  <span style={{ color: MUTED }}>{sowResult.module_count} modules</span>
                  <span style={{ color: MUTED }}>|</span>
                  <span><strong style={{ color: NAVY }}>{sowResult.effort?.total_days}d</strong> <span style={{ color: MUTED }}>estimated</span></span>
                  <span style={{ color: MUTED }}>|</span>
                  <span style={{ fontSize: 11, color: MUTED }}>Generated {new Date(sowResult.generated_at).toLocaleDateString('en-GB')}</span>
                </div>

                {/* Output card */}
                <div style={S.card}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <button style={S.secondaryButton} onClick={handleSowExportText}>
                      Export Draft (.txt)
                    </button>
                    <button
                      style={S.secondaryButton}
                      onClick={() => exportJson(sowResult, `${(sowResult.customer_name || 'sow').replace(/\s+/g, '_').toLowerCase()}_sow.json`)}
                    >
                      Export JSON
                    </button>
                  </div>
                  <div style={S.outputWrap}>{renderDetailedSections(sowResult.result)}</div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Contact Capture — persistent footer across all stages ── */}
        <ContactCapture
          open={contactsOpen}
          onToggle={() => setContactsOpen((v) => !v)}
          textInput={contactTextInput}
          onTextChange={setContactTextInput}
          imageFiles={contactImageFiles}
          onImageChange={handleContactImageFiles}
          imageRef={contactImageRef}
          proposedContacts={proposedContacts}
          onUpdateProposed={updateProposedContact}
          onClear={handleClearContacts}
          savedContacts={savedContacts}
          loading={contactsLoading}
          error={contactsError}
          onExtract={handleExtractContacts}
          onSave={handleSaveContacts}
          opportunityId={opportunityId}
          enrichingId={enrichingId}
          onOpenEnrich={openEnrich}
          onCloseEnrich={closeEnrich}
          enrichText={enrichText}
          onEnrichTextChange={setEnrichText}
          enrichImageFile={enrichImageFile}
          onEnrichImageChange={(e) => {
            const f = e.target.files?.[0] || null
            setEnrichImageFile(f)
            if (enrichImageRef.current) enrichImageRef.current.value = ''
          }}
          enrichImageRef={enrichImageRef}
          enrichLoading={enrichLoading}
          enrichError={enrichError}
          enrichResult={enrichResult}
          onEnrichSubmit={handleEnrichContact}
        />

        {/* ── Audit Trail — persistent footer across all stages ── */}
        {(opportunityId || auditEvents.length > 0) && (
          <AuditTrail
            events={auditEvents}
            opportunityId={opportunityId}
            open={auditOpen}
            onToggle={() => setAuditOpen((v) => !v)}
            manualNoteText={manualNoteText}
            onNoteChange={setManualNoteText}
            onAddNote={handleAddManualNote}
          />
        )}

        {/* Follow-up Email modal — overlay, no permanent UI footprint.
            Renders only when emailsModalOpen is true. Closing returns the
            app to its prior visible state. */}
        {emailsModalOpen && (
          <div
            onClick={handleCloseEmailsModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: '60px 16px 16px',
              zIndex: 1000,
              overflowY: 'auto',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 14,
                width: '100%',
                maxWidth: 720,
                boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: `1px solid ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Follow-up Emails
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginTop: 2 }}>
                    Three drafts ready to copy
                  </div>
                </div>
                <button
                  onClick={handleCloseEmailsModal}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    background: '#fff',
                    color: MUTED,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                {emailsLoading && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: MUTED, fontSize: 14 }}>
                    Generating three email drafts…
                  </div>
                )}

                {!emailsLoading && emailsError && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#FEE2E2',
                    color: '#991B1B',
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {emailsError}
                  </div>
                )}

                {!emailsLoading && !emailsError && emailsResult && (
                  <>
                    {[
                      { key: 'followup', label: 'Follow-up Email', email: emailsResult.followup },
                      { key: 'clarification', label: 'Clarification Email', email: emailsResult.clarification },
                      { key: 'nudge', label: 'Nudge Email', email: emailsResult.nudge },
                    ].map(({ key, label, email }, idx) => (
                      <div
                        key={key}
                        style={{
                          marginTop: idx === 0 ? 0 : 16,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{
                          padding: '10px 14px',
                          background: '#F8FAFC',
                          borderBottom: `1px solid ${BORDER}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {label}
                          </div>
                          <button
                            onClick={() => handleCopyEmail(key, email)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: emailsCopiedKey === key ? `1px solid #16A34A` : `1px solid ${BORDER}`,
                              background: emailsCopiedKey === key ? '#DCFCE7' : '#fff',
                              color: emailsCopiedKey === key ? '#15803D' : NAVY,
                              fontSize: 12,
                              fontWeight: 600,
                              fontFamily: 'inherit',
                              cursor: 'pointer',
                              minWidth: 70,
                            }}
                          >
                            {emailsCopiedKey === key ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Subject
                          </div>
                          <div style={{ fontSize: 14, color: '#1e293b', marginBottom: 12, fontWeight: 600 }}>
                            {email?.subject || '(no subject)'}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Body
                          </div>
                          <div style={{
                            fontSize: 13,
                            color: '#1e293b',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}>
                            {email?.body || '(no body)'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Proposal Email modal — overlay, no permanent UI footprint.
            Single email (no variants), Copy + Close. Same UX pattern as
            the Follow-up Email modal but simpler. Closing the modal hides
            the visible surface; the email content persists in localStorage. */}
        {proposalEmailModalOpen && (
          <div
            onClick={handleCloseProposalEmailModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: '60px 16px 16px',
              zIndex: 1000,
              overflowY: 'auto',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 14,
                width: '100%',
                maxWidth: 720,
                boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: `1px solid ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Proposal Email
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginTop: 2 }}>
                    Ready to copy
                  </div>
                </div>
                <button
                  onClick={handleCloseProposalEmailModal}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    background: '#fff',
                    color: MUTED,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                {proposalEmailLoading && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: MUTED, fontSize: 14 }}>
                    Generating proposal email…
                  </div>
                )}

                {!proposalEmailLoading && proposalEmailError && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#FEE2E2',
                    color: '#991B1B',
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {proposalEmailError}
                  </div>
                )}

                {!proposalEmailLoading && !proposalEmailError && proposalEmail && (
                  <div style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      borderBottom: `1px solid ${BORDER}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Proposal Email
                      </div>
                      <button
                        onClick={handleCopyProposalEmail}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: proposalEmailCopied ? `1px solid #16A34A` : `1px solid ${BORDER}`,
                          background: proposalEmailCopied ? '#DCFCE7' : '#fff',
                          color: proposalEmailCopied ? '#15803D' : NAVY,
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          minWidth: 70,
                        }}
                      >
                        {proposalEmailCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Subject
                      </div>
                      <div style={{ fontSize: 14, color: '#1e293b', marginBottom: 12, fontWeight: 600 }}>
                        {proposalEmail.subject || '(no subject)'}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Body
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: '#1e293b',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {proposalEmail.body || '(no body)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}