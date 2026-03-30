import type React from 'react';

export type LessonStageKey = 'preview' | 'reading' | 'dictation' | 'speaking';
export type TextbookPageKey = 'overview' | 'preview' | 'sentences' | 'grammar' | 'reading-practice';
export type MistakeCategory = 'vocab' | 'dictation' | 'speaking' | 'grammar';
export type MistakeReason =
  | 'unknown_vocab'
  | 'pronunciation'
  | 'missing_word'
  | 'spelling'
  | 'punctuation'
  | 'sentence_structure'
  | 'too_short'
  | 'off_topic'
  | 'fluency'
  | 'grammar_rule'
  | 'word_order'
  | 'sentence_judgement';

export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  definition: string;
  example: string;
}

export interface SentenceItem {
  id: string;
  text: string;
  translation: string;
}

export interface AzurePronunciationWord {
  word: string;
  accuracyScore: number;
  errorType: string;
}

export interface AzurePronunciationResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: AzurePronunciationWord[];
  feedback: string[];
}

export interface PronunciationAssessmentRecord {
  id: string;
  unitId: string;
  sentenceId: string;
  sentenceText: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  weakWords: string[];
  createdAt: string;
}

export interface LessonStage {
  key: LessonStageKey;
  title: string;
  description: string;
  estimatedMinutes: number;
}

export interface GrammarExample {
  text: string;
  translation: string;
}

export interface GrammarExercise {
  id: string;
  type: 'choice' | 'fill' | 'judge' | 'correction' | 'reorder';
  prompt: string;
  question: string;
  answer: string;
  explanation: string;
  options?: string[];
  clue?: string;
  tokens?: string[];
}

export interface GrammarModule {
  id: string;
  title: string;
  focus: string;
  summary: string;
  tips: string[];
  examples: GrammarExample[];
  exercises: GrammarExercise[];
  sourceType?: 'configured' | 'generated';
}

export interface UnitBundle {
  id: string;
  textbookId: string;
  grade: string;
  semester: string;
  unit: string;
  title: string;
  summary?: string;
  passage?: string;
  vocab: VocabItem[];
  sentences: SentenceItem[];
  stages: LessonStage[];
  phrases?: Array<{ id: string; phrase: string; meaning: string; example: string; sortOrder: number }>;
  patterns?: Array<{ id: string; text: string; translation: string; kind: 'sentence' | 'pattern'; sortOrder: number }>;
  grammar: GrammarModule;
}

export interface DailyCheckinRecord {
  date: string;
  completedTaskIds: string[];
  recommendationIds: string[];
  challengeCompleted: boolean;
  checkedIn: boolean;
}

export interface MistakeRecord {
  id: string;
  unitId: string;
  category: MistakeCategory;
  stage: LessonStageKey | 'reading';
  prompt: string;
  expected: string;
  answer: string;
  translation?: string;
  reason?: MistakeReason;
  hint?: string;
  createdAt: string;
}

export interface StudyState {
  currentUnitId: string;
  currentStage: LessonStageKey;
  masteredWordIds: string[];
  followedSentenceIds: string[];
  completedTaskIds: string[];
  completedGrammarQuestionIds: string[];
  challengeAttempts: Array<{
    id: string;
    unitId: string;
    score: number;
    total: number;
    completedAt: string;
  }>;
  dailyCheckins: DailyCheckinRecord[];
  mistakes: MistakeRecord[];
  pronunciationAssessments: PronunciationAssessmentRecord[];
}

export interface TextbookPageMeta {
  id: TextbookPageKey;
  label: string;
  description: string;
  icon: React.ElementType;
}
