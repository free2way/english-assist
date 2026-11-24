import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Ear, GraduationCap, Mic2, PencilLine, Trophy } from 'lucide-react';
import {
  buildRecordingQualityWarning,
  monitorMicrophone,
  openMicrophoneStream,
  preloadSpeechEngine,
  startPronunciationAssessmentSession,
  stopMediaStream,
} from '../../lib/azureSpeech';
import type { MicrophoneMonitor } from '../../lib/azureSpeech';
import { cn } from '../../lib/utils';
import { DictationModule } from '../DictationModule';
import { ListeningModule } from '../ListeningModule';
import { ChallengeModule } from '../ChallengeModule';
import { TextbookGrammarPage } from './TextbookGrammarPage';
import { TextbookPreviewPage } from './TextbookPreviewPage';
import { TextbookReadingPracticePage } from './TextbookReadingPracticePage';
import {
  createTaskId,
  getPronunciationHint,
  normalizeGrammarAnswer,
} from './helpers';
import type {
  AzurePronunciationResult,
  GrammarExercise,
  LessonStageKey,
  MistakeReason,
  MistakeRecord,
  PronunciationAssessmentRecord,
  StudyState,
  UnitBundle,
  VocabItem,
} from './types';
import type { ChallengeQuestionInput } from '../../lib/study';

interface SpeechTokenResponse {
  token: string;
  region: string;
  expiresInSeconds: number;
}

export type StudySectionKey = 'preview' | 'reading' | 'grammar' | 'practice' | 'challenge';

interface Props {
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  activeSection: StudySectionKey;
  onChangeSection: (section: StudySectionKey) => void;
  practiceSubMode: 'dictation' | 'listening';
  onChangePracticeSubMode: (mode: 'dictation' | 'listening') => void;
  onSelectStage: (stage: LessonStageKey) => void;
  onOpenDashboard: () => void;
  onMarkWord: (wordId: string, mastered: boolean, word: VocabItem) => void;
  onMarkSentenceFollowed: (sentenceId: string, followed?: boolean) => void;
  onCompleteStage: (stage: LessonStageKey) => void;
  onCompleteGrammarExercise: (exerciseId: string) => void;
  onAddPronunciationAssessment: (record: Omit<PronunciationAssessmentRecord, 'id' | 'createdAt'>) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
  onResolveMistake: (mistake: MistakeRecord) => void;
  onRecordAttempt: (attempt: { mode: 'word' | 'sentence' | 'listening'; correct: number; total: number }) => void;
  onSubmitChallenge: (payload: {
    score: number;
    total: number;
    details: Array<{ id: string; kind: string; prompt: string; answer: string; expected: string; correct: boolean }>;
  }) => void;
  scoreChallengeAnswer: (
    question: ChallengeQuestionInput,
    answer: string,
    unit: UnitBundle | null,
  ) => { correct: boolean; detail: string };
  buildChallengeQuestions: (unit: UnitBundle | null) => ChallengeQuestionInput[];
  getUnitChallengeStatus: (unit: UnitBundle | null, studyState: StudyState) => { ready: boolean; score: number; progress: number; challengeLabel: string };
  getChallengeHistoryForUnit: (studyState: StudyState, unitId: string) => Array<{ score: number; total: number }>;
  classifyDictationIssue: (input: string, target: string) => { reason: MistakeReason; hint: string };
  mistakeReasonLabels: Record<MistakeReason, string>;
  retryTarget: MistakeRecord | null;
  onRetryTargetHandled: () => void;
  speak: (text: string, accent?: 'US' | 'UK', rate?: number) => Promise<boolean>;
  onVoiceInput?: () => Promise<string>;
  fetchSpeechToken: () => Promise<SpeechTokenResponse>;
}

