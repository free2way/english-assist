import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, GraduationCap, MessageSquare, Mic2, PencilLine } from 'lucide-react';
import {
  buildRecordingQualityWarning,
  monitorMicrophone,
  openMicrophoneStream,
  preloadSpeechEngine,
  startPronunciationAssessmentSession,
  stopMediaStream,
} from '../../lib/azureSpeech';
import type { MicrophoneMonitor } from '../../lib/azureSpeech';
import { TextbookGrammarPage } from './TextbookGrammarPage';
import { TextbookOverviewPage } from './TextbookOverviewPage';
import { TextbookPreviewPage } from './TextbookPreviewPage';
import { TextbookReadingPracticePage } from './TextbookReadingPracticePage';
import { TextbookSentencesPage } from './TextbookSentencesPage';
import {
  createTaskId,
  getLessonOutcomeLabel,
  getPronunciationHint,
  getStageLabel,
  normalizeGrammarAnswer,
} from './helpers';
import type {
  AzurePronunciationResult,
  GrammarExercise,
  MistakeRecord,
  PronunciationAssessmentRecord,
  StudyState,
  TextbookPageKey,
  UnitBundle,
  VocabItem,
  LessonStageKey,
} from './types';

interface SpeechTokenResponse {
  token: string;
  region: string;
  expiresInSeconds: number;
}

interface Props {
  units: UnitBundle[];
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  onSelectUnit: (unitId: string) => void;
  onSelectStage: (stage: LessonStageKey) => void;
  onOpenStage: (stage: LessonStageKey) => void;
  onMarkWord: (wordId: string, mastered: boolean, word: VocabItem) => void;
  onToggleSentenceFollowed: (sentenceId: string) => void;
  onCompleteStage: (stage: LessonStageKey) => void;
  onCompleteGrammarExercise: (exerciseId: string) => void;
  onAddPronunciationAssessment: (record: Omit<PronunciationAssessmentRecord, 'id' | 'createdAt'>) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
  lockedPage?: TextbookPageKey;
  playWordAudio: (text: string, accent?: 'US' | 'UK') => Promise<unknown> | unknown;
  fetchSpeechToken: () => Promise<SpeechTokenResponse>;
}

