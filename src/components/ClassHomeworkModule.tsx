import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, ClipboardList, Download, Plus, Trash2, Users, X } from 'lucide-react';

import { cn } from '../lib/utils';
import { downloadCsv } from '../lib/csv';
import {
  formatFeedbackTime,
  getHomeworkTaskLabel,
  HOMEWORK_TASK_OPTIONS,
  type TeacherFeedbackNote,
} from './textbook/homework';
import type { AppUser, TextbookContent, TextbookSummary } from './textbook/types';

export interface ClassMemberRecord {
  userId: string;
  username: string;
  grade: string;
  semester: string;
  school: string;
}

export interface ClassRecord {
  id: string;
  name: string;
  grade: string;
  semester: string;
  school: string;
  createdAt: string;
  members: ClassMemberRecord[];
}

export interface HomeworkStudentProgress {
  userId: string;
  username: string;
  completed: boolean;
  tasks: Record<string, boolean>;
}

export interface HomeworkAssignmentRecord {
  id: string;
  classId: string;
  className: string;
  textbookId: string;
  unitId: string;
  title: string;
  taskKeys: string[];
  dueAt: string | null;
  createdAt: string;
  students: HomeworkStudentProgress[];
  completedCount: number;
  totalCount: number;
}

interface ClassHomeworkModuleProps {
  apiFetch: <T,>(path: string, init?: RequestInit) => Promise<T>;
  users: AppUser[];
  textbooks: TextbookSummary[];
  textbookContents: Record<string, TextbookContent>;
}

