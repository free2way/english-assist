import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Check, ChevronDown, ChevronUp, Languages, Mic2, RotateCw, Send, Sparkles, Square, Volume2 } from 'lucide-react';
import {
  openMicrophoneStream,
  preloadSpeechEngine,
  recognizeSpeechFromMicrophone,
  startPronunciationAssessmentSession,
  stopMediaStream,
} from '../lib/azureSpeech';
import { cn } from '../lib/utils';
import { getSpeakingCoachConfig } from '../lib/study';
import type {
  AzurePronunciationResult,
  LessonStageKey,
  MistakeRecord,
  SpeechTokenResponse,
  UnitBundle,
} from '../lib/study';

interface ChatCorrection {
  original: string;
  corrected: string;
  reason: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  zh?: string;
  corrections?: ChatCorrection[];
}

interface ChatReply {
  message: string;
  replyZh?: string;
  followUp?: string;
  corrections: ChatCorrection[];
  suggestedReplies?: string[];
}

interface Props {
  currentUnit: UnitBundle | null;
  onCompleteStage: (stage: LessonStageKey) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
  apiFetch: <T,>(path: string, init?: RequestInit) => Promise<T>;
  fetchSpeechToken: () => Promise<SpeechTokenResponse>;
  speak: (text: string, accent?: 'US' | 'UK', rate?: number) => Promise<boolean>;
}

const TARGET_TURNS = 3;

