import React from 'react';
import { BookOpen, Check, ChevronRight, Ear, Flame, GraduationCap, Mic2, PencilLine, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { createTaskId, getStageLabel } from './textbook/helpers';
import {
  formatFeedbackTime,
  getHomeworkTaskLabel,
  getNextHomeworkTask,
  getScoreTone,
  isHomeworkOverdue,
  type StudentFeedbackNote,
  type StudentHomeworkItem,
} from './textbook/homework';
import {
  buildReviewPack,
  getCheckinStreak,
  getOrCreateDailyCheckin,
  getTodayKey,
  getTodayLearningSignals,
  getUnitChallengeStatus,
  type AppUser,
  type LessonStageKey,
  type MistakeRecord,
  type StudyState,
  type UnitBundle,
} from '../lib/study';
import type { StudySectionKey } from './textbook/TextbookModule';

interface Props {
  currentUser: AppUser;
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  homeworkItems: StudentHomeworkItem[];
  teacherFeedback: StudentFeedbackNote[];
  currentTextbookId: string;
  getUnitLabel: (unitId: string) => string;
  onOpenStudySection: (section: StudySectionKey, unitId?: string) => void;
  onOpenStage: (stage: LessonStageKey, unitId?: string) => void;
  onSwitchTextbook: (textbookId: string) => void;
  onRefreshHomework: () => void;
  onRetryMistake: (mistake: MistakeRecord) => void;
  onOpenStats: () => void;
}

export function StudentDashboard({
  currentUser,
  currentUnit,
  studyState,
  homeworkItems,
  teacherFeedback,
  currentTextbookId,
  getUnitLabel,
  onOpenStudySection,
  onOpenStage,
  onSwitchTextbook,
  onRefreshHomework,
  onRetryMistake,
  onOpenStats,
}: Props) {
  const reviewPack = buildReviewPack(studyState);
  const challengeStatus = getUnitChallengeStatus(currentUnit, studyState);
  const todayRecord = getOrCreateDailyCheckin(studyState, getTodayKey());
  const todaySignals = getTodayLearningSignals(studyState);
  const streak = getCheckinStreak(studyState.dailyCheckins);
  const unresolvedCount = studyState.mistakes.filter((item) => !item.resolved).length;

  const previewDone = currentUnit ? studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'preview')) : false;
  const readingDone = currentUnit ? studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'reading')) : false;
  const grammarDone = currentUnit
    ? currentUnit.grammar.exercises.length > 0 && currentUnit.grammar.exercises.every((ex) => studyState.completedGrammarQuestionIds.includes(ex.id))
    : false;
  const dictationDone = currentUnit ? studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'dictation')) : false;
  const speakingDone = currentUnit ? studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'speaking')) : false;

  const nextAction: { label: string; subtitle: string; run: () => void } = !previewDone
    ? { label: '开始记单词', subtitle: '先过一遍本单元核心词，约 3 分钟', run: () => onOpenStudySection('preview') }
    : !readingDone
      ? { label: '继续课文朗读', subtitle: '跟读重点句并听发音反馈，约 4 分钟', run: () => onOpenStudySection('reading') }
      : !grammarDone
        ? { label: '完成语法练习', subtitle: '做完本单元精选语法题，约 3 分钟', run: () => onOpenStudySection('grammar') }
        : !dictationDone
          ? { label: '进行听与写巩固', subtitle: '听力与拼写强化记忆，约 4 分钟', run: () => onOpenStudySection('practice') }
          : !speakingDone
            ? { label: '和 AI 外教聊 3 轮', subtitle: '把刚学的句型开口用起来', run: () => onOpenStage('speaking') }
            : { label: '挑战单元综合闯关', subtitle: '检验本单元全部掌握情况', run: () => onOpenStudySection('challenge') };

  const completedStepCount = [previewDone, readingDone, grammarDone, dictationDone, speakingDone].filter(Boolean).length;
  const pendingHomework = homeworkItems.filter((item) => !item.completed);

  const unitSteps: Array<{
    key: string;
    title: string;
    sub: string;
    done: boolean;
    icon: React.ElementType;
    onClick: () => void;
  }> = [
    {
      key: 'preview',
      title: '1. 记单词',
      sub: currentUnit ? `${currentUnit.vocab.filter((w) => studyState.masteredWordIds.includes(w.id)).length}/${currentUnit.vocab.length} 词` : '--',
      done: previewDone,
      icon: GraduationCap,
      onClick: () => onOpenStudySection('preview'),
    },
    {
      key: 'reading',
      title: '2. 课文朗读',
      sub: currentUnit ? `${currentUnit.sentences.filter((s) => studyState.followedSentenceIds.includes(s.id)).length}/${currentUnit.sentences.length} 句` : '--',
      done: readingDone,
      icon: Mic2,
      onClick: () => onOpenStudySection('reading'),
    },
    {
      key: 'grammar',
      title: '3. 练语法',
      sub: currentUnit ? `${currentUnit.grammar.exercises.filter((e) => studyState.completedGrammarQuestionIds.includes(e.id)).length}/${currentUnit.grammar.exercises.length} 题` : '--',
      done: grammarDone,
      icon: PencilLine,
      onClick: () => onOpenStudySection('grammar'),
    },
    {
      key: 'practice',
      title: '4. 听与写',
      sub: dictationDone ? '已完成' : '听力 / 拼写',
      done: dictationDone,
      icon: Ear,
      onClick: () => onOpenStudySection('practice'),
    },
    {
      key: 'speaking',
      title: '5. AI 口语',
      sub: speakingDone ? '已完成' : '对话 3 轮',
      done: speakingDone,
      icon: Sparkles,
      onClick: () => onOpenStage('speaking'),
    },
  ];

  return (
    <div className="space-y-5 pb-16">
      {/* Compact Welcome + Auto Check-in Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-400 font-bold">当前单元进度</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{completedStepCount} / 5</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">{currentUnit?.unit || '未选单元'}</div>
        </div>

        <button
          onClick={onOpenStats}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-left hover:border-rose-200 transition-all"
        >
          <div className="text-xs text-slate-400 font-bold">待消灭错题</div>
          <div className={cn('text-2xl font-black mt-1', unresolvedCount > 0 ? 'text-rose-500' : 'text-emerald-600')}>
            {unresolvedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{unresolvedCount > 0 ? '点这里去清零' : '全部已清空'}</div>
        </button>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-400 font-bold">今日打卡</div>
          <div className={cn('text-lg font-black mt-1.5 inline-flex items-center gap-1.5', todayRecord.checkedIn ? 'text-emerald-600' : 'text-slate-700')}>
            {todayRecord.checkedIn ? (
              <>
                <Check size={18} />
                已自动打卡
              </>
            ) : (
              `${todaySignals.tasks > 0 ? 1 : 0}/1 课时 · ${todaySignals.practices > 0 ? 1 : 0}/1 练习`
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {todayRecord.checkedIn ? '达标自动记录，无需手动点' : '达标后将自动完成打卡'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-400 font-bold">连续坚持</div>
          <div className="text-2xl font-black text-amber-500 mt-1 inline-flex items-center gap-1.5">
            <Flame size={22} />
            {streak} 天
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{currentUser.grade} · {currentUser.semester}</div>
        </div>
      </div>

      {/* 1. Teacher Homework (highest priority when assigned) */}
      {(homeworkItems.length > 0 || teacherFeedback.length > 0) && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-800">老师布置的作业</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {homeworkItems.length === 0
                  ? '老师给你留了学习评语'
                  : pendingHomework.length > 0
                    ? `还有 ${pendingHomework.length} 项待完成，点「去完成」会自动切到对应单元`
                    : '所有作业已完成，继续保持！'}
              </p>
            </div>
            <button
              onClick={onRefreshHomework}
              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold inline-flex items-center gap-1 hover:bg-slate-200"
            >
              <RefreshCw size={12} />
              刷新
            </button>
          </div>

          {teacherFeedback.length > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-amber-800">老师评语</div>
              {teacherFeedback.map((note) => (
                <div key={note.id} className="text-sm text-amber-900">
                  <span>{note.content}</span>
                  <span className="text-[11px] text-amber-600 ml-2">
                    ({note.className ? `${note.className} · ` : ''}{formatFeedbackTime(note.createdAt)})
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {homeworkItems.map((item) => {
              const overdue = isHomeworkOverdue(item);
              const nextTask = getNextHomeworkTask(item);
              const otherTextbook = Boolean(currentTextbookId) && item.textbookId !== currentTextbookId;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3',
                    item.completed
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : overdue
                        ? 'border-rose-200 bg-rose-50/50'
                        : 'border-slate-100 bg-slate-50',
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800">{item.title}</span>
                      {typeof item.score === 'number' && (
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', getScoreTone(item.score))}>
                          老师评分 {item.score}
                        </span>
                      )}
                      {item.dueAt && (
                        <span className={cn('text-xs font-bold', overdue ? 'text-rose-600' : 'text-slate-400')}>
                          截止 {item.dueAt}{overdue ? ' · 已逾期' : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{item.className} · {getUnitLabel(item.unitId)}</div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {item.taskKeys.map((key) => (
                        <span
                          key={key}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
                            item.tasks[key] ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-600',
                          )}
                        >
                          {item.tasks[key] && <Check size={11} />}
                          {getHomeworkTaskLabel(key)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {item.completed ? (
                    <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold self-start md:self-center shrink-0">
                      已完成 ✓
                    </span>
                  ) : otherTextbook ? (
                    <button
                      onClick={() => onSwitchTextbook(item.textbookId)}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0"
                    >
                      切换到作业教材
                    </button>
                  ) : (
                    <button
                      onClick={() => nextTask && onOpenStage(nextTask, item.unitId)}
                      disabled={!nextTask}
                      className="px-5 py-2.5 rounded-xl blue-gradient text-white text-xs font-bold shadow-sm disabled:opacity-50 shrink-0"
                    >
                      去完成
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Primary Learning Path Card (single clear CTA + 5 directly-clickable steps) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
              <BookOpen size={14} />
              {currentUnit ? `${currentUnit.unit} · ${currentUnit.title}` : '同步单元学习'}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{nextAction.label}</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{nextAction.subtitle}</p>
          </div>
          <button
            onClick={nextAction.run}
            className="px-6 py-3.5 rounded-2xl blue-gradient text-white font-bold text-sm shadow-md shadow-blue-100 hover:scale-[1.01] active:scale-95 transition-all inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            {nextAction.label}
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {unitSteps.map((step) => (
            <button
              key={step.key}
              onClick={step.onClick}
              className={cn(
                'rounded-2xl border p-4 text-left transition-all hover:shadow-sm',
                step.done
                  ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'
                  : 'border-slate-100 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center',
                    step.done ? 'bg-emerald-500 text-white' : 'bg-white text-blue-600 border border-slate-100',
                  )}
                >
                  {step.done ? <Check size={16} /> : <step.icon size={16} />}
                </div>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
              <div className="font-bold text-slate-800 text-sm">{step.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{step.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Today's Mistakes to Clear + Unit Challenge */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-800">今日优先消灭的错题</h3>
              <p className="text-xs text-slate-500 mt-0.5">点「去消灭」直达原题，答对立即从错题本销账</p>
            </div>
            {unresolvedCount > 3 && (
              <button onClick={onOpenStats} className="text-xs font-bold text-blue-600 hover:underline">
                查看全部 ({unresolvedCount})
              </button>
            )}
          </div>

          {reviewPack.length === 0 ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
              太棒了！目前没有待复习的错题，可以直接推进新内容。
            </div>
          ) : (
            <div className="space-y-2.5">
              {reviewPack.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">
                        {item.reasonLabel}
                      </span>
                      <span className="text-[11px] text-slate-400">{getStageLabel(item.stage)}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800 truncate mt-1">{item.mistake.prompt}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">正确：{item.mistake.expected}</div>
                  </div>
                  <button
                    onClick={() => onRetryMistake(item.mistake)}
                    className="px-3.5 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 shrink-0"
                  >
                    去消灭
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              <h3 className="font-bold text-slate-800">单元综合闯关</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {currentUnit ? `${currentUnit.unit} · ${currentUnit.title}` : '暂无当前单元'} · 5 关快速检测掌握度
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500">本单元准备度</span>
                <span className="font-bold text-slate-700">{challengeStatus.progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', challengeStatus.ready ? 'bg-emerald-500' : 'bg-blue-500')}
                  style={{ width: `${challengeStatus.progress}%` }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpenStudySection('challenge')}
            className={cn(
              'w-full py-3 rounded-2xl text-white text-sm font-bold transition-all',
              challengeStatus.ready ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800',
            )}
          >
            {challengeStatus.ready ? '开始正式闯关' : '先试做一次闯关'}
          </button>
        </div>
      </div>
    </div>
  );
}
