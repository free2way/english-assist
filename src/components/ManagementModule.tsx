import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Check,
  GraduationCap,
  LineChart as LineChartIcon,
  Lock,
  Plus,
  RotateCw,
  Save,
  School,
  ShieldCheck,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { cn } from '../lib/utils';
import type {
  AIConfig,
  AppUser,
  ChallengeStatus,
  SevenDayTrendPoint,
  StudyState,
  TextbookContent,
  TextbookSummary,
  UnitBundle,
} from './textbook/types';

interface SampleCatalogItem {
  id: string;
  title: string;
  stage: string;
  grade: string;
  semester: string;
  unitCount: number;
  description: string;
}

interface ClassSnapshot {
  user: AppUser;
  state: StudyState;
  textbookTitle: string;
  currentUnit: UnitBundle | null;
  challenge: ChallengeStatus;
  completedTasks: number;
  mistakes: number;
  streak: number;
  trend: SevenDayTrendPoint[];
}

interface ManagementModuleProps {
  textbooks: TextbookSummary[];
  onTextbooksChanged: () => Promise<void>;
  apiFetch: <T,>(path: string, init?: RequestInit) => Promise<T>;
  gradeOptions: string[];
  semesterOptions: string[];
  defaultAIConfig: AIConfig;
  aiConfigStorageKey: string;
  buildUnitBundlesFromTextbook: (textbook: TextbookContent | null) => UnitBundle[];
  loadStudyStateForUser: (username: string, textbookId: string, units: UnitBundle[]) => StudyState;
  createInitialStudyState: (units: UnitBundle[]) => StudyState;
  getUnitChallengeStatus: (unit: UnitBundle | null, studyState: StudyState) => ChallengeStatus;
  getCheckinStreak: (dailyCheckins: StudyState['dailyCheckins']) => number;
  buildSevenDayTrend: (dailyCheckins: StudyState['dailyCheckins']) => SevenDayTrendPoint[];
}

