import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Ear, RotateCcw, Volume2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LessonStageKey, MistakeReason, MistakeRecord, UnitBundle } from './textbook/types';

type ListeningKind = 'word-meaning' | 'sentence-blank' | 'sentence-meaning';

interface ListeningQuestion {
  id: string;
  kind: ListeningKind;
  /** Text that is played through TTS before answering. */
  audioText: string;
  prompt: string;
  /** Shown above the input / options to give the learner context. */
  hint: string;
  options?: string[];
  answer: string;
  /** What the learner must type (blank mode) or pick (option modes). */
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

const normalize = (value: string) => value.trim().toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ');

/** Picks a content word to blank out (skips very short function words). */
const pickBlankWord = (sentence: string, seed: number) => {
  const words = sentence.split(/\s+/).filter((word) => word.replace(/[^A-Za-z']/g, '').length >= 4);
  if (words.length === 0) return null;
  return words[seed % words.length];
};

const buildListeningQuestions = (unit: UnitBundle | null): ListeningQuestion[] => {
  if (!unit) return [];
  const questions: ListeningQuestion[] = [];

  // 1) hear a word, pick its Chinese meaning
  unit.vocab.slice(0, 4).forEach((word, index) => {
    const distractors = unit.vocab
      .filter((item) => item.id !== word.id)
      .slice(index, index + 3)
      .map((item) => item.definition);
    const options = [word.definition, ...distractors]
      .filter((item, itemIndex, list) => list.indexOf(item) === itemIndex)
      .slice(0, 4);
    if (options.length < 2) return;
    const rotated = [...options.slice(index % options.length), ...options.slice(0, index % options.length)];
    questions.push({
      id: `${unit.id}-listen-word-${word.id}`,
      kind: 'word-meaning',
      audioText: word.word,
      prompt: '听发音，选出正确的词义',
      hint: `听到的单词：${word.phonetic || word.word}`,
      options: rotated,
      answer: word.definition,
      inputMode: 'options',
    });
  });

  // 2) hear a sentence, fill the missing word
  unit.sentences.slice(0, 3).forEach((sentence, index) => {
    const blank = pickBlankWord(sentence.text, index);
    if (!blank) return;
    const display = sentence.text.replace(blank, '_____');
    questions.push({
      id: `${unit.id}-listen-blank-${sentence.id}`,
      kind: 'sentence-blank',
      audioText: sentence.text,
      prompt: '听句子，补全缺少的单词',
      hint: display,
      answer: blank,
      inputMode: 'text',
    });
  });

  // 3) hear a sentence, pick its translation
  unit.sentences.slice(0, 3).forEach((sentence, index) => {
    const distractors = unit.sentences
      .filter((item) => item.id !== sentence.id)
      .slice(index, index + 2)
      .map((item) => item.translation);
    const options = [sentence.translation, ...distractors]
      .filter((item, itemIndex, list) => list.indexOf(item) === itemIndex)
      .slice(0, 3);
    if (options.length < 2) return;
    const rotated = [...options.slice(index % options.length), ...options.slice(0, index % options.length)];
    questions.push({
      id: `${unit.id}-listen-meaning-${sentence.id}`,
      kind: 'sentence-meaning',
      audioText: sentence.text,
      prompt: '听句子，选出正确的意思',
      hint: '先完整听一遍，再选意思',
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
  mistakeReasonLabels,
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

  const activeQuestions = onlyWrong ? questions.filter((question) => wrongIds.includes(question.id)) : questions;
  const question = activeQuestions[index];

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

  const submit = () => {
    if (!question || result !== 'none') return;
    const submitted = question.inputMode === 'options' ? (picked || '') : answer;
    if (!submitted.trim()) return;
    const correct = normalize(submitted) === normalize(question.answer);
    setResult(correct ? 'correct' : 'wrong');
    setScore((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    if (correct) return;

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

  const next = () => {
    if (index >= activeQuestions.length - 1) {
      setFinished(true);
      onRecordAttempt({ mode: 'listening', correct: score.correct, total: score.total });
      return;
    }
    setIndex((prev) => prev + 1);
  };

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
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center text-slate-500">
        当前单元还没有可用于听力练习的词汇或句子。
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-sky-500 uppercase tracking-[0.3em]">Listening Lab</p>
            <h2 className="text-2xl font-black text-slate-800 mt-2">听力专项训练</h2>
            <p className="text-sm text-slate-500 mt-1">
              {currentUnit.unit} · {currentUnit.title} · 听音辨词 + 听句填词 + 听后选义
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-center">
              <div className="text-[10px] text-slate-400">进度</div>
              <div className="text-lg font-bold text-slate-700">
                {finished ? activeQuestions.length : index + 1} / {activeQuestions.length}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-center">
              <div className="text-[10px] text-slate-400">正确率</div>
              <div className="text-lg font-bold text-emerald-600">
                {score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {finished ? (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Listening Summary</div>
          <div className="text-4xl font-black text-slate-800">
            {score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%
          </div>
          <div className="text-sm text-slate-500">本轮答对 {score.correct} / {score.total}</div>
          {wrongIds.length > 0 ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
              还有 {wrongIds.length} 道题没通过，已写入错题本，可以只练这些题。
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
              全部答对，听力理解很稳，可以试试更长的句子。
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {wrongIds.length > 0 && (
              <button onClick={() => restart(true)} className="px-4 py-3 rounded-2xl bg-amber-500 text-white text-sm font-bold">
                只练错题（{wrongIds.length}）
              </button>
            )}
            <button onClick={() => restart(false)} className="px-4 py-3 rounded-2xl bg-slate-800 text-white text-sm font-bold inline-flex items-center gap-2">
              <RotateCcw size={16} />
              重新练一轮
            </button>
          </div>
        </div>
      ) : question ? (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-600 text-xs font-bold inline-flex items-center gap-1.5">
              <Ear size={14} />
              {KIND_LABELS[question.kind]}
            </span>
            <span className="text-xs text-slate-400">第 {index + 1} / {activeQuestions.length} 题</span>
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
            <button
              onClick={() => play(1)}
              disabled={isSpeaking}
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center transition-all',
                isSpeaking ? 'bg-sky-100 text-sky-500 animate-pulse' : 'bg-sky-50 text-sky-500 hover:scale-105',
              )}
            >
              <Volume2 size={40} />
            </button>
            <button onClick={() => play(0.75)} disabled={isSpeaking} className="text-xs font-bold text-slate-500">
              慢速再听一遍（0.75x）
            </button>
            <div className="text-center">
              <div className="font-bold text-slate-800">{question.prompt}</div>
              <div className="text-xs text-slate-400 mt-1">{question.hint}</div>
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
                    onClick={() => result === 'none' && setPicked(option)}
                    className={cn(
                      'px-4 py-3 rounded-2xl border text-sm font-bold text-left transition-all',
                      result !== 'none' && isAnswer
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : isPicked
                          ? result === 'none'
                            ? 'border-sky-300 bg-sky-50 text-sky-700'
                            : 'border-rose-300 bg-rose-50 text-rose-700'
                          : 'border-slate-100 bg-slate-50 text-slate-600',
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={result !== 'none'}
              placeholder="输入你听到的单词"
              className={cn(
                'w-full mt-5 rounded-2xl border px-4 py-4 text-center text-lg font-bold outline-none',
                result === 'correct'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : result === 'wrong'
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-100 bg-slate-50 focus:border-sky-400',
              )}
            />
          )}

          {result !== 'none' && (
            <div
              className={cn(
                'mt-4 rounded-2xl border p-4 flex items-start gap-2 text-sm',
                result === 'correct' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700',
              )}
            >
              {result === 'correct' ? <Check size={18} /> : <X size={18} />}
              <div>
                <div className="font-bold">{result === 'correct' ? '回答正确' : '再听一遍这句'}</div>
                <div className="text-xs mt-1">正确答案：{question.answer}</div>
              </div>
            </div>
          )}

          <div className="mt-5">
            {result === 'none' ? (
              <button
                onClick={submit}
                disabled={question.inputMode === 'options' ? !picked : !answer.trim()}
                className="w-full bg-sky-500 py-4 rounded-2xl text-white font-bold disabled:opacity-50"
              >
                提交答案
              </button>
            ) : (
              <button onClick={next} className="w-full bg-slate-800 py-4 rounded-2xl text-white font-bold inline-flex items-center justify-center gap-2">
                {index >= activeQuestions.length - 1 ? '结束本轮听力' : '下一题'}
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