export function AITutorModule({
  currentUnit,
  onCompleteStage,
  onAddMistake,
  apiFetch,
  fetchSpeechToken,
  speak,
}: Props) {
  const [tutorMode, setTutorMode] = useState<'unit' | 'free-talk'>('unit');
  const [accent, setAccent] = useState<'US' | 'UK'>('US');

  const coachConfig = tutorMode === 'free-talk'
    ? {
        intro: 'Hi! Let us chat in English today. Tell me about your school day, hobbies, or weekend plans!',
        introZh: '你好！今天我们来用英语自由聊一聊吧。可以跟我说说你的校园生活、兴趣爱好或周末计划！',
        goal: '用完整英文自然交流，完成 3 轮对话。',
        prompts: ['I had a great day at school today.', 'I like playing basketball after class.', 'This weekend I plan to read a book.'],
      }
    : {
        ...getSpeakingCoachConfig(currentUnit),
        introZh: currentUnit ? `欢迎进入 ${currentUnit.unit}（${currentUnit.title}）口语情景练习！试着用英语回答外教的问题吧。` : '欢迎开始英语口语练习！',
      };

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: coachConfig.intro, zh: coachConfig.introZh },
  ]);
  const [visibleZh, setVisibleZh] = useState<Record<number, boolean>>({});
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>(coachConfig.prompts);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [validTurns, setValidTurns] = useState(0);
  const [voiceError, setVoiceError] = useState('');

  // Collapsible pronunciation drill drawer (keeps chat clean & spacious!)
  const [showPronDrawer, setShowPronDrawer] = useState(false);
  const [targetSentenceIndex, setTargetSentenceIndex] = useState(0);
  const [isPreparingSpeaking, setIsPreparingSpeaking] = useState(false);
  const [isAssessingSpeaking, setIsAssessingSpeaking] = useState(false);
  const [speakingAssessment, setSpeakingAssessment] = useState<AzurePronunciationResult | null>(null);
  const [speakingAssessmentError, setSpeakingAssessmentError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const speakingSessionRef = useRef<Awaited<ReturnType<typeof startPronunciationAssessmentSession>> | null>(null);
  const speakingStreamRef = useRef<MediaStream | null>(null);
  const speakingRunRef = useRef(0);

  useEffect(() => {
    setMessages([{ role: 'ai', text: coachConfig.intro, zh: coachConfig.introZh }]);
    setVisibleZh({});
    setSuggestedReplies(coachConfig.prompts);
    setValidTurns(0);
    setVoiceError('');
    setSpeakingAssessment(null);
    setSpeakingAssessmentError('');
    setTargetSentenceIndex(0);
    speakingSessionRef.current?.cancel();
    speakingSessionRef.current = null;
    speakingRunRef.current += 1;
    stopMediaStream(speakingStreamRef.current);
    speakingStreamRef.current = null;
    setIsAssessingSpeaking(false);
    setIsPreparingSpeaking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUnit?.id, tutorMode]);

  useEffect(() => {
    preloadSpeechEngine(fetchSpeechToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSpeakMessage = async (text: string, idx: number, rate = 1) => {
    if (speakingIdx !== null) return;
    setSpeakingIdx(idx);
    try {
      await speak(text, accent, rate);
    } finally {
      setSpeakingIdx(null);
    }
  };

  const handleVoiceInput = async () => {
    if (isListening || isLoading) return;
    setVoiceError('');
    setIsListening(true);
    try {
      const transcript = await recognizeSpeechFromMicrophone({
        getToken: fetchSpeechToken,
        language: accent === 'US' ? 'en-US' : 'en-GB',
      });
      const cleaned = transcript.replace(/[.。]\s*$/, '').trim();
      if (cleaned) {
        setInputValue(cleaned);
      }
    } catch (error: any) {
      setVoiceError(error?.message || '语音识别失败，请检查麦克风权限后重试');
    } finally {
      setIsListening(false);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const userText = (overrideText ?? inputValue).trim();
    if (!userText || isLoading) return;

    setInputValue('');
    setVoiceError('');
    const historyPayload = messages.slice(-10).map((msg) => ({
      role: msg.role === 'ai' ? ('assistant' as const) : ('user' as const),
      content: msg.text,
    }));

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: userText }];
    setMessages(nextMessages);
    setIsLoading(true);

    // Count valid English speaking turns (>= 3 English words)
    const englishWordCount = (userText.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length;
    const nextTurns = englishWordCount >= 3 ? validTurns + 1 : validTurns;
    if (englishWordCount >= 3) {
      setValidTurns(nextTurns);
    }

    try {
      const lessonContext = tutorMode === 'free-talk'
        ? 'Free talk practice with a Chinese middle school student.'
        : currentUnit
          ? `Unit "${currentUnit.title}". Goal: ${coachConfig.goal}. Key sentences: ${currentUnit.sentences.slice(0, 4).map((item) => item.text).join(' ')}`
          : '';

      const data = await apiFetch<ChatReply>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userText,
          corrections: true,
          context: lessonContext,
          history: historyPayload,
        }),
      });

      const fullReplyText = data.followUp ? `${data.message}\n\n${data.followUp}` : data.message;
      const corrections = Array.isArray(data.corrections) ? data.corrections : [];
      const newAiIndex = nextMessages.length;

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: fullReplyText,
          zh: data.replyZh || undefined,
          corrections,
        },
      ]);

      if (Array.isArray(data.suggestedReplies) && data.suggestedReplies.length > 0) {
        setSuggestedReplies(data.suggestedReplies);
      }

      if (nextTurns >= TARGET_TURNS) {
        onCompleteStage('speaking');
      }

      if (currentUnit && corrections.length > 0) {
        corrections.forEach((item) => {
          onAddMistake({
            unitId: currentUnit.id,
            category: 'speaking',
            stage: 'speaking',
            prompt: `口语纠错：${item.original}`,
            expected: item.corrected,
            answer: item.original,
            reason: 'grammar_rule',
            hint: item.reason || '外教建议这样表达更地道。',
          });
        });
      }

      void handleSpeakMessage(data.followUp ? `${data.message} ${data.followUp}` : data.message, newAiIndex, 1);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `抱歉，AI 外教暂时没有连上：${error?.message || '请稍后再试'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelAnswer = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<ChatReply>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: `请围绕 "${coachConfig.goal}" 给出一段 2-3 句的初中生英文示范回答，用词简单自然。`,
          corrections: true,
          task: 'model-answer',
          context: tutorMode === 'unit' && currentUnit ? `Unit "${currentUnit.title}"` : '',
        }),
      });
      const idx = messages.length;
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `参考示范：${data.message}`, zh: data.replyZh || undefined },
      ]);
      void handleSpeakMessage(data.message, idx, 0.95);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `参考示范生成失败：${error?.message || '请稍后再试'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const targetSentence = currentUnit?.sentences[targetSentenceIndex]?.text || currentUnit?.sentences[0]?.text || '';

  const handleTogglePronDrill = async () => {
    const referenceText = targetSentence.trim() || inputValue.trim();
    if (!referenceText) {
      setSpeakingAssessmentError('请先选择一句目标句，或在输入框写一句话后再评测。');
      return;
    }
    if (isPreparingSpeaking) return;

    if (isAssessingSpeaking && speakingSessionRef.current) {
      try {
        const { assessment, weakWords } = await speakingSessionRef.current.stop();
        speakingSessionRef.current = null;
        stopMediaStream(speakingStreamRef.current);
        speakingStreamRef.current = null;
        setSpeakingAssessment(assessment);
        if (currentUnit && (assessment.pronunciationScore < 75 || weakWords.length > 0)) {
          onAddMistake({
            unitId: currentUnit.id,
            category: 'speaking',
            stage: 'speaking',
            prompt: `口语跟读：${referenceText}`,
            expected: referenceText,
            answer: weakWords.join(', ') || '发音分数偏低',
            reason: 'pronunciation',
            hint: assessment.feedback[1] || assessment.feedback[0],
          });
        }
      } catch (error: any) {
        setSpeakingAssessmentError(error?.message || '口语评测失败，请稍后重试');
      } finally {
        speakingSessionRef.current = null;
        stopMediaStream(speakingStreamRef.current);
        speakingStreamRef.current = null;
        setIsAssessingSpeaking(false);
      }
      return;
    }

    setIsPreparingSpeaking(true);
    setSpeakingAssessment(null);
    setSpeakingAssessmentError('');
    const runId = speakingRunRef.current + 1;
    speakingRunRef.current = runId;

    try {
      const stream = await openMicrophoneStream();
      if (speakingRunRef.current !== runId) {
        stopMediaStream(stream);
        return;
      }
      speakingStreamRef.current = stream;
      const session = await startPronunciationAssessmentSession({
        getToken: fetchSpeechToken,
        referenceText,
        language: accent === 'US' ? 'en-US' : 'en-GB',
        mediaStream: stream,
      });
      if (speakingRunRef.current !== runId) {
        session.cancel();
        stopMediaStream(stream);
        return;
      }
      speakingSessionRef.current = session;
      setIsAssessingSpeaking(true);
    } catch (error: any) {
      if (speakingRunRef.current !== runId) return;
      setSpeakingAssessmentError(error?.message || '无法启动口语评测，请检查麦克风权限');
      setIsAssessingSpeaking(false);
      speakingSessionRef.current?.cancel();
      speakingSessionRef.current = null;
      stopMediaStream(speakingStreamRef.current);
      speakingStreamRef.current = null;
    } finally {
      setIsPreparingSpeaking(false);
    }
  };

  return (
    <div className="flex flex-col pb-10">
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 flex flex-col min-h-[72vh]">
        {/* Compact Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl blue-gradient flex items-center justify-center text-white shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 truncate">AI 口语外教</h2>
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 inline-flex items-center gap-1',
                    validTurns >= TARGET_TURNS ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600',
                  )}
                >
                  {validTurns >= TARGET_TURNS && <Check size={12} />}
                  {validTurns >= TARGET_TURNS ? '本轮口语任务已达标' : `对话进度 ${validTurns}/${TARGET_TURNS} 轮`}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {tutorMode === 'free-talk' ? '自由话题英语聊一聊（支持多轮上下文）' : `${currentUnit?.unit || ''} ${currentUnit?.title || ''} · ${coachConfig.goal}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setTutorMode('unit')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', tutorMode === 'unit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                教材情景
              </button>
              <button
                onClick={() => setTutorMode('free-talk')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', tutorMode === 'free-talk' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                自由聊
              </button>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setAccent('US')}
                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all', accent === 'US' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                美音
              </button>
              <button
                onClick={() => setAccent('UK')}
                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all', accent === 'UK' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                英音
              </button>
            </div>
            <button
              onClick={() => setShowPronDrawer((prev) => !prev)}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 border transition-all',
                showPronDrawer ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              句型打分
              {showPronDrawer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* Optional collapsible pronunciation drill drawer */}
        {showPronDrawer && (
          <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {currentUnit && currentUnit.sentences.length > 0 && (
                <select
                  value={targetSentenceIndex}
                  onChange={(e) => setTargetSentenceIndex(Number(e.target.value))}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none"
                >
                  {currentUnit.sentences.map((sentence, idx) => (
                    <option key={sentence.id} value={idx}>
                      目标句 {idx + 1}：{sentence.text}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => targetSentence && void speak(targetSentence, accent, 0.9)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-blue-600 text-xs font-bold inline-flex items-center gap-1"
              >
                <Volume2 size={14} />
                听示范
              </button>
              <button
                onClick={handleTogglePronDrill}
                disabled={isPreparingSpeaking}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5',
                  isPreparingSpeaking
                    ? 'bg-slate-200 text-slate-500 cursor-wait'
                    : isAssessingSpeaking
                      ? 'bg-rose-500 text-white'
                      : 'bg-violet-600 text-white hover:bg-violet-700',
                )}
              >
                {isAssessingSpeaking ? <Square size={13} /> : <Mic2 size={13} />}
                {isPreparingSpeaking ? '准备麦克风...' : isAssessingSpeaking ? '停止并评分' : '跟读打分'}
              </button>
            </div>

            {speakingAssessment && (
              <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-violet-700">总分 {speakingAssessment.pronunciationScore}</span>
                  <span className="text-slate-500">
                    准确 {speakingAssessment.accuracyScore} · 流利 {speakingAssessment.fluencyScore} · 完整 {speakingAssessment.completenessScore}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {speakingAssessment.words.map((word, idx) => (
                    <button
                      key={`${word.word}-${idx}`}
                      type="button"
                      onClick={() => void speak(word.word, accent, 0.8)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold border',
                        word.accuracyScore >= 85
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : word.accuracyScore >= 70
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700',
                      )}
                    >
                      {word.word} {Math.round(word.accuracyScore)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {speakingAssessmentError && (
              <div className="text-xs text-rose-600 font-medium">{speakingAssessmentError}</div>
            )}
          </div>
        )}

        {/* Spacious Chat Feed */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto custom-scrollbar py-5 pr-1 min-h-[340px] max-h-[54vh]">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs',
                  msg.role === 'ai' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-700',
                )}
              >
                {msg.role === 'ai' ? 'AI' : '我'}
              </div>
              <div className="flex flex-col gap-1.5 max-w-[82%]">
                <div
                  className={cn(
                    'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'ai'
                      ? 'bg-slate-50 border border-slate-100 rounded-tl-none text-slate-800'
                      : 'bg-blue-500 rounded-tr-none text-white shadow-sm',
                  )}
                >
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                  {msg.role === 'ai' && msg.zh && visibleZh[idx] && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 text-xs text-slate-500">
                      {msg.zh}
                    </div>
                  )}
                </div>

                {msg.role === 'ai' && msg.corrections && msg.corrections.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                    <div className="text-[11px] font-bold text-amber-800">外教小纠正（已收入错题本）</div>
                    {msg.corrections.map((item, cIdx) => (
                      <div key={`${item.original}-${cIdx}`} className="text-xs text-amber-900">
                        <span className="line-through text-rose-600">{item.original}</span>
                        <span className="mx-1.5">→</span>
                        <span className="font-bold text-emerald-700">{item.corrected}</span>
                        {item.reason && <div className="text-[11px] text-amber-700 mt-0.5">{item.reason}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {msg.role === 'ai' && (
                  <div className="flex items-center gap-3 pl-1">
                    <button
                      onClick={() => void handleSpeakMessage(msg.text, idx, 1)}
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-bold transition-all',
                        speakingIdx === idx ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600',
                      )}
                    >
                      {speakingIdx === idx ? <RotateCw size={11} className="animate-spin" /> : <Volume2 size={11} />}
                      {speakingIdx === idx ? '播放中...' : '朗读'}
                    </button>
                    <button
                      onClick={() => void handleSpeakMessage(msg.text, idx, 0.75)}
                      className="text-[11px] font-bold text-slate-400 hover:text-blue-600"
                    >
                      慢速
                    </button>
                    {msg.zh && (
                      <button
                        onClick={() => setVisibleZh((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-bold transition-all',
                          visibleZh[idx] ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600',
                        )}
                      >
                        <Languages size={11} />
                        {visibleZh[idx] ? '隐藏中文' : '看中文翻译'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 text-xs font-bold">AI</div>
              <div className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none text-sm text-slate-400 flex items-center gap-2">
                <RotateCw size={14} className="animate-spin" />
                外教正在回复...
              </div>
            </div>
          )}
        </div>

        {/* Reply Inspiration Chips */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">不知道怎么回？点一下参考：</span>
            {suggestedReplies.map((reply, idx) => (
              <button
                key={`${reply}-${idx}`}
                type="button"
                onClick={() => setInputValue(reply)}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium hover:bg-blue-50 hover:text-blue-700 transition-all text-left"
              >
                {reply}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void handleModelAnswer()}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-all disabled:opacity-40"
            >
              看参考示范
            </button>
          </div>

          {voiceError && <div className="text-xs font-bold text-rose-600">{voiceError}</div>}

          {/* Input bar with Mic + Send icon */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleVoiceInput()}
              disabled={isListening || isLoading}
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all',
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600',
              )}
              title="点击语音说英文"
            >
              <Mic2 size={20} />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={isListening ? '正在听你说英文...' : '输入英文，或点左侧麦克风开口说（按 Enter 发送）'}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputValue.trim() || isLoading}
              className="w-12 h-12 rounded-2xl blue-gradient text-white flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 hover:scale-[1.02] active:scale-95 transition-all"
              title="发送"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