export function ManagementModule({
  textbooks,
  onTextbooksChanged,
  apiFetch,
  gradeOptions,
  semesterOptions,
  defaultAIConfig,
  aiConfigStorageKey,
  buildUnitBundlesFromTextbook,
  loadStudyStateForUser,
  createInitialStudyState,
  getUnitChallengeStatus,
  getCheckinStreak,
  buildSevenDayTrend,
}: ManagementModuleProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [sampleCatalog, setSampleCatalog] = useState<SampleCatalogItem[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success'>('idle');
  const [textbookError, setTextbookError] = useState('');
  const [textbookContents, setTextbookContents] = useState<Record<string, TextbookContent>>({});
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem(aiConfigStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultAIConfig,
          model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : defaultAIConfig.model,
          apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : defaultAIConfig.apiKey,
          baseURL: typeof parsed.baseURL === 'string' && parsed.baseURL.trim() ? parsed.baseURL : defaultAIConfig.baseURL,
        };
      } catch {
        return defaultAIConfig;
      }
    }
    return defaultAIConfig;
  });
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    grade: '7年级',
    semester: '上学期',
    school: '',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [userError, setUserError] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const classSnapshots: ClassSnapshot[] = users.map((user) => {
    const matchedTextbook = textbooks.find((item) => item.grade === user.grade && item.semester === user.semester) || textbooks[0];
    const textbookContent = matchedTextbook ? textbookContents[matchedTextbook.id] : undefined;
    const units = buildUnitBundlesFromTextbook(textbookContent || null);
    const state = matchedTextbook ? loadStudyStateForUser(user.username, matchedTextbook.id, units) : createInitialStudyState(units);
    const currentUnit = units.find((unit) => unit.id === state.currentUnitId) || units[0] || null;
    const challenge = getUnitChallengeStatus(currentUnit, state);

    return {
      user,
      state,
      textbookTitle: matchedTextbook?.title || '未导入教材',
      currentUnit,
      challenge,
      completedTasks: state.completedTaskIds.length,
      mistakes: state.mistakes.length,
      streak: getCheckinStreak(state.dailyCheckins),
      trend: buildSevenDayTrend(state.dailyCheckins),
    };
  });

  const filteredSnapshots = classSnapshots.filter((snapshot) => {
    if (gradeFilter !== 'all' && snapshot.user.grade !== gradeFilter) return false;
    if (semesterFilter !== 'all' && snapshot.user.semester !== semesterFilter) return false;
    if (unitFilter !== 'all' && snapshot.currentUnit?.unit !== unitFilter) return false;
    return true;
  });

  const classTrend = buildSevenDayTrend(
    filteredSnapshots.flatMap((snapshot) => snapshot.state.dailyCheckins),
  ).map((item) => ({
    ...item,
    progress: filteredSnapshots.length > 0 ? Math.round(item.progress / filteredSnapshots.length) : 0,
    checkedIn: filteredSnapshots.reduce((sum, snapshot) => {
      const record = snapshot.state.dailyCheckins.find((entry) => entry.date === item.date);
      return sum + (record?.checkedIn ? 1 : 0);
    }, 0),
  }));

  const classSummary = {
    totalStudents: filteredSnapshots.length,
    activeStudents: filteredSnapshots.filter((item) => item.completedTasks > 0 || item.mistakes > 0).length,
    averageProgress: filteredSnapshots.length > 0
      ? Math.round(filteredSnapshots.reduce((sum, item) => sum + item.challenge.progress, 0) / filteredSnapshots.length)
      : 0,
    riskStudents: filteredSnapshots.filter((item) => item.mistakes >= 3).length,
  };

  const unitFilterOptions = Array.from(new Set(classSnapshots.map((item) => item.currentUnit?.unit).filter(Boolean))) as string[];

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const data = await apiFetch<{ users: AppUser[] }>('/api/users');
      setUsers(data.users);
      setUserError('');
    } catch (error) {
      setUserError(error instanceof Error ? error.message : '加载用户失败');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadSampleCatalog = useCallback(async () => {
    try {
      const data = await apiFetch<{ samples: SampleCatalogItem[] }>('/api/admin/textbook-samples');
      setSampleCatalog(data.samples);
      setTextbookError('');
    } catch (error) {
      setTextbookError(error instanceof Error ? error.message : '加载教材样板失败');
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSampleCatalog();
  }, [loadSampleCatalog]);

  useEffect(() => {
    let cancelled = false;

    const loadContents = async () => {
      if (textbooks.length === 0) {
        setTextbookContents({});
        return;
      }

      try {
        const entries = await Promise.all(
          textbooks.map(async (item) => {
            const data = await apiFetch<{ textbook: TextbookContent }>(`/api/textbooks/${item.id}`);
            return [item.id, data.textbook] as const;
          }),
        );

        if (!cancelled) {
          setTextbookContents(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!cancelled) {
          setTextbookError(error instanceof Error ? error.message : '加载教材内容失败');
        }
      }
    };

    loadContents();

    return () => {
      cancelled = true;
    };
  }, [apiFetch, textbooks]);

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedUsername = newUser.username.trim();
    const trimmedPassword = newUser.password.trim();

    if (!trimmedUsername || !trimmedPassword) return;

    try {
      const data = await apiFetch<{ user: AppUser }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
          grade: newUser.grade,
          semester: newUser.semester,
          school: newUser.school.trim(),
        }),
      });

      setUsers((prev) => [data.user, ...prev]);
      setNewUser({ username: '', password: '', grade: '7年级', semester: '上学期', school: '' });
      setUserError('');
    } catch (error) {
      setUserError(error instanceof Error ? error.message : '创建用户失败');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await apiFetch<{ ok: true }>(`/api/users/${id}`, {
        method: 'DELETE',
      });
      setUsers((prev) => prev.filter((user) => user.id !== id));
    } catch (error) {
      setUserError(error instanceof Error ? error.message : '删除用户失败');
    }
  };

  const handleSaveAIConfig = () => {
    setSaveStatus('saving');
    localStorage.setItem(aiConfigStorageKey, JSON.stringify(aiConfig));
    setTimeout(() => {
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleImportSample = async (sampleId: string) => {
    setImportStatus('importing');
    try {
      await apiFetch<{ textbook: TextbookSummary }>('/api/admin/textbooks/import-sample', {
        method: 'POST',
        body: JSON.stringify({ sampleId }),
      });
      await onTextbooksChanged();
      setTextbookError('');
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 2000);
    } catch (error) {
      setTextbookError(error instanceof Error ? error.message : '导入教材失败');
      setImportStatus('idle');
    }
  };

  const handleImportAllSamples = async () => {
    setImportStatus('importing');
    try {
      await apiFetch<{ textbooks: TextbookSummary[] }>('/api/admin/textbooks/import-all-samples', {
        method: 'POST',
      });
      await onTextbooksChanged();
      setTextbookError('');
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 2000);
    } catch (error) {
      setTextbookError(error instanceof Error ? error.message : '批量导入教材失败');
      setImportStatus('idle');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-100">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统管理</h2>
          <p className="text-sm text-slate-500">管理用户账号与 AI 配置</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-800">班级学习看板</h3>
            <p className="text-sm text-slate-500 mt-1">面向小规模班级的学习推进与风险观察</p>
          </div>
          <span className="text-xs text-slate-400">当前设备本地数据</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
            <option value="all">全部年级</option>
            {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
            <option value="all">全部学期</option>
            {semesterOptions.map((semester) => <option key={semester} value={semester}>{semester}</option>)}
          </select>
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
            <option value="all">全部单元</option>
            {unitFilterOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">学生人数</div>
            <div className="text-xl font-bold text-slate-800">{classSummary.totalStudents}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">有学习记录</div>
            <div className="text-xl font-bold text-blue-600">{classSummary.activeStudents}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">平均闯关准备度</div>
            <div className="text-xl font-bold text-emerald-600">{classSummary.averageProgress}%</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">需重点关注</div>
            <div className="text-xl font-bold text-rose-500">{classSummary.riskStudents}</div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-3xl border border-slate-100 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-slate-800">最近 7 天学习趋势</h4>
              <p className="text-xs text-slate-500 mt-1">观察班级日推进强度和打卡人数变化</p>
            </div>
            <span className="text-xs text-slate-400">筛选后实时统计</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={classTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="progress" stroke="#3b82f6" strokeWidth={3} name="平均推进动作" />
                <Line type="monotone" dataKey="checkedIn" stroke="#10b981" strokeWidth={3} name="打卡人数" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          {filteredSnapshots.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-500">
              当前筛选条件下没有学生数据，可以切换筛选或先创建学生账号。
            </div>
          ) : (
            filteredSnapshots.map((snapshot) => (
              <div key={snapshot.user.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{snapshot.user.username}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {snapshot.user.grade} · {snapshot.user.semester} · 当前单元 {snapshot.currentUnit?.unit || '--'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">教材：{snapshot.textbookTitle}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-slate-600">已完成任务 {snapshot.completedTasks}</span>
                    <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-slate-600">错题 {snapshot.mistakes}</span>
                    <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-slate-600">连续打卡 {snapshot.streak} 天</span>
                    <span className={cn(
                      'px-3 py-1 rounded-full',
                      snapshot.challenge.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    )}>
                      闯关准备度 {snapshot.challenge.progress}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Plus size={18} className="text-blue-500" />
              新增用户
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">用户名</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">密码</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="设置初始密码"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">年级</label>
                  <select
                    value={newUser.grade}
                    onChange={(e) => setNewUser({ ...newUser, grade: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                  >
                    {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">学期</label>
                  <select
                    value={newUser.semester}
                    onChange={(e) => setNewUser({ ...newUser, semester: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                  >
                    {semesterOptions.map((semester) => <option key={semester} value={semester}>{semester}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">学校</label>
                  <input
                    type="text"
                    value={newUser.school}
                    onChange={(e) => setNewUser({ ...newUser, school: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="请输入学校名称"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all"
              >
                添加新用户
              </button>
              {userError && (
                <p className="text-xs font-bold text-red-500 text-center">{userError}</p>
              )}
            </form>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User size={18} className="text-blue-500" />
                用户列表
              </span>
              <span className="text-xs text-slate-400 font-normal">共 {users.length} 名用户</span>
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {isLoadingUsers ? (
                <div className="text-center py-10 text-slate-300 italic text-sm">正在加载用户...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-10 text-slate-300 italic text-sm">暂无普通用户</div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm">
                        <User size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate">{user.username}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5"><GraduationCap size={10} /> {user.grade} · {user.semester}</span>
                          <span className="flex items-center gap-0.5"><School size={10} /> {user.school}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="self-end sm:self-auto p-2 text-slate-300 hover:text-red-500 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <BookOpen size={18} className="text-emerald-500" />
              教材导入后台
            </h3>
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600">
                当前已导入 {textbooks.length} 套教材。现在可导入现有样板，并继续扩展为 PDF / Excel / OCR 导入。
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleImportAllSamples}
                  disabled={importStatus === 'importing'}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold"
                >
                  {importStatus === 'importing' ? '批量导入中...' : '导入全部现有样板'}
                </button>
              </div>
              <div className="space-y-3">
                {sampleCatalog.map((sample) => {
                  const imported = textbooks.some((item) => item.id === sample.id);
                  return (
                    <div key={sample.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-800">{sample.title}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {sample.stage} · {sample.grade} · {sample.semester} · {sample.unitCount} 个单元
                          </div>
                          <div className="text-xs text-slate-400 mt-2">{sample.description}</div>
                        </div>
                        <button
                          onClick={() => handleImportSample(sample.id)}
                          disabled={importStatus === 'importing'}
                          className={cn(
                            'px-4 py-2 rounded-xl text-sm font-bold',
                            imported ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500 text-white',
                          )}
                        >
                          {imported ? '重新导入样板' : importStatus === 'importing' ? '导入中...' : '导入教材'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {textbookError && <p className="text-xs font-bold text-red-500">{textbookError}</p>}
              {importStatus === 'success' && <p className="text-xs font-bold text-emerald-600">教材样板导入完成，前台教材选择器已可使用。</p>}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Zap size={18} className="text-purple-500" />
              AI 模型配置
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">统一 AI 接口</label>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600">
                  使用 OpenAI 兼容协议配置聊天模型与语音接口。你可以接 OpenAI，也可以接其他兼容 `/chat/completions` 和 `/audio/speech` 的服务。
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">Base URL</label>
                <input
                  type="text"
                  value={aiConfig.baseURL || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, baseURL: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                  placeholder="例如: https://api.openai.com/v1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">选择模型</label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (推荐)', desc: '性价比高，响应快速' },
                    { id: 'gpt-4o', name: 'GPT-4o', desc: '更强的理解和生成能力' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: '经济实惠' },
                    { id: 'deepseek-chat', name: 'DeepSeek Chat', desc: '国产模型，中文友好' },
                    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', desc: 'Anthropic 模型' },
                    { id: 'custom', name: '自定义模型', desc: '手动输入模型名称' },
                  ].map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setAiConfig({ ...aiConfig, model: model.id === 'custom' ? '' : model.id })}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-2xl border transition-all text-left',
                        aiConfig.model === model.id || (model.id === 'custom' && !['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'deepseek-chat', 'claude-3-sonnet'].includes(aiConfig.model))
                          ? 'bg-purple-50 border-purple-200 ring-4 ring-purple-500/5'
                          : 'bg-slate-50 border-slate-100 hover:border-slate-200',
                      )}
                    >
                      <div>
                        <div className={cn('font-bold text-sm', aiConfig.model === model.id ? 'text-purple-700' : 'text-slate-700')}>
                          {model.name}
                        </div>
                        <div className="text-[10px] text-slate-400">{model.desc}</div>
                      </div>
                      {aiConfig.model === model.id && <Check size={18} className="text-purple-500" />}
                    </button>
                  ))}
                </div>
                {!['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'deepseek-chat', 'claude-3-sonnet'].includes(aiConfig.model) && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                      placeholder="输入自定义模型名称，例如: qwen-turbo, llama2-70b 等"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">API Key</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="password"
                    value={aiConfig.apiKey}
                    onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-purple-500 transition-all"
                    placeholder="请输入您的 API Key"
                  />
                </div>
                <p className="text-[10px] text-slate-400 ml-2">
                  * API Key 将仅保存在本地浏览器中
                </p>
              </div>

              <button
                onClick={handleSaveAIConfig}
                disabled={saveStatus !== 'idle'}
                className={cn(
                  'w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
                  saveStatus === 'success'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-purple-600 text-white shadow-lg shadow-purple-100 hover:scale-[1.02] active:scale-95',
                )}
              >
                {saveStatus === 'saving' ? (
                  <RotateCw size={18} className="animate-spin" />
                ) : saveStatus === 'success' ? (
                  <>
                    <Check size={18} />
                    配置已保存
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存 AI 配置
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100">
            <h4 className="text-orange-800 font-bold text-sm mb-2 flex items-center gap-2">
              <Bell size={16} />
              管理提示
            </h4>
            <ul className="text-xs text-orange-700 space-y-2 opacity-80">
              <li>• 新增用户后，他们可以使用设置的密码登录。</li>
              <li>• AI 模型配置将影响全站的对话与辅导功能。</li>
              <li>• 默认管理员账号 (admin) 无法在此处删除。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