export function TextbookModule({
  units,
  currentUnit,
  studyState,
  onSelectUnit,
  onSelectStage,
  onOpenStage,
  onMarkWord,
  onToggleSentenceFollowed,
  onCompleteStage,
  onCompleteGrammarExercise,
  onAddPronunciationAssessment,
  onAddMistake,
  lockedPage,
  playWordAudio,
  fetchSpeechToken,
}: Props) {
  if (!currentUnit) {
    return (
      <div className="py-20 text-center text-slate-300">
        <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
        <p>当前账号暂无教材数据</p>
      </div>
    );
  }

  const masteredCount = currentUnit.vocab.filter((word) => studyState.masteredWordIds.includes(word.id)).length;
  const followedCount = currentUnit.sentences.filter((sentence) => studyState.followedSentenceIds.includes(sentence.id)).length;
  const [readingIndex, setReadingIndex] = useState(0);
  const [activePage, setActivePage] = useState<TextbookPageKey>('overview');
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
  const [pendingSentenceAssessmentIndex, setPendingSentenceAssessmentIndex] = useState<number | null>(null);
  const pronunciationSessionRef = useRef<Awaited<ReturnType<typeof startPronunciationAssessmentSession>> | null>(null);
  const recordingRunRef = useRef(0);
  const microphoneMonitorRef = useRef<MicrophoneMonitor | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const safeReadingIndex = currentUnit.sentences.length > 0
    ? Math.min(Math.max(readingIndex, 0), currentUnit.sentences.length - 1)
    : 0;
  const currentReadingSentence = currentUnit.sentences[safeReadingIndex];
  const previewCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'preview'));
  const readingCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'reading'));
  const completedGrammarCount = currentUnit.grammar.exercises.filter((exercise) => studyState.completedGrammarQuestionIds.includes(exercise.id)).length;
  const grammarCompleted = completedGrammarCount === currentUnit.grammar.exercises.length;
  const textbookPages: Array<{ id: TextbookPageKey; label: string; description: string; icon: React.ElementType }> = [
    { id: 'overview', label: '单元总览', description: '课时导航和教材内容', icon: BookOpen },
    { id: 'preview', label: '词汇预习', description: '核心词汇与预习反馈', icon: GraduationCap },
    { id: 'sentences', label: '重点句', description: '重点句跟读与句型', icon: MessageSquare },
    { id: 'grammar', label: '语法模块', description: '语法讲解与练习题', icon: PencilLine },
    { id: 'reading-practice', label: '朗读评测', description: '录音、对比和 Azure 评测', icon: Mic2 },
  ];

  useEffect(() => {
    setReadingIndex(0);
    setActivePage(lockedPage || 'overview');
    setRecordedSentenceUrl('');
    setRecognizedSentenceText('');
    setPronunciationScore(null);
    setRecordingError('');
    setAzureAssessment(null);
    setAzureAssessmentError('');
    setGrammarDrafts({});
    setGrammarFeedback({});
    setPendingSentenceAssessmentIndex(null);
    setReadingMode('sentence');
    setPassagePhase('idle');
    setPassageAssessment(null);
    setPassageRecognizedText('');
    setPassageInterimText('');
    setPassageError('');
  }, [currentUnit.id, lockedPage]);

  useEffect(() => {
    if (lockedPage) {
      setActivePage(lockedPage);
    }
  }, [lockedPage]);

  useEffect(() => {
    if (readingIndex === safeReadingIndex) return;
    setReadingIndex(safeReadingIndex);
  }, [readingIndex, safeReadingIndex]);

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
  }, [readingIndex]);

  useEffect(() => {
    if (!currentReadingSentence || pronunciationScore === null || pronunciationScore >= 70) return;
    onAddMistake({
      unitId: currentUnit.id,
      category: 'speaking',
      stage: 'reading',
      prompt: currentReadingSentence.text,
      expected: currentReadingSentence.text,
      answer: recognizedSentenceText || '录音完成但识别较弱',
      translation: currentReadingSentence.translation,
      reason: 'pronunciation',
      hint: getPronunciationHint(pronunciationScore),
    });
  }, [currentReadingSentence, pronunciationScore, recognizedSentenceText, onAddMistake, currentUnit.id, getPronunciationHint]);

  useEffect(() => {
    return () => {
      recordingRunRef.current += 1;
      pronunciationSessionRef.current?.cancel();
      mediaRecorderRef.current?.stop?.();
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      if (recordedSentenceUrl) {
        URL.revokeObjectURL(recordedSentenceUrl);
      }
    };
  }, [recordedSentenceUrl]);

  // Warm up the SDK bundle and the Azure token while the student is still on the
  // page, so pressing "开始录音" does not pay for both.
  useEffect(() => {
    preloadSpeechEngine(fetchSpeechToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // One microphone stream shared by the MediaRecorder (playback) and Azure
      // (assessment): what the student hears back is exactly what was scored.
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
        // The student switched sentences (or left the page) while connecting.
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
      const message = error instanceof Error ? error.message : 'Azure 发音评测失败';
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
    // Collect input-quality stats before tearing the capture down: quiet /
    // distant microphones are the usual cause of "分数很低" in the field.
    const microphoneStats = microphoneMonitorRef.current?.stop();
    microphoneMonitorRef.current = null;
    setRecordingQualityWarning(microphoneStats ? buildRecordingQualityWarning(microphoneStats) : '');
    // Stop the recorder immediately so the playback ends where the student stopped.
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // recorder already closed
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

        if (assessment.pronunciationScore < 75 || weakWords.length > 0) {
          onAddMistake({
            unitId: currentUnit.id,
            category: 'speaking',
            stage: 'reading',
            prompt: sentence.text,
            expected: sentence.text,
            answer: weakWords.join(', ') || recognizedText || 'Azure 评测分数偏低',
            translation: sentence.translation,
            reason: 'pronunciation',
            hint: assessment.feedback[1] || assessment.feedback[0],
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Azure 发音评测失败';
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
      const message = error instanceof Error ? error.message : 'Azure 发音评测失败';
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
    const monitor = microphoneMonitorRef.current;
    monitor?.stop();
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
            ? `有 ${missingWords} 个词没读到，先按意群逐句练，再整篇连读。`
            : (assessment.feedback[1] || assessment.feedback[0]),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Azure 发音评测失败';
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

  const handleAzurePronunciationAssessment = (sentenceOverride?: typeof currentReadingSentence) => {
    const sentence = sentenceOverride || currentReadingSentence;
    if (!sentence) return;

    if (recordingPhase === 'listening') {
      void stopRecordingAssessment();
      return;
    }
    if (recordingPhase !== 'idle') return;
    void startRecordingAssessment(sentence);
  };

  const handleStartSentenceMicPractice = (index: number) => {
    if (!currentUnit.sentences[index]) return;
    setReadingIndex(index);
    setActivePage('reading-practice');
    setPendingSentenceAssessmentIndex(index);
  };

  useEffect(() => {
    if (pendingSentenceAssessmentIndex === null) return;
    if (activePage !== 'reading-practice') return;
    if (readingIndex !== pendingSentenceAssessmentIndex) return;

    const sentence = currentUnit.sentences[pendingSentenceAssessmentIndex];
    setPendingSentenceAssessmentIndex(null);
    if (!sentence) return;
    if (recordingPhase !== 'idle' || pronunciationSessionRef.current) return;

    void startRecordingAssessment(sentence);
  }, [activePage, currentUnit.sentences, pendingSentenceAssessmentIndex, readingIndex, recordingPhase]);

  const handleGrammarChoice = (exercise: GrammarExercise, option: string) => {
    if (normalizeGrammarAnswer(option) === normalizeGrammarAnswer(exercise.answer)) {
      onCompleteGrammarExercise(exercise.id);
      setGrammarFeedback((prev) => ({
        ...prev,
        [exercise.id]: `回答正确：${exercise.explanation}`,
      }));
      return;
    }

    setGrammarFeedback((prev) => ({
      ...prev,
      [exercise.id]: `还不对：${exercise.explanation}`,
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
        [exercise.id]: `回答正确：${exercise.explanation}`,
      }));
      return;
    }

    setGrammarFeedback((prev) => ({
      ...prev,
      [exercise.id]: `还不对：${exercise.explanation}`,
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

  const handlePageSelect = (page: TextbookPageKey, stage?: LessonStageKey) => {
    setActivePage(page);
    if (stage) {
      onSelectStage(stage);
    }
  };

  const handleSelectReadingSentence = (index: number) => {
    if (!currentUnit.sentences[index]) return;
    setReadingIndex(index);
  };

  const handleCompleteCurrentSentence = () => {
    const sentence = currentUnit.sentences[safeReadingIndex];
    if (!sentence) return;

    onToggleSentenceFollowed(sentence.id);

    if (safeReadingIndex < currentUnit.sentences.length - 1) {
      setReadingIndex(safeReadingIndex + 1);
      return;
    }

    onCompleteStage('reading');
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">教材同步路径</h2>
          <p className="text-sm text-slate-500">
            {currentUnit.grade} {currentUnit.semester} · {currentUnit.unit} · {currentUnit.title}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold text-blue-600">
            已掌握单词 {masteredCount}/{currentUnit.vocab.length}
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold text-purple-600">
            已跟读句子 {followedCount}/{currentUnit.sentences.length}
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold text-violet-600">
            语法练习 {completedGrammarCount}/{currentUnit.grammar.exercises.length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">选择单元</h3>
          <span className="text-xs text-slate-400">按课时推进学习</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {units.map((unit) => (
            <button
              key={unit.id}
              onClick={() => onSelectUnit(unit.id)}
              className={`px-4 py-3 rounded-2xl border text-left min-w-[180px] transition-all ${
                currentUnit.id === unit.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-400">{unit.unit}</div>
              <div className="font-bold text-slate-800">{unit.title}</div>
            </button>
          ))}
        </div>
      </div>

      {activePage === 'overview' && (
        <TextbookOverviewPage
          currentUnit={currentUnit}
          studyState={studyState}
          textbookPages={textbookPages}
          lockedPage={lockedPage}
          activePage={activePage}
          createTaskId={createTaskId}
          getStageLabel={getStageLabel}
          getLessonOutcomeLabel={getLessonOutcomeLabel}
          onSetActivePage={setActivePage}
          onStageCardClick={(stage) => handlePageSelect(stage === 'preview' ? 'preview' : stage === 'reading' ? 'sentences' : 'overview', stage)}
          onOpenStage={onOpenStage}
        />
      )}

      {activePage === 'preview' && (
        <TextbookPreviewPage
          currentUnit={currentUnit}
          studyState={studyState}
          previewCompleted={previewCompleted}
          onSelectStage={() => onSelectStage('preview')}
          onPlayWord={(word) => playWordAudio(word, 'US')}
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
              hint: '建议先听发音，再结合例句确认词义和用法。',
            });
          }}
          onCompleteAndGoSentences={() => {
            onCompleteStage('preview');
            handlePageSelect('sentences', 'reading');
          }}
        />
      )}

      {activePage === 'sentences' && (
        <TextbookSentencesPage
          currentUnit={currentUnit}
          studyState={studyState}
          readingCompleted={readingCompleted}
          onSelectStage={() => onSelectStage('reading')}
          onPlaySentence={(text) => playWordAudio(text, 'US')}
          onMicPracticeSentence={(_, index) => handleStartSentenceMicPractice(index)}
          onToggleSentenceFollowed={onToggleSentenceFollowed}
          onNeedCorrection={(_, index) => handleStartSentenceMicPractice(index)}
          onCompleteAndOpenDictation={() => {
            onCompleteStage('reading');
            onOpenStage('dictation');
          }}
        />
      )}

      {activePage === 'grammar' && (
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
        />
      )}

      {activePage === 'reading-practice' && (
        <TextbookReadingPracticePage
          currentUnit={currentUnit}
          studyState={studyState}
          currentReadingSentence={currentReadingSentence}
          readingIndex={readingIndex}
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
          onPlaySentence={(text) => playWordAudio(text, 'US')}
          onToggleRecording={() => handleAzurePronunciationAssessment()}
          onCompleteCurrentSentence={handleCompleteCurrentSentence}
          onSelectReadingSentence={handleSelectReadingSentence}
        />
      )}
    </div>
  );
}
