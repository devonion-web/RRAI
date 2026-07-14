export const MODULES = [
  {
    id: 'rfp',
    title: 'RFP Response Drafter',
    description:
      'Upload a bid pack, set an engagement profile, decompose the document into requirements, map ownership (RR / LogicGate / shared), generate minimum-first block responses, fill gaps, approve, and export per-requirement .docx files.',
    status: 'active',
    icon: '📋',
    category: 'Sales',
  },
  {
    id: 'logicgate',
    title: 'LogicGate Specialist',
    description:
      'Pre-discovery prep, post-discovery analysis, deal scoring, proposal generation and SoW creation for LogicGate opportunities.',
    status: 'active',
    icon: '⬡',
    category: 'Sales',
  },
  {
    id: 'proposal',
    title: 'Proposal Specialist',
    description:
      'Intelligent proposal generation, pricing strategy and document creation across all Risk Rising products.',
    status: 'coming_soon',
    icon: '📄',
    category: 'Sales',
  },
  {
    id: 'marketing',
    title: 'Marketing Specialist',
    description:
      'Content generation, campaign strategy, messaging frameworks and competitive intelligence for Risk Rising.',
    status: 'coming_soon',
    icon: '📢',
    category: 'Growth',
  },
  {
    id: 'delivery',
    title: 'Delivery Specialist',
    description:
      'Project planning, risk assessment, implementation guidance and customer success workflows.',
    status: 'coming_soon',
    icon: '🚀',
    category: 'Delivery',
  },
  {
    id: 'knowledge',
    title: 'Knowledge Specialist',
    description:
      'Institutional knowledge base, best practices, case studies and team learning resources.',
    status: 'coming_soon',
    icon: '🧠',
    category: 'Intelligence',
  },
  {
    // Administrator-only Development Lens (Phase 1: UI shell).
    // Gated via `adminOnly`; only rendered for admins (see RaiDashboard + App).
    id: 'development',
    title: 'Development',
    description:
      'Administrator workspace for platform architecture, knowledge, engineering, source control, roadmap, reviews and build status. Phase 1 establishes the UI shell; later phases populate each area.',
    status: 'active',
    icon: '🛠',
    category: 'Platform',
    adminOnly: true,
  },
]