export function TextbookModule({
  currentUnit,
  studyState,
  activeSection,
  onChangeSection,
  practiceSubMode,
  onChangePracticeSubMode,
  onSelectStage,
  onOpenDashboard,
  onMarkWord,
  onMarkSentenceFollowed,
  onCompleteStage,
  onCompleteGrammarExercise,
  onAddPronunciationAssessment,
  onAddMistake,
  onResolveMistake,
  onRecordAttempt,
  onSubmitChallenge,
  scoreChallengeAnswer,
  buildChallengeQuestions,
  getUnitChallengeStatus,
  getChallengeHistoryForUnit,
  classifyDictationIssue,
  mistakeReasonLabels,
  retryTarget,
  onRetryTargetHandled,
  speak,
  onVoiceInput,
  fetchSpeechToken,
}: Props) {
  const [readingIndex, setReadingIndex] = useState(0);
  const [recordingPhase, setRecordingPhase] = useState<'idle' | 'preparing' | 'listening' | 'scoring'>('idle');
  const [interimSentenceText, setInterimSentenceText] = useState('');
  const [readingMode, setReadingMode] = useState<'sentence' | 'passage'>('sentence');
  const [passagePhase, setPassagePhase] = useState<'idle' | 'preparing' | 'listening' | 'scoring'>('idle');
  const [passageInterimText, setPassageInterimText] = useState('');
  const [passageLevel, setPassageLevel] = useState(0);
  const [passageAssessment, setPassageAssessment] = useState<AzurePronunciationResult | null>(null);
  const [passageRecognizedText, setPassageRecognizedText] = useState('');
  const [passageError, setPassageError] = useState('');
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [recordingQualityWarning, setRecordingQualityWarning] = useState('');
  const [recordedSentenceUrl, setRecordedSentenceUrl] = useState('');
  const [recognizedSentenceText, setRecognizedSentenceText] = useState('');
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  const [recordingError, setRecordingError] = useState('');
  const [azureAssessment, setAzureAssessment] = useState<AzurePronunciationResult | null>(null);
  const [azureAssessmentError, setAzureAssessmentError] = useState('');
  const [grammarDrafts, setGrammarDrafts] = useState<Record<string, string>>({});
  const [grammarFeedback, setGrammarFeedback] = useState<Record<string, string>>({});

  const pronunciationSessionRef = useRef<Awaited<ReturnType<typeof startPronunciationAssessmentSession>> | null>(null);
  const recordingRunRef = useRef(0);
  const microphoneMonitorRef = useRef<MicrophoneMonitor | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const unitSentences = currentUnit?.sentences ?? [];
  const safeReadingIndex = unitSentences.length > 0
    ? Math.min(Math.max(readingIndex, 0), unitSentences.length - 1)
    : 0;
  const currentReadingSentence = unitSentences[safeReadingIndex];

  useEffect(() => {
    setReadingIndex(0);
    setRecordedSentenceUrl('');
    setRecognizedSentenceText('');
    setPronunciationScore(null);
    setRecordingError('');
    setAzureAssessment(null);
    setAzureAssessmentError('');
    setGrammarDrafts({});
    setGrammarFeedback({});
    setReadingMode('sentence');
    setPassagePhase('idle');
    setPassageAssessment(null);
    setPassageRecognizedText('');
    setPassageInterimText('');
    setPassageError('');
  }, [currentUnit?.id]);

  // Jump straight to matching sentence when retrying a pronunciation mistake
  useEffect(() => {
    if (!currentUnit || !retryTarget || activeSection !== 'reading') return;
    const norm = (value: string) => value.trim().toLowerCase();
    const idx = currentUnit.sentences.findIndex(
      (s) => norm(s.text) === norm(retryTarget.expected) || norm(s.text) === norm(retryTarget.prompt),
    );
    if (idx >= 0) {
      setReadingMode('sentence');
      setReadingIndex(idx);
    }
  }, [retryTarget, activeSection, currentUnit]);

  useEffect(() => {
    if (readingIndex === safeReadingIndex) return;
    setReadingIndex(safeReadingIndex);
  }, [readingIndex, safeReadingIndex]);

  const releaseRecordingResources = () => {
    microphoneMonitorRef.current?.stop();
    microphoneMonitorRef.current = null;
    setRecordingLevel(0);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // recorder already closed
    }
    mediaRecorderRef.current = null;
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
  };

  useEffect(() => {
    recordingRunRef.current += 1;
    pronunciationSessionRef.current?.cancel();
    pronunciationSessionRef.current = null;
    releaseRecordingResources();
    setRecordingPhase('idle');
    setInterimSentenceText('');
    setRecognizedSentenceText('');
    setPronunciationScore(null);
    setRecordingError('');
    setAzureAssessment(null);
    setAzureAssessmentError('');
    if (recordedSentenceUrl) {
      URL.revokeObjectURL(recordedSentenceUrl);
      setRecordedSentenceUrl('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingIndex]);

  useEffect(() => {
    return () => {
      recordingRunRef.current += 1;
      pronunciationSessionRef.current?.cancel();
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      if (recordedSentenceUrl) {
        URL.revokeObjectURL(recordedSentenceUrl);
      }
    };
  }, [recordedSentenceUrl]);

  useEffect(() => {
    preloadSpeechEngine(fetchSpeechToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentUnit) {
    return (
      <div className="py-20 text-center text-slate-400">
        <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
        <p>当前账号暂无教材数据</p>
      </div>
    );
  }

  const masteredCount = currentUnit.vocab.filter((word) => studyState.masteredWordIds.includes(word.id)).length;
  const followedCount = currentUnit.sentences.filter((sentence) => studyState.followedSentenceIds.includes(sentence.id)).length;
  const previewCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'preview'));
  const readingCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'reading'));
  const dictationCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'dictation'));
  const completedGrammarCount = currentUnit.grammar.exercises.filter((exercise) => studyState.completedGrammarQuestionIds.includes(exercise.id)).length;
  const grammarCompleted = currentUnit.grammar.exercises.length > 0 && completedGrammarCount === currentUnit.grammar.exercises.length;
  const hasChallengeDone = getChallengeHistoryForUnit(studyState, currentUnit.id).length > 0;

  const startRecordingAssessment = async (sentence: NonNullable<typeof currentReadingSentence>) => {
    setAzureAssessment(null);
    setAzureAssessmentError('');
    setRecordingError('');
    setRecognizedSentenceText('');
    setPronunciationScore(null);
    setInterimSentenceText('');
    setRecordingQualityWarning('');
    setRecordingLevel(0);
    if (recordedSentenceUrl) {
      URL.revokeObjectURL(recordedSentenceUrl);
      setRecordedSentenceUrl('');
    }
    setRecordingPhase('preparing');
    const runId = recordingRunRef.current + 1;
    recordingRunRef.current = runId;

    try {
      const stream = await openMicrophoneStream();
      if (recordingRunRef.current !== runId) {
        stopMediaStream(stream);
        return;
      }
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) return;
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        setRecordedSentenceUrl(URL.createObjectURL(blob));
      };

      const session = await startPronunciationAssessmentSession({
        getToken: fetchSpeechToken,
        referenceText: sentence.text,
        language: 'en-US',
        mediaStream: stream,
        onInterim: (text) => setInterimSentenceText(text),
      });
      if (recordingRunRef.current !== runId) {
        session.cancel();
        stopMediaStream(stream);
        return;
      }
      pronunciationSessionRef.current = session;

      mediaRecorder.start();
      microphoneMonitorRef.current = monitorMicrophone(stream, (level) => setRecordingLevel(level));
      setRecordingPhase('listening');
    } catch (error) {
      if (recordingRunRef.current !== runId) return;
      const message = error instanceof Error ? error.message : '发音评测暂时不可用，请检查麦克风后重试';
      setAzureAssessmentError(message);
      setRecordingError(message);
      pronunciationSessionRef.current?.cancel();
      pronunciationSessionRef.current = null;
      releaseRecordingResources();
      setRecordingPhase('idle');
    }
  };

  const stopRecordingAssessment = async () => {
    const session = pronunciationSessionRef.current;
    if (!session) {
      setRecordingPhase('idle');
      return;
    }

    setRecordingPhase('scoring');
    const microphoneStats = microphoneMonitorRef.current?.stop();
    microphoneMonitorRef.current = null;
    setRecordingQualityWarning(microphoneStats ? buildRecordingQualityWarning(microphoneStats) : '');
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }

    try {
      const { recognizedText, assessment, weakWords } = await session.stop();
      pronunciationSessionRef.current = null;
      setRecognizedSentenceText(recognizedText);
      setPronunciationScore(assessment.pronunciationScore);
      setAzureAssessment(assessment);
      setRecordingError('');

      const sentence = currentReadingSentence;
      if (sentence) {
        onAddPronunciationAssessment({
          unitId: currentUnit.id,
          sentenceId: sentence.id,
          sentenceText: sentence.text,
          pronunciationScore: assessment.pronunciationScore,
          accuracyScore: assessment.accuracyScore,
          fluencyScore: assessment.fluencyScore,
          completenessScore: assessment.completenessScore,
          weakWords,
        });

        // High score automatically marks sentence followed & clears matching mistake!
        if (assessment.pronunciationScore >= 75) {
          onMarkSentenceFollowed(sentence.id, true);
          if (retryTarget && retryTarget.expected.trim().toLowerCase() === sentence.text.trim().toLowerCase()) {
            onResolveMistake(retryTarget);
            onRetryTargetHandled();
          }
        }

        if (assessment.pronunciationScore < 75 || weakWords.length > 0) {
          onAddMistake({
            unitId: currentUnit.id,
            category: 'speaking',
            stage: 'reading',
            prompt: sentence.text,
            expected: sentence.text,
            answer: weakWords.join(', ') || recognizedText || '发音分数偏低',
            translation: sentence.translation,
            reason: 'pronunciation',
            hint: assessment.feedback[1] || assessment.feedback[0],
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '发音评测失败，请重试';
      setAzureAssessmentError(message);
      setRecordingError(message);
    } finally {
      pronunciationSessionRef.current = null;
      releaseRecordingResources();
      setInterimSentenceText('');
      setRecordingPhase('idle');
    }
  };

  const passageText = (currentUnit.passage || currentUnit.sentences.map((sentence) => sentence.text).join(' ')).trim();

  const startPassageRecording = async () => {
    if (!passageText) {
      setPassageError('当前单元还没有可用于整篇朗读的课文。');
      return;
    }
    setPassageAssessment(null);
    setPassageRecognizedText('');
    setPassageError('');
    setPassageInterimText('');
    setPassagePhase('preparing');

    const runId = recordingRunRef.current + 1;
    recordingRunRef.current = runId;

    try {
      const stream = await openMicrophoneStream();
      if (recordingRunRef.current !== runId) {
        stopMediaStream(stream);
        return;
      }
      mediaStreamRef.current = stream;
      const session = await startPronunciationAssessmentSession({
        getToken: fetchSpeechToken,
        referenceText: passageText,
        language: 'en-US',
        mediaStream: stream,
        onInterim: (text) => setPassageInterimText(text),
      });
      if (recordingRunRef.current !== runId) {
        session.cancel();
        stopMediaStream(stream);
        return;
      }
      pronunciationSessionRef.current = session;
      microphoneMonitorRef.current = monitorMicrophone(stream, (level) => setPassageLevel(level));
      setPassagePhase('listening');
    } catch (error) {
      if (recordingRunRef.current !== runId) return;
      const message = error instanceof Error ? error.message : '发音评测失败，请检查麦克风后重试';
      setPassageError(message);
      pronunciationSessionRef.current?.cancel();
      pronunciationSessionRef.current = null;
      releaseRecordingResources();
      setPassagePhase('idle');
    }
  };

  const stopPassageRecording = async () => {
    const session = pronunciationSessionRef.current;
    if (!session) {
      setPassagePhase('idle');
      return;
    }
    setPassagePhase('scoring');
    microphoneMonitorRef.current?.stop();
    microphoneMonitorRef.current = null;
    setPassageLevel(0);

    try {
      const { recognizedText, assessment, weakWords } = await session.stop();
      pronunciationSessionRef.current = null;
      setPassageRecognizedText(recognizedText);
      setPassageAssessment(assessment);
      setPassageError('');

      const firstSentence = currentUnit.sentences[0];
      const missingWords = assessment.words.filter((word) => word.errorType === 'Omission').length;
      onAddPronunciationAssessment({
        unitId: currentUnit.id,
        sentenceId: `${currentUnit.id}-passage`,
        sentenceText: passageText.slice(0, 80),
        pronunciationScore: assessment.pronunciationScore,
        accuracyScore: assessment.accuracyScore,
        fluencyScore: assessment.fluencyScore,
        completenessScore: assessment.completenessScore,
        weakWords,
      });

      if (assessment.pronunciationScore >= 70) {
        onCompleteStage('reading');
      }

      if (assessment.pronunciationScore < 75 || weakWords.length > 0) {
        onAddMistake({
          unitId: currentUnit.id,
          category: 'speaking',
          stage: 'reading',
          prompt: `整篇朗读：${currentUnit.unit} 课文`,
          expected: firstSentence?.text || passageText.slice(0, 60),
          answer: weakWords.slice(0, 4).join(', ') || `完整度 ${assessment.completenessScore}`,
          translation: firstSentence?.translation,
          reason: 'pronunciation',
          hint: missingWords > 0
            ? `有 ${missingWords} 个词没读到，先切回逐句精练，再整篇连读。`
            : (assessment.feedback[1] || assessment.feedback[0]),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '发音评测失败，请重试';
      setPassageError(message);
    } finally {
      pronunciationSessionRef.current = null;
      releaseRecordingResources();
      setPassageInterimText('');
      setPassagePhase('idle');
    }
  };

  const handleTogglePassageRecording = () => {
    if (passagePhase === 'listening') {
      void stopPassageRecording();
      return;
    }
    if (passagePhase !== 'idle') return;
    void startPassageRecording();
  };

  const handleToggleRecording = () => {
    if (!currentReadingSentence) return;
    if (recordingPhase === 'listening') {
      void stopRecordingAssessment();
      return;
    }
    if (recordingPhase !== 'idle') return;
    void startRecordingAssessment(currentReadingSentence);
  };

  const handleGrammarChoice = (exercise: GrammarExercise, option: string) => {
    if (normalizeGrammarAnswer(option) === normalizeGrammarAnswer(exercise.answer)) {
      onCompleteGrammarExercise(exercise.id);
      setGrammarFeedback((prev) => ({
        ...prev,
        [exercise.id]: `回答正确！${exercise.explanation}`,
      }));
      if (retryTarget && retryTarget.prompt.includes(exercise.question)) {
        onRetryTargetHandled();
      }
      return;
    }

    setGrammarFeedback((prev) => ({
      ...prev,
      [exercise.id]: `再想想：${exercise.explanation}`,
    }));

    onAddMistake({
      unitId: currentUnit.id,
      category: 'grammar',
      stage: 'reading',
      prompt: `${exercise.prompt}：${exercise.question}`,
      expected: exercise.answer,
      answer: option,
      reason: exercise.type === 'judge' ? 'sentence_judgement' : 'grammar_rule',
      hint: exercise.explanation,
    });
  };

  const handleGrammarFill = (exercise: GrammarExercise) => {
    const answer = normalizeGrammarAnswer(grammarDrafts[exercise.id] || '');
    if (!answer) {
      setGrammarFeedback((prev) => ({
        ...prev,
        [exercise.id]: '先输入答案再提交。',
      }));
      return;
    }

    if (answer === normalizeGrammarAnswer(exercise.answer)) {
      onCompleteGrammarExercise(exercise.id);
      setGrammarFeedback((prev) => ({
        ...prev,
        [exercise.id]: `回答正确！${exercise.explanation}`,
      }));
      if (retryTarget && retryTarget.prompt.includes(exercise.question)) {
        onRetryTargetHandled();
      }
      return;
    }

    setGrammarFeedback((prev) => ({
      ...prev,
      [exercise.id]: `还差一点：${exercise.explanation}`,
    }));

    onAddMistake({
      unitId: currentUnit.id,
      category: 'grammar',
      stage: 'reading',
      prompt: `${exercise.prompt}：${exercise.question}`,
      expected: exercise.answer,
      answer: grammarDrafts[exercise.id] || '',
      reason: exercise.type === 'reorder' ? 'word_order' : 'grammar_rule',
      hint: exercise.explanation,
    });
  };

  const handleCompleteCurrentSentence = () => {
    const sentence = currentUnit.sentences[safeReadingIndex];
    if (!sentence) return;

    // Idempotent mark followed — never accidentally unchecks a completed sentence!
    onMarkSentenceFollowed(sentence.id, true);

    if (safeReadingIndex < currentUnit.sentences.length - 1) {
      setReadingIndex(safeReadingIndex + 1);
      return;
    }

    onCompleteStage('reading');
  };

  const steps: Array<{
    id: StudySectionKey;
    label: string;
    badge: string;
    done: boolean;
    icon: React.ElementType;
  }> = [
    {
      id: 'preview',
      label: '1. 记单词',
      badge: `${masteredCount}/${currentUnit.vocab.length}`,
      done: previewCompleted,
      icon: GraduationCap,
    },
    {
      id: 'reading',
      label: '2. 课文朗读',
      badge: `${followedCount}/${currentUnit.sentences.length}`,
      done: readingCompleted,
      icon: Mic2,
    },
    {
      id: 'grammar',
      label: '3. 练语法',
      badge: `${completedGrammarCount}/${currentUnit.grammar.exercises.length}`,
      done: grammarCompleted,
      icon: PencilLine,
    },
    {
      id: 'practice',
      label: '4. 听与写',
      badge: dictationCompleted ? '已完成' : '听力/听写',
      done: dictationCompleted,
      icon: Ear,
    },
    {
      id: 'challenge',
      label: '5. 单元闯关',
      badge: hasChallengeDone ? '已测' : '5题',
      done: hasChallengeDone,
      icon: Trophy,
    },
  ];

  return (
    <div className="space-y-5 pb-16">
      {/* Compact 5-step unit workflow bar */}
      <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {steps.map((step) => {
            const active = activeSection === step.id;
            return (
              <button
                key={step.id}
                onClick={() => onChangeSection(step.id)}
                className={cn(
                  'rounded-2xl px-3.5 py-2.5 text-left transition-all border flex items-center justify-between gap-2',
                  active
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : step.done
                      ? 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                      : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-200 hover:bg-white',
                )}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                    <step.icon size={14} className="shrink-0" />
                    <span>{step.label}</span>
                  </div>
                  <div className={cn('text-[10px] mt-0.5 truncate', active ? 'text-blue-100' : 'text-slate-400')}>
                    {step.badge}
                  </div>
                </div>
                {step.done && !active && <Check size={14} className="text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 1: Vocabulary */}
      {activeSection === 'preview' && (
        <TextbookPreviewPage
          currentUnit={currentUnit}
          studyState={studyState}
          previewCompleted={previewCompleted}
          onSelectStage={() => onSelectStage('preview')}
          onPlayWord={(word, rate = 1) => {
            void speak(word, 'US', rate);
          }}
          onMarkWord={onMarkWord}
          onMarkUnknown={(word) => {
            onMarkWord(word.id, false, word);
            onAddMistake({
              unitId: currentUnit.id,
              category: 'vocab',
              stage: 'preview',
              prompt: word.word,
              expected: word.definition,
              answer: '未掌握',
              reason: 'unknown_vocab',
              hint: '先听发音，再结合例句记住词义和用法。',
            });
          }}
          onCompleteAndGoSentences={() => {
            onCompleteStage('preview');
            onSelectStage('reading');
            onChangeSection('reading');
          }}
          retryTarget={retryTarget && retryTarget.category === 'vocab' ? retryTarget : null}
          onRetryTargetHandled={onRetryTargetHandled}
          onResolveMistake={onResolveMistake}
        />
      )}

      {/* Step 2: Reading & Pronunciation (merged Sentences + Reading Practice) */}
      {activeSection === 'reading' && (
        <TextbookReadingPracticePage
          currentUnit={currentUnit}
          studyState={studyState}
          currentReadingSentence={currentReadingSentence}
          readingIndex={safeReadingIndex}
          recordingPhase={recordingPhase}
          interimSentenceText={interimSentenceText}
          readingMode={readingMode}
          onChangeReadingMode={setReadingMode}
          passageText={passageText}
          passagePhase={passagePhase}
          passageInterimText={passageInterimText}
          passageLevel={passageLevel}
          passageAssessment={passageAssessment}
          passageRecognizedText={passageRecognizedText}
          passageError={passageError}
          onTogglePassageRecording={handleTogglePassageRecording}
          recordingLevel={recordingLevel}
          recordingQualityWarning={recordingQualityWarning}
          recordedSentenceUrl={recordedSentenceUrl}
          recognizedSentenceText={recognizedSentenceText}
          pronunciationScore={pronunciationScore}
          recordingError={recordingError}
          azureAssessment={azureAssessment}
          azureAssessmentError={azureAssessmentError}
          getPronunciationHint={getPronunciationHint}
          onSelectStage={() => onSelectStage('reading')}
          onPlaySentence={(text, rate = 1) => {
            void speak(text, 'US', rate);
          }}
          onToggleRecording={handleToggleRecording}
          onCompleteCurrentSentence={handleCompleteCurrentSentence}
          onSelectReadingSentence={(index) => {
            if (currentUnit.sentences[index]) setReadingIndex(index);
          }}
          onFinishReadingGoNext={() => {
            onCompleteStage('reading');
            onChangeSection('grammar');
          }}
          retryTarget={retryTarget && retryTarget.category === 'speaking' ? retryTarget : null}
          onRetryTargetHandled={onRetryTargetHandled}
        />
      )}

      {/* Step 3: Grammar */}
      {activeSection === 'grammar' && (
        <TextbookGrammarPage
          currentUnit={currentUnit}
          studyState={studyState}
          completedGrammarCount={completedGrammarCount}
          grammarCompleted={grammarCompleted}
          grammarDrafts={grammarDrafts}
          grammarFeedback={grammarFeedback}
          onDraftChange={(exerciseId, value) =>
            setGrammarDrafts((prev) => ({
              ...prev,
              [exerciseId]: value,
            }))
          }
          onChoiceAnswer={handleGrammarChoice}
          onFillAnswer={handleGrammarFill}
          onPlayExample={(text) => {
            void speak(text, 'US', 0.95);
          }}
          retryTarget={retryTarget && retryTarget.category === 'grammar' ? retryTarget : null}
          onRetryTargetHandled={onRetryTargetHandled}
        />
      )}

      {/* Step 4: Unified Listening & Dictation */}
      {activeSection === 'practice' && (
        <div className="space-y-4">
          <div className="inline-flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
            <button
              onClick={() => onChangePracticeSubMode('dictation')}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all',
                practiceSubMode === 'dictation' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              拼写听写
            </button>
            <button
              onClick={() => onChangePracticeSubMode('listening')}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all',
                practiceSubMode === 'listening' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              听力专项（选词/填空/选义）
            </button>
          </div>

          {practiceSubMode === 'dictation' ? (
            <DictationModule
              currentUnit={currentUnit}
              onCompleteStage={onCompleteStage}
              onAddMistake={onAddMistake}
              speak={speak}
              onRecordAttempt={onRecordAttempt}
              retryTarget={retryTarget && retryTarget.category === 'dictation' ? retryTarget : null}
              onRetryTargetHandled={onRetryTargetHandled}
              onResolveMistake={onResolveMistake}
              classifyDictationIssue={classifyDictationIssue}
              mistakeReasonLabels={mistakeReasonLabels}
            />
          ) : (
            <ListeningModule
              currentUnit={currentUnit}
              speak={speak}
              onAddMistake={onAddMistake}
              onRecordAttempt={onRecordAttempt}
              mistakeReasonLabels={mistakeReasonLabels}
            />
          )}
        </div>
      )}

      {/* Step 5: Unit Challenge */}
      {activeSection === 'challenge' && (
        <ChallengeModule
          currentUnit={currentUnit}
          studyState={studyState}
          onBack={onOpenDashboard}
          onSubmitResult={onSubmitChallenge}
          scoreChallengeAnswer={scoreChallengeAnswer}
          buildChallengeQuestions={buildChallengeQuestions}
          getUnitChallengeStatus={getUnitChallengeStatus}
          getChallengeHistoryForUnit={getChallengeHistoryForUnit}
          speak={speak}
          onVoiceInput={onVoiceInput}
        />
      )}
    </div>
  );
}
