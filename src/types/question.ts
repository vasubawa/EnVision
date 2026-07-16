export interface Suggestion {
  type: 'info' | 'logic' | 'feedback';
  text: string;
}

export interface SubPart {
  id: string;
  text: string;
  suggestions: Suggestion[];
}

export type Subject = 'physics1' | 'physics2' | 'chem1' | 'chem2' | 'calc';

export interface Question {
  id: number;
  title: string;
  given?: string;
  subject: Subject;
  parts: SubPart[];
  suggestions: Suggestion[];
}