export function ClassHomeworkModule({
  apiFetch,
  users,
  textbooks,
  textbookContents,
}: ClassHomeworkModuleProps) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [assignments, setAssignments] = useState<HomeworkAssignmentRecord[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newClass, setNewClass] = useState({ name: '', grade: '', semester: '', school: '' });
  const [memberToAdd, setMemberToAdd] = useState('');
  const [newHomework, setNewHomework] = useState({
    textbookId: '',
    unitId: '',
    title: '',
    taskKeys: ['preview'] as string[],
    dueAt: '',
  });
  const [notes, setNotes] = useState<TeacherFeedbackNote[]>([]);
  const [noteTarget, setNoteTarget] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const loadClasses = useCallback(async () => {
    try {
      const data = await apiFetch<{ classes: ClassRecord[] }>('/api/classes');
      setClasses(data.classes);
      setError('');
      setSelectedClassId((prev) => (prev && data.classes.some((item) => item.id === prev) ? prev : data.classes[0]?.id || ''));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载班级失败');
    }
  }, [apiFetch]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const loadAssignments = useCallback(async (classId: string) => {
    if (!classId) {
      setAssignments([]);
      return;
    }
    try {
      const data = await apiFetch<{ assignments: HomeworkAssignmentRecord[] }>(
        `/api/homework?classId=${encodeURIComponent(classId)}`,
      );
      setAssignments(data.assignments);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载作业失败');
    }
  }, [apiFetch]);

  useEffect(() => {
    loadAssignments(selectedClassId);
  }, [loadAssignments, selectedClassId]);

  const selectedClass = classes.find((item) => item.id === selectedClassId) || null;
  const classMemberIds = useMemo(
    () => new Set(selectedClass?.members.map((member) => member.userId) || []),
    [selectedClass],
  );
  const addableUsers = users.filter((user) => !classMemberIds.has(user.id));

  const defaultTextbookId = textbooks[0]?.id || '';
  const activeTextbookId = newHomework.textbookId || defaultTextbookId;
  const unitOptions = useMemo(() => {
    const content = activeTextbookId ? textbookContents[activeTextbookId] : null;
    return (content?.units || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((unit) => ({ id: unit.id, label: `${unit.unitCode} ${unit.title}`.trim() }));
  }, [activeTextbookId, textbookContents]);

  const loadNotes = useCallback(async (classId: string) => {
    if (!classId) {
      setNotes([]);
      return;
    }
    try {
      const data = await apiFetch<{ notes: TeacherFeedbackNote[] }>(
        `/api/feedback?classId=${encodeURIComponent(classId)}`,
      );
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch {
      setNotes([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadNotes(selectedClassId);
  }, [loadNotes, selectedClassId]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setIsBusy(true);
    try {
      await action();
      setError('');
      setNotice(successMessage);
      window.setTimeout(() => setNotice(''), 2500);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateClass = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newClass.name.trim();
    if (!name) return;
    void runAction(async () => {
      await apiFetch('/api/classes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          grade: newClass.grade.trim(),
          semester: newClass.semester.trim(),
          school: newClass.school.trim(),
        }),
      });
      setNewClass({ name: '', grade: '', semester: '', school: '' });
      await loadClasses();
    }, '班级已创建');
  };

  const handleDeleteClass = (classId: string) => {
    void runAction(async () => {
      await apiFetch(`/api/classes?id=${encodeURIComponent(classId)}`, { method: 'DELETE' });
      await loadClasses();
      await loadAssignments('');
    }, '班级已删除');
  };

  const handleAddMember = () => {
    if (!selectedClassId || !memberToAdd) return;
    void runAction(async () => {
      await apiFetch('/api/class-members', {
        method: 'POST',
        body: JSON.stringify({ classId: selectedClassId, userId: memberToAdd }),
      });
      setMemberToAdd('');
      await loadClasses();
    }, '已加入班级');
  };

  const handleRemoveMember = (userId: string) => {
    if (!selectedClassId) return;
    void runAction(async () => {
      await apiFetch(
        `/api/class-members?classId=${encodeURIComponent(selectedClassId)}&userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      );
      await loadClasses();
    }, '已移出班级');
  };

  const handleCreateHomework = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClassId || !activeTextbookId || !newHomework.unitId || newHomework.taskKeys.length === 0) return;
    const unitLabel = unitOptions.find((unit) => unit.id === newHomework.unitId)?.label || '';
    void runAction(async () => {
      await apiFetch('/api/homework', {
        method: 'POST',
        body: JSON.stringify({
          classId: selectedClassId,
          textbookId: activeTextbookId,
          unitId: newHomework.unitId,
          title: newHomework.title.trim() || `${unitLabel} 作业`,
          taskKeys: newHomework.taskKeys,
          dueAt: newHomework.dueAt || undefined,
        }),
      });
      setNewHomework((prev) => ({ ...prev, title: '', dueAt: '' }));
      await loadAssignments(selectedClassId);
    }, '作业已布置');
  };

  const handleDeleteHomework = (id: string) => {
    void runAction(async () => {
      await apiFetch(`/api/homework?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadAssignments(selectedClassId);
    }, '作业已删除');
  };

  const toggleTask = (key: string) => {
    setNewHomework((prev) => ({
      ...prev,
      taskKeys: prev.taskKeys.includes(key)
        ? prev.taskKeys.filter((item) => item !== key)
        : [...prev.taskKeys, key],
    }));
  };

  const handleSubmitNote = (studentId: string, assignmentId: string) => {
    const content = noteDraft.trim();
    if (!content) return;
    void runAction(async () => {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          classId: selectedClassId || undefined,
          assignmentId,
          content,
        }),
      });
      setNoteTarget('');
      setNoteDraft('');
      await loadNotes(selectedClassId);
    }, '评语已保存');
  };

  const handleExportHomeworkCsv = () => {
    const rows = assignments.flatMap((assignment) => {
      const late = assignment.dueAt ? isOverdue(assignment.dueAt) && assignment.completedCount < assignment.totalCount : false;
      return assignment.students.map((student) => [
        assignment.className,
        assignment.title,
        assignment.unitId,
        assignment.dueAt || '',
        late ? '已逾期' : '正常',
        student.username,
        student.completed ? '已完成' : '进行中',
        ...HOMEWORK_TASK_OPTIONS.map((task) => (
          assignment.taskKeys.includes(task.key) ? (student.tasks[task.key] ? '✓' : '✗') : ''
        )),
        assignment.taskKeys.filter((key) => student.tasks[key]).length,
        assignment.taskKeys.length,
      ]);
    });

    downloadCsv(
      `作业完成情况-${selectedClass?.name || '全部班级'}`,
      ['班级', '作业', '单元', '截止日期', '截止状态', '学生', '完成状态',
        ...HOMEWORK_TASK_OPTIONS.map((task) => task.label), '已完成任务数', '任务总数'],
      rows,
    );
  };

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <div
          className={cn(
            'rounded-2xl border p-4 text-sm',
            error ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700',
          )}
        >
          {error || notice}
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              班级管理
            </h3>
            <p className="text-sm text-slate-500 mt-1">先建班级，再把学生账号加进来；作业按班级布置</p>
          </div>
          <span className="text-xs text-slate-400">共 {classes.length} 个班级</span>
        </div>

        <form onSubmit={handleCreateClass} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <input
            type="text"
            value={newClass.name}
            onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
            placeholder="班级名称，如 初一(3)班"
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={newClass.grade}
            onChange={(e) => setNewClass({ ...newClass, grade: e.target.value })}
            placeholder="年级，如 7年级"
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={newClass.semester}
            onChange={(e) => setNewClass({ ...newClass, semester: e.target.value })}
            placeholder="学期，如 下学期"
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isBusy || !newClass.name.trim()}
            className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            新建班级
          </button>
        </form>

        {classes.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-500">
            还没有班级。先创建一个班级，再把学生加进来，就可以布置作业了。
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {classes.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'rounded-2xl border p-4 cursor-pointer transition-all',
                  item.id === selectedClassId ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-slate-50 hover:border-slate-200',
                )}
                onClick={() => setSelectedClassId(item.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {[item.grade, item.semester, item.school].filter(Boolean).join(' · ') || '未填写年级学期'}
                    </div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteClass(item.id);
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                    title="删除班级"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.members.length === 0 && <span className="text-xs text-slate-400">还没有学生</span>}
                  {item.members.map((member) => (
                    <span
                      key={member.userId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-100 text-xs text-slate-600"
                    >
                      {member.username}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedClassId(item.id);
                          handleRemoveMember(member.userId);
                        }}
                        className="text-slate-300 hover:text-rose-500"
                        title="移出班级"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                {item.id === selectedClassId && (
                  <div className="mt-3 flex items-center gap-2">
                    <select
                      value={memberToAdd}
                      onChange={(e) => setMemberToAdd(e.target.value)}
                      className="flex-1 bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none"
                    >
                      <option value="">选择要加入的学生…</option>
                      {addableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}（{user.grade || '未填年级'}）
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddMember}
                      disabled={isBusy || !memberToAdd}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
                    >
                      加入
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={18} className="text-emerald-500" />
              作业布置
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {selectedClass ? `当前班级：${selectedClass.name}` : '先在上方创建并选择一个班级'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">完成情况自动统计</span>
            <button
              onClick={handleExportHomeworkCsv}
              disabled={assignments.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-40"
            >
              <Download size={14} />
              导出完成情况
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateHomework} className="space-y-3 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={activeTextbookId}
              onChange={(e) => setNewHomework((prev) => ({ ...prev, textbookId: e.target.value, unitId: '' }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none"
            >
              {textbooks.length === 0 && <option value="">暂无教材</option>}
              {textbooks.map((textbook) => (
                <option key={textbook.id} value={textbook.id}>
                  {textbook.title}
                </option>
              ))}
            </select>
            <select
              value={newHomework.unitId}
              onChange={(e) => setNewHomework((prev) => ({ ...prev, unitId: e.target.value }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="">选择单元…</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newHomework.dueAt}
              onChange={(e) => setNewHomework((prev) => ({ ...prev, dueAt: e.target.value }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none text-slate-600"
            />
          </div>
          <input
            type="text"
            value={newHomework.title}
            onChange={(e) => setNewHomework((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="作业标题（可留空，默认用单元名）"
            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            {HOMEWORK_TASK_OPTIONS.map((task) => (
              <button
                key={task.key}
                type="button"
                onClick={() => toggleTask(task.key)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                  newHomework.taskKeys.includes(task.key)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-100 bg-slate-50 text-slate-500',
                )}
              >
                {newHomework.taskKeys.includes(task.key) ? '✓ ' : ''}
                {task.label}
              </button>
            ))}
            <button
              type="submit"
              disabled={isBusy || !selectedClassId || !newHomework.unitId || newHomework.taskKeys.length === 0}
              className="ml-auto px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
            >
              布置作业
            </button>
          </div>
        </form>

        {assignments.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-500">
            当前班级还没有作业。选择单元和任务类型后点"布置作业"。
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{assignment.title}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <BookOpen size={12} />
                      {assignment.textbookId} · {assignment.unitId}
                      {assignment.dueAt && (
                        <span className={cn('px-2 py-0.5 rounded-full', isOverdue(assignment.dueAt) && assignment.completedCount < assignment.totalCount ? 'bg-rose-100 text-rose-600' : 'bg-white border border-slate-100 text-slate-500')}>
                          截止 {assignment.dueAt}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {assignment.taskKeys.map((key) => (
                        <span key={key} className="px-2 py-1 rounded-full bg-white border border-slate-100 text-[10px] text-slate-500">
                          {getHomeworkTaskLabel(key)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">完成情况</div>
                      <div className="text-lg font-bold text-emerald-600">
                        {assignment.completedCount}/{assignment.totalCount}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteHomework(assignment.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                      title="删除作业"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {assignment.students.length === 0 && (
                    <div className="text-xs text-slate-400">班级里还没有学生，无法统计完成情况。</div>
                  )}
                  {assignment.students.map((student) => {
                    const latestNote = notes.find((note) => note.studentId === student.userId);
                    const noteKey = `${assignment.id}:${student.userId}`;
                    const composing = noteTarget === noteKey;
                    return (
                      <div key={student.userId} className="rounded-xl bg-white border border-slate-100 p-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700 w-24 truncate">{student.username}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full font-bold',
                              student.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                            )}
                          >
                            {student.completed ? '已完成' : '进行中'}
                          </span>
                          {assignment.taskKeys.map((key) => (
                            <span
                              key={key}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
                                student.tasks[key] ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-slate-100 text-slate-400',
                              )}
                            >
                              {student.tasks[key] ? <Check size={10} /> : null}
                              {getHomeworkTaskLabel(key)}
                            </span>
                          ))}
                          <button
                            onClick={() => {
                              setNoteTarget(composing ? '' : noteKey);
                              setNoteDraft('');
                            }}
                            className="ml-auto px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold hover:bg-amber-100"
                          >
                            {composing ? '取消' : latestNote ? '再写一条评语' : '写评语'}
                          </button>
                        </div>
                        {latestNote && (
                          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5 text-xs text-amber-900">
                            <span className="font-bold">评语</span>
                            <span className="text-amber-600"> · {formatFeedbackTime(latestNote.createdAt)}</span>
                            <div className="mt-0.5">{latestNote.content}</div>
                          </div>
                        )}
                        {composing && (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value.slice(0, 200))}
                              rows={2}
                              placeholder={`给 ${student.username} 写评语（不超过 200 字）`}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-400"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">{noteDraft.length}/200</span>
                              <button
                                onClick={() => handleSubmitNote(student.userId, assignment.id)}
                                disabled={isBusy || !noteDraft.trim()}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold disabled:opacity-50"
                              >
                                保存评语
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const isOverdue = (dueAt: string) => {
  const due = new Date(`${dueAt}T23:59:59`);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
};
