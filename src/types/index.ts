// ─── Primitives ───────────────────────────────────────────────────────────────

export type UUID = string;

export type Status = 'unattempted' | 'wrong' | 'partial' | 'correct';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'unseen';

// ─── Content Block ────────────────────────────────────────────────────────────

export interface MarkdownSegment {
  type: 'markdown';
  id: UUID;
  text: string;
}

export interface ImageCrop {
  x: number;      // 0–100 % from left
  y: number;      // 0–100 % from top
  width: number;  // 0–100 % width
  height: number; // 0–100 % height
}

export interface ImageSegment {
  type: 'image';
  id: UUID;
  imageId: UUID;
  caption?: string;
  displayWidth?: number; // percent of container, 10–100
  crop?: ImageCrop;
}

export type Segment = MarkdownSegment | ImageSegment;

export interface ContentBlock {
  segments: Segment[];
}

// ─── MetaField ────────────────────────────────────────────────────────────────

export interface MetaField {
  key: string;
  value: string;
}

// ─── Tag ──────────────────────────────────────────────────────────────────────

export interface Tag {
  id: UUID;
  name: string;
  color: string; // hex, e.g. "#f59e0b"
  isProjectTag: boolean;
  projectId: UUID | null;
  createdAt: number;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: UUID;
  name: string;
  description: string;
  color: string; // hex
  tagIds: UUID[]; // IDs of tags auto-applied to questions
  metadata: MetaField[];
  createdAt: number;
  updatedAt: number;
}

// ─── Question Types & Options ──────────────────────────────────────────────────

export type QuestionType = 'none' | 'mcq' | 'msq' | 'nat';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface NatAnswer {
  value?: number;
  min?: number;
  max?: number;
}

export type CorrectAnswer =
  | { type: 'mcq'; optionId: string }
  | { type: 'msq'; optionIds: string[] }
  | { type: 'nat'; answer: NatAnswer };

// ─── Question ────────────────────────────────────────────────────────────────

export interface Question {
  id: UUID;
  projectId: UUID | null;
  questionContent: ContentBlock;
  solutionContent: ContentBlock;
  tagIds: UUID[]; // direct tags only; project tags resolved dynamically
  metadata: MetaField[]; // question-specific; project metadata merged at display time
  status: Status;
  difficulty: Difficulty;
  source: string;
  createdAt: number;
  updatedAt: number;

  // Answering Mechanism
  questionType?: QuestionType;
  options?: QuestionOption[];
  correctAnswer?: CorrectAnswer;
}

// ─── Image Record ─────────────────────────────────────────────────────────────

export interface ImageRecord {
  id: UUID;
  filename: string; // "{UUID}.{ext}"
  ext: string;
  mimeType: string;
  width: number;
  height: number;
  addedAt: number;
}

// ─── Resolved (display-time merged) ──────────────────────────────────────────

export interface ResolvedQuestion extends Question {
  effectiveTags: Tag[];           // project tags + question tags, deduped
  effectiveMetadata: MetaField[]; // project metadata + question metadata
  project: Project | null;
}

// ─── BroadcastChannel Messages ───────────────────────────────────────────────

export type SyncMessage =
  | { type: 'question:saved';   payload: { id: UUID; projectId: UUID | null } }
  | { type: 'question:deleted'; payload: { id: UUID } }
  | { type: 'project:saved';    payload: { id: UUID } }
  | { type: 'project:deleted';  payload: { id: UUID } }
  | { type: 'tags:changed';     payload: Record<string, never> }
  | { type: 'imagedir:changed'; payload: Record<string, never> }
  | { type: 'navigate:question';payload: { id: UUID } };

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface FilterState {
  projectId: UUID | 'all';
  projectIds: UUID[];
  statuses: Status[];
  difficulties: Difficulty[];
  tagIds: UUID[];
  tagMode: 'and' | 'or';
  textSearch: string;
  metaFilters: MetaField[];
  sortBy: 'createdAt' | 'updatedAt' | 'status' | 'difficulty' | 'smart';
  sortDir: 'asc' | 'desc';
  rawQuery?: string;
  randomSeed?: number | string;
}
