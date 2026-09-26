export type JobState = "queued" | "fetching" | "reading" | "done" | "partial" | "error";

export interface JobRequest {
  username: string;
  maxPosts: number;
  nonce: string;
  requestedAt: string;
  refetch?: boolean;
}

export interface JobStatus {
  jobId: string;
  username: string;
  nonce?: string;
  requestedAt?: string;
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  state: JobState;
  message?: string;
  total: number;
  processed: number;
  slides: number;
  totalSlides?: number;
  runUrl?: string;
}

export interface Slide {
  i: number;
  paragraphs: string[];
  confidence: number;
  error?: string;
}

export interface Post {
  id: string;
  shortCode?: string;
  url?: string;
  kind: "carousel" | "single";
  takenAt?: string;
  likes: number | null;
  likesHidden: boolean;
  comments: number | null;
  score: number;
  rank: number;
  slides: Slide[];
  thumb: number | null;
}

export interface JobResult {
  version: 1;
  jobId: string;
  profile: { username: string; fullName?: string | null };
  createdAt: string;
  updatedAt?: string;
  finishedAt?: string;
  state: "running" | "done" | "partial";
  posts: Post[];
}

export interface JobSummary {
  id: string;
  request: JobRequest;
  status: JobStatus | null;
}

export const ACTIVE: JobState[] = ["queued", "fetching", "reading"];
