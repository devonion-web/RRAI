import { randomUUID } from "crypto";

export type JobStatus = "pending" | "running" | "done" | "error";

export interface JobProgress {
  done: number;
  total: number;
  stage: string;
}

export interface ExtractionJob {
  id: string;
  status: JobStatus;
  progress: JobProgress;
  // Assessment-phase outputs
  rfpUnderstanding: Record<string, unknown> | null;
  documentClassifications: Record<string, string>[];
  assessment: Record<string, unknown> | null;  // high-level opportunity assessment sections
  requirements: Record<string, unknown>[];     // enriched worklist items
  // Mapping-pack outputs
  mappingRows: Record<string, unknown>[];
  mappingSummary: Record<string, unknown> | null;
  // Legacy (kept for backward compat)
  health: Record<string, unknown> | null;
  error: string | null;
  createdAt: number;
}

const JOBS = new Map<string, ExtractionJob>();
const TTL_MS = 2 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of JOBS) {
    if (now - job.createdAt > TTL_MS) JOBS.delete(id);
  }
}, 30 * 60 * 1000);

export function createJob(): ExtractionJob {
  const job: ExtractionJob = {
    id: randomUUID(),
    status: "pending",
    progress: { done: 0, total: 1, stage: "Starting…" },
    rfpUnderstanding: null,
    documentClassifications: [],
    assessment: null,
    requirements: [],
    mappingRows: [],
    mappingSummary: null,
    health: null,
    error: null,
    createdAt: Date.now(),
  };
  JOBS.set(job.id, job);
  return job;
}

export function getJob(id: string): ExtractionJob | null {
  return JOBS.get(id) ?? null;
}

export function updateJob(id: string, updates: Partial<ExtractionJob>): void {
  const job = JOBS.get(id);
  if (job) Object.assign(job, updates);
}

export function updateProgress(id: string, done: number, total: number, stage: string): void {
  const job = JOBS.get(id);
  if (job) job.progress = { done, total, stage };
}

export function appendRequirements(id: string, reqs: Record<string, unknown>[]): void {
  const job = JOBS.get(id);
  if (job) job.requirements.push(...reqs);
}

export function appendMappingRows(id: string, rows: Record<string, unknown>[]): void {
  const job = JOBS.get(id);
  if (job) job.mappingRows.push(...rows);
}
