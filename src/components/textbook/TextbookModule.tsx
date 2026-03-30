import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, GraduationCap, MessageSquare, Mic2, PencilLine } from 'lucide-react';
import { TextbookGrammarPage } from './TextbookGrammarPage';
import { TextbookOverviewPage } from './TextbookOverviewPage';
import { TextbookPreviewPage } from './TextbookPreviewPage';
import { TextbookReadingPracticePage } from './TextbookReadingPracticePage';
import { TextbookSentencesPage } from './TextbookSentencesPage';
import {
  calculateTextSimilarity,
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
  const [isRecordingSentence, setIsRecordingSentence] = useState(false);
  const [recordedSentenceUrl, setRecordedSentenceUrl] = useState('');
  const [recognizedSentenceText, setRecognizedSentenceText] = useState('');
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  const [recordingError, setRecordingError] = useState('');
  const [azureAssessment, setAzureAssessment] = useState<AzurePronunciationResult | null>(null);
  const [azureAssessmentError, setAzureAssessmentError] = useState('');
  const [isAzureAssessing, setIsAzureAssessing] = useState(false);
  const [grammarDrafts, setGrammarDrafts] = useState<Record<string, string>>({});
  const [grammarFeedback, setGrammarFeedback] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const currentReadingSentence = currentUnit.sentences[readingIndex] || currentUnit.sentences[0];
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
  }, [currentUnit.id, lockedPage]);

  useEffect(() => {
    if (lockedPage) {
      setActivePage(lockedPage);
    }
  }, [lockedPage]);

  useEffect(() => {
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
      if (recordedSentenceUrl) {
        URL.revokeObjectURL(recordedSentenceUrl);
      }
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      speechRecognitionRef.current?.stop?.();
    };
  }, [recordedSentenceUrl]);

  const stopReadingPractice = () => {
    mediaRecorderRef.current?.stop?.();
    speechRecognitionRef.current?.stop?.();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsRecordingSentence(false);
  };

  const handleToggleSentenceRecording = async () => {
    if (!currentReadingSentence) return;

    if (isRecordingSentence) {
      stopReadingPractice();
      return;
    }

    try {
      setRecordingError('');
      setRecognizedSentenceText('');
      setPronunciationScore(null);
      if (recordedSentenceUrl) {
        URL.revokeObjectURL(recordedSentenceUrl);
        setRecordedSentenceUrl('');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedSentenceUrl(url);
        }
      };
      recorder.start();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        speechRecognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0]?.transcript || '')
            .join(' ')
            .trim();
          setRecognizedSentenceText(transcript);
          if (event.results[0]?.isFinal) {
            const score = calculateTextSimilarity(transcript, currentReadingSentence.text);
            setPronunciationScore(score);
          }
        };
        recognition.onerror = () => {
          setRecordingError('录音已保存，但语音识别没有成功，你仍然可以回放自己的录音。');
        };
        recognition.onend = () => {
          if (isRecordingSentence) {
            setIsRecordingSentence(false);
          }
        };
        recognition.start();
      }

      setIsRecordingSentence(true);
    } catch {
      setRecordingError('当前浏览器无法开启麦克风，请检查麦克风权限。');
      setIsRecordingSentence(false);
    }
  };

  const handleAzurePronunciationAssessment = async () => {
    if (!currentReadingSentence || isAzureAssessing) return;

    setAzureAssessment(null);
    setAzureAssessmentError('');
    setIsAzureAssessing(true);

    try {
      const { token, region } = await fetchSpeechToken();
      const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk');
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = 'en-US';

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
        currentReadingSentence.text,
        SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
        SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      pronunciationConfig.applyTo(recognizer);

      const result = await new Promise<any>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (sdkResult: any) => resolve(sdkResult),
          (sdkError: any) => reject(sdkError)
        );
      });

      recognizer.close();

      const jsonResult = result.properties?.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
      const parsed = jsonResult ? JSON.parse(jsonResult) : null;
      const bestResult = parsed?.NBest?.[0] || {};
      const assessment = bestResult?.PronunciationAssessment || {};
      const words = (bestResult?.Words || []).map((item: any) => ({
        word: String(item.Word || ''),
        accuracyScore: Number(item.PronunciationAssessment?.AccuracyScore || 0),
        errorType: String(item.PronunciationAssessment?.ErrorType || 'None'),
      }));

      const lowWords = words.filter((item: any) => item.accuracyScore < 70).map((item: any) => `${item.word}(${Math.round(item.accuracyScore)})`);
      const feedback: string[] = [];
      const pronunciationValue = Number(assessment?.PronScore || 0);
      const accuracyValue = Number(assessment?.AccuracyScore || 0);
      const fluencyValue = Number(assessment?.FluencyScore || 0);
      const completenessValue = Number(assessment?.CompletenessScore || 0);

      feedback.push(
        pronunciationValue >= 85
          ? '整体发音比较稳定，可以继续提高语流自然度。'
          : pronunciationValue >= 70
            ? '整体读音基本到位，建议重点回练低分单词。'
            : '整体发音还有提升空间，建议先慢速跟读再重新测。'
      );

      if (lowWords.length > 0) feedback.push(`建议优先回练：${lowWords.slice(0, 3).join('、')}`);
      if (fluencyValue < 70) feedback.push('流利度偏弱，建议按意群停顿后再完整朗读一遍。');
      if (completenessValue < 85) feedback.push('句子完整度不足，建议确保整句都读完。');

      const nextAssessment: AzurePronunciationResult = {
        pronunciationScore: Math.round(pronunciationValue),
        accuracyScore: Math.round(accuracyValue),
        fluencyScore: Math.round(fluencyValue),
        completenessScore: Math.round(completenessValue),
        words,
        feedback,
      };

      setAzureAssessment(nextAssessment);
      onAddPronunciationAssessment({
        unitId: currentUnit.id,
        sentenceId: currentReadingSentence.id,
        sentenceText: currentReadingSentence.text,
        pronunciationScore: nextAssessment.pronunciationScore,
        accuracyScore: nextAssessment.accuracyScore,
        fluencyScore: nextAssessment.fluencyScore,
        completenessScore: nextAssessment.completenessScore,
        weakWords: words.filter((item: any) => item.accuracyScore < 70).map((item: any) => item.word),
      });

      if (nextAssessment.pronunciationScore < 75 || lowWords.length > 0) {
        onAddMistake({
          unitId: currentUnit.id,
          category: 'speaking',
          stage: 'reading',
          prompt: currentReadingSentence.text,
          expected: currentReadingSentence.text,
          answer: lowWords.join(', ') || 'Azure 评测分数偏低',
          translation: currentReadingSentence.translation,
          reason: 'pronunciation',
          hint: feedback[1] || feedback[0],
        });
      }
    } catch (error) {
      setAzureAssessmentError(error instanceof Error ? error.message : 'Azure 发音评测失败');
    } finally {
      setIsAzureAssessing(false);
    }
  };

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
          onToggleSentenceFollowed={onToggleSentenceFollowed}
          onNeedCorrection={(sentence) =>
            onAddMistake({
              unitId: currentUnit.id,
              category: 'speaking',
              stage: 'reading',
              prompt: sentence.text,
              expected: '读准重音、连读和停顿',
              answer: '需要纠音',
              translation: sentence.translation,
              reason: 'pronunciation',
              hint: '先逐词听一遍，再完整跟读一遍，重点注意重音和停顿。',
            })
          }
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
          isRecordingSentence={isRecordingSentence}
          recordedSentenceUrl={recordedSentenceUrl}
          recognizedSentenceText={recognizedSentenceText}
          pronunciationScore={pronunciationScore}
          recordingError={recordingError}
          azureAssessment={azureAssessment}
          azureAssessmentError={azureAssessmentError}
          isAzureAssessing={isAzureAssessing}
          getPronunciationHint={getPronunciationHint}
          onSelectStage={() => onSelectStage('reading')}
          onPlaySentence={(text) => playWordAudio(text, 'US')}
          onToggleRecording={handleToggleSentenceRecording}
          onAzureAssessment={handleAzurePronunciationAssessment}
          onCompleteCurrentSentence={() => {
            onToggleSentenceFollowed(currentReadingSentence.id);
            if (readingIndex < currentUnit.sentences.length - 1) {
              setReadingIndex((prev) => prev + 1);
            }
          }}
          onMarkNotSmooth={() =>
            onAddMistake({
              unitId: currentUnit.id,
              category: 'speaking',
              stage: 'reading',
              prompt: currentReadingSentence.text,
              expected: '朗读需更流畅、完整',
              answer: '朗读卡顿/未完成',
              translation: currentReadingSentence.translation,
              reason: 'fluency',
              hint: '建议先分短意群停顿，再完整朗读一遍。',
            })
          }
          onSelectReadingSentence={setReadingIndex}
        />
      )}
    </div>
  );
}
