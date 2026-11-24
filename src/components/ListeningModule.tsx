import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Ear, RotateCcw, Volume2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { MistakeReason, MistakeRecord, UnitBundle } from './textbook/types';

type ListeningKind = 'word-meaning' | 'sentence-blank' | 'sentence-meaning';

interface ListeningQuestion {
  id: string;
  kind: ListeningKind;
  audioText: string;
  prompt: string;
  hint: string;
  options?: string[];
  answer: string;
  inputMode: 'text' | 'options';
}

interface Props {
  currentUnit: UnitBundle | null;
  speak: (text: string, accent?: 'US' | 'UK', rate?: number) => Promise<boolean>;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
  onRecordAttempt: (attempt: { mode: 'listening'; correct: number; total: number }) => void;
  mistakeReasonLabels: Record<MistakeReason, string>;
}

const KIND_LABELS: Record<ListeningKind, string> = {
  'word-meaning': '听音辨词',
  'sentence-blank': '听句填词',
  'sentence-meaning': '听后选义',
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');

const pickBlankWord = (sentence: string, seed: number) => {
  const words = sentence.split(/\s+/).filter((word) => word.replace(/[^A-Za-z']/g, '').length >= 4);
  if (words.length === 0) return null;
  return words[seed % words.length].replace(/[.,!?;:]+$/g, '');
};

const buildListeningQuestions = (unit: UnitBundle | null): ListeningQuestion[] => {
  if (!unit) return [];
  const questions: ListeningQuestion[] = [];

  // 1) Hear a word, pick its Chinese meaning (never leak word.word in hint!)
  unit.vocab.slice(0, 4).forEach((word, index) => {
    const distractors = unit.vocab
      .filter((item) => item.id !== word.id)
      .slice(index, index + 3)
      .map((item) => item.definition);
    const fallbackDistractors = unit.vocab
      .filter((item) => item.id !== word.id && !distractors.includes(item.definition))
      .map((item) => item.definition);
    const options = Array.from(new Set([word.definition, ...distractors, ...fallbackDistractors])).slice(0, 4);
    if (options.length < 2) return;
    const rotated = [...options.slice((index + 1) % options.length), ...options.slice(0, (index + 1) % options.length)];
    questions.push({
      id: `${unit.id}-listen-word-${word.id}`,
      kind: 'word-meaning',
      audioText: word.word,
      prompt: '听单词发音，选出正确的中文意思',
      hint: word.phonetic ? `音标参考：${word.phonetic}` : '点击上方喇叭反复听发音',
      options: rotated,
      answer: word.definition,
      inputMode: 'options',
    });
  });

  // 2) Hear a sentence, fill the missing word
  unit.sentences.slice(0, 3).forEach((sentence, index) => {
    const blank = pickBlankWord(sentence.text, index);
    if (!blank) return;
    const display = sentence.text.replace(blank, '_____');
    questions.push({
      id: `${unit.id}-listen-blank-${sentence.id}`,
      kind: 'sentence-blank',
      audioText: sentence.text,
      prompt: '听句子，补全横线处缺少的单词',
      hint: display,
      answer: blank,
      inputMode: 'text',
    });
  });

  // 3) Hear a sentence, pick its translation
  unit.sentences.slice(0, 3).forEach((sentence, index) => {
    const distractors = unit.sentences
      .filter((item) => item.id !== sentence.id)
      .slice(index, index + 2)
      .map((item) => item.translation);
    const fallbackDistractors = unit.sentences
      .filter((item) => item.id !== sentence.id && !distractors.includes(item.translation))
      .map((item) => item.translation);
    const options = Array.from(new Set([sentence.translation, ...distractors, ...fallbackDistractors])).slice(0, 3);
    if (options.length < 2) return;
    const rotated = [...options.slice((index + 1) % options.length), ...options.slice(0, (index + 1) % options.length)];
    questions.push({
      id: `${unit.id}-listen-meaning-${sentence.id}`,
      kind: 'sentence-meaning',
      audioText: sentence.text,
      prompt: '听完整句子，选出正确的意思',
      hint: '没听清可以点「慢速再听一遍」',
      options: rotated,
      answer: sentence.translation,
      inputMode: 'options',
    });
  });

  return questions;
};

export function ListeningModule({
  currentUnit,
  speak,
  onAddMistake,
  onRecordAttempt,
}: Props) {
  const questions = useMemo(() => buildListeningQuestions(currentUnit), [currentUnit]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeQuestions = onlyWrong ? questions.filter((question) => wrongIds.includes(question.id)) : questions;
  const safeIndex = activeQuestions.length > 0 ? Math.min(index, activeQuestions.length - 1) : 0;
  const question = activeQuestions[safeIndex];

  useEffect(() => {
    setIndex(0);
    setAnswer('');
    setPicked(null);
    setResult('none');
    setScore({ correct: 0, total: 0 });
    setWrongIds([]);
    setFinished(false);
    setOnlyWrong(false);
  }, [currentUnit?.id]);

  useEffect(() => {
    setAnswer('');
    setPicked(null);
    setResult('none');
  }, [index, onlyWrong]);

  const play = async (rate = 1) => {
    if (!question || isSpeaking) return;
    setIsSpeaking(true);
    try {
      await speak(question.audioText, 'US', rate);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Auto-play audio on question switch
  useEffect(() => {
    if (finished || !question) return;
    if (question.inputMode === 'text') {
      inputRef.current?.focus();
    }
    const timer = setTimeout(() => {
      void play(1);
    }, 260);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, onlyWrong, currentUnit?.id, finished]);

  const gradeSubmission = (submitted: string) => {
    if (!question || result !== 'none' || !submitted.trim()) return;
    const correct = normalize(submitted) === normalize(question.answer);
    setResult(correct ? 'correct' : 'wrong');
    setScore((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    if (correct) {
      if (onlyWrong) {
        setWrongIds((prev) => prev.filter((id) => id !== question.id));
      }
      return;
    }

    setWrongIds((prev) => (prev.includes(question.id) ? prev : [...prev, question.id]));
    if (!currentUnit) return;
    onAddMistake({
      unitId: currentUnit.id,
      category: question.kind === 'word-meaning' ? 'vocab' : 'dictation',
      stage: 'dictation',
      prompt: `听力${KIND_LABELS[question.kind]}：${question.audioText}`,
      expected: question.answer,
      answer: submitted.trim(),
      reason: question.kind === 'word-meaning'
        ? 'unknown_vocab'
        : question.kind === 'sentence-blank'
          ? 'missing_word'
          : 'sentence_judgement',
      hint: question.kind === 'word-meaning'
        ? '再听一遍单词发音，并把词义和例句一起记。'
        : '先听慢速版，再看着句子跟读一遍。',
    });
  };

  const handleOptionClick = (option: string) => {
    if (result !== 'none') return;
    setPicked(option);
    // Single-click option immediately grades — removes unnecessary extra click!
    gradeSubmission(option);
  };

  const next = () => {
    if (safeIndex >= activeQuestions.length - 1 || activeQuestions.length === 0) {
      setFinished(true);
      onRecordAttempt({ mode: 'listening', correct: score.correct, total: score.total });
      return;
    }
    setIndex((prev) => prev + 1);
  };

  // Enter key advances to next question once graded
  useEffect(() => {
    if (result === 'none' || finished) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const restart = (wrongOnly: boolean) => {
    setOnlyWrong(wrongOnly);
    setIndex(0);
    setAnswer('');
    setPicked(null);
    setResult('none');
    setScore({ correct: 0, total: 0 });
    setFinished(false);
  };

  if (!currentUnit || questions.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center text-slate-400">
        当前单元还没有可用于听力练习的词汇或句子。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {finished ? (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-5 max-w-xl mx-auto">
          <div className="text-4xl font-black text-slate-800">
            {score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%
          </div>
          <div className="text-sm text-slate-500">本轮听力答对 {score.correct} / {score.total}</div>
          {wrongIds.length > 0 ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              还有 {wrongIds.length} 道题没通过，已加入错题本，建议马上重练一遍。
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 font-bold">
              全部答对！听力理解很稳。
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {wrongIds.length > 0 && (
              <button onClick={() => restart(true)} className="px-5 py-3 rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">
                只练错题（{wrongIds.length}）
              </button>
            )}
            <button onClick={() => restart(false)} className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-slate-800">
              <RotateCcw size={15} />
              重新练一轮
            </button>
          </div>
        </div>
      ) : question ? (
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-600 text-xs font-bold inline-flex items-center gap-1.5">
              <Ear size={14} />
              {KIND_LABELS[question.kind]}
            </span>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">第 {safeIndex + 1} / {activeQuestions.length} 题</span>
              <span className="font-bold text-emerald-600">
                正确率 {score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(((safeIndex + (result !== 'none' ? 1 : 0)) / activeQuestions.length) * 100)}%` }}
            />
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => play(1)}
                  disabled={isSpeaking}
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-inner',
                    isSpeaking ? 'bg-sky-100 text-sky-600 animate-pulse' : 'bg-sky-50 text-sky-600 hover:scale-105',
                  )}
                >
                  <Volume2 size={36} />
                </button>
                <button
                  onClick={() => play(0.75)}
                  disabled={isSpeaking}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
                >
                  慢速再听一遍 (0.75x)
                </button>
              </div>
              <div className="text-center mt-1">
                <div className="font-bold text-slate-800">{question.prompt}</div>
                <div className={cn(
                  'mt-1.5',
                  question.kind === 'sentence-blank' ? 'text-base font-bold text-slate-700 bg-slate-50 px-4 py-2 rounded-2xl inline-block' : 'text-xs text-slate-400',
                )}>
                  {question.hint}
                </div>
              </div>
            </div>

            {question.inputMode === 'options' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                {question.options?.map((option) => {
                  const isPicked = picked === option;
                  const isAnswer = option === question.answer;
                  return (
                    <button
                      key={option}
                      onClick={() => handleOptionClick(option)}
                      disabled={result !== 'none'}
                      className={cn(
                        'px-4 py-3.5 rounded-2xl border text-sm font-bold text-left transition-all',
                        result !== 'none' && isAnswer
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : isPicked && result === 'wrong'
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50/40',
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <input
                  ref={inputRef}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (result === 'none') {
                        gradeSubmission(answer);
                      } else {
                        next();
                      }
                    }
                  }}
                  disabled={result !== 'none'}
                  placeholder="输入听到的空缺单词，按 Enter 提交"
                  className={cn(
                    'flex-1 rounded-2xl border px-5 py-3.5 text-center text-lg font-bold outline-none',
                    result === 'correct'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : result === 'wrong'
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-slate-50 focus:border-sky-400 focus:bg-white',
                  )}
                />
                {result === 'none' && (
                  <button
                    onClick={() => gradeSubmission(answer)}
                    disabled={!answer.trim()}
                    className="px-6 py-3.5 rounded-2xl bg-sky-500 text-white font-bold disabled:opacity-40 hover:bg-sky-600"
                  >
                    提交
                  </button>
                )}
              </div>
            )}

            {result !== 'none' && (
              <div
                className={cn(
                  'mt-4 rounded-2xl border p-4 flex items-center justify-between gap-3 text-sm',
                  result === 'correct' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700',
                )}
              >
                <div className="flex items-start gap-2">
                  {result === 'correct' ? <Check size={18} className="shrink-0 mt-0.5" /> : <X size={18} className="shrink-0 mt-0.5" />}
                  <div>
                    <div className="font-bold">{result === 'correct' ? '回答正确！' : '答错了，记住正确内容：'}</div>
                    <div className="text-xs mt-0.5">正确答案：{question.answer}</div>
                  </div>
                </div>
                <button
                  onClick={next}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 hover:bg-slate-800"
                >
                  {safeIndex >= activeQuestions.length - 1 ? '查看结果' : '下一题'}
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
