// Task-related type definitions for Day Foundry

export interface TaskDraft {
  title: string;
  steps: string[];
  acceptance: string;
  est_range: string;
  energy: 'Deep' | 'Shallow';
  deps: string[];
  deadline?: Date;
  tags: string[];
}

export interface TaskStep {
  text: string;
  completed: boolean;
}

export interface TaskEstimate {
  min: number;
  most: number;
  max: number;
}