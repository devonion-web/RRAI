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
  intelligenceSummary: Record<string, unknown> | null;
  responseSections: Record<string, unknown>[];
  documentClassifications: Record<string, string>[];
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
    intelligenceSummary: null,
    responseSections: [],
    documentClassifications: [],
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
