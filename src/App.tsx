/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Mic2, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Bell, 
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Play,
  Clock,
  Star,
  Trophy,
  MessageSquare,
  Headphones,
  Zap,
  Check,
  X,
  RotateCw,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- Mock Data ---
const MOCK_TASKS = [
  { id: '1', title: '短文朗读：The Future of AI', type: 'reading', category: 'exam', status: 'completed', time: '19:00 - 19:30', description: '中考模拟题，重点练习连读与重音', score: 92 },
  { id: '2', title: 'AI 情景对话：School Life', type: 'dialogue', category: 'ai', status: 'ongoing', time: '19:30 - 20:00', description: '与 AI 外教讨论你的理想学校', score: 0 },
  { id: '3', title: '视频配音：Zootopia Clip', type: 'dubbing', category: 'fun', status: 'pending', time: '20:00 - 20:30', description: '模仿 Judy 的语气，练习情感表达', score: 0 },
  { id: '4', title: '听后转述：A Trip to London', type: 'retelling', category: 'exam', status: 'pending', time: '20:30 - 21:00', description: '高考模拟题，练习信息提取与整合', score: 0 },
];

const CHART_DATA = [
  { name: '11/16', tasks: 10, completed: 2 },
  { name: '11/17', tasks: 24, completed: 3 },
  { name: '11/18', tasks: 18, completed: 5 },
  { name: '11/19', tasks: 22, completed: 4 },
  { name: '11/20', tasks: 5, completed: 1 },
  { name: '11/21', tasks: 12, completed: 6 },
  { name: '11/22', tasks: 15, completed: 8 },
];

const PIE_DATA = [
  { name: '口语', value: 45, color: '#3b82f6' },
  { name: '听力', value: 30, color: '#8b5cf6' },
  { name: '词汇', value: 25, color: '#10b981' },
];

const FLTRP_VOCAB = [
  // 初二
  { id: 'v1', word: 'Literature', phonetic: '/ˈlɪtrətʃə(r)/', definition: '文学；文学作品', example: 'She is a student of English literature.', mastered: false, grade: '初二' },
  { id: 'v2', word: 'Culture', phonetic: '/ˈkʌltʃə(r)/', definition: '文化；文明', example: 'We should respect different cultures.', mastered: false, grade: '初二' },
  { id: 'v3', word: 'Achievement', phonetic: '/əˈtʃiːvmənt/', definition: '成就；成绩', example: 'It was a remarkable achievement.', mastered: false, grade: '初二' },
  { id: 'v4', word: 'Challenge', phonetic: '/ˈtʃælɪndʒ/', definition: '挑战；艰巨任务', example: 'He accepted the challenge with a smile.', mastered: false, grade: '初二' },
  { id: 'v5', word: 'Opportunity', phonetic: '/ˌɒpəˈtjuːnəti/', definition: '机会；时机', example: 'Don\'t miss this opportunity.', mastered: false, grade: '初二' },
  // 初一
  { id: 'v6', word: 'Pencil', phonetic: '/ˈpensl/', definition: '铅笔', example: 'Can I borrow your pencil?', mastered: false, grade: '初一' },
  { id: 'v7', word: 'Eraser', phonetic: '/ɪˈreɪzə(r)/', definition: '橡皮', example: 'I need an eraser.', mastered: false, grade: '初一' },
  { id: 'v8', word: 'Classroom', phonetic: '/ˈklɑːsruːm/', definition: '教室', example: 'The classroom is clean.', mastered: false, grade: '初一' },
  // 初三
  { id: 'v9', word: 'Environment', phonetic: '/ɪnˈvaɪrənmənt/', definition: '环境', example: 'We must protect the environment.', mastered: false, grade: '初三' },
  { id: 'v10', word: 'Pollution', phonetic: '/pəˈluːʃn/', definition: '污染', example: 'Air pollution is a serious problem.', mastered: false, grade: '初三' },
  // 高一
  { id: 'v11', word: 'Philosophy', phonetic: '/fəˈlɒsəfi/', definition: '哲学', example: 'He is studying Greek philosophy.', mastered: false, grade: '高一' },
  { id: 'v12', word: 'Psychology', phonetic: '/saɪˈkɒlədʒi/', definition: '心理学', example: 'She has a degree in psychology.', mastered: false, grade: '高一' },
];

const GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];

// --- Components ---

const StatCard = ({ label, value, icon: Icon, colorClass }: any) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[100px] flex-1">
    <span className="text-slate-400 text-xs mb-1">{label}</span>
    <div className={cn("text-xl font-bold mb-1", colorClass)}>{value}</div>
    {Icon && <Icon size={16} className="text-slate-300" />}
  </div>
);

const TaskCard = ({ task }: any) => {
  const isCompleted = task.status === 'completed';
  const isOngoing = task.status === 'ongoing';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all"
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        task.category === 'exam' ? "bg-blue-50 text-blue-500" : 
        task.category === 'ai' ? "bg-purple-50 text-purple-500" : "bg-emerald-50 text-emerald-500"
      )}>
        {task.type === 'reading' && <Mic2 size={24} />}
        {task.type === 'dialogue' && <MessageSquare size={24} />}
        {task.type === 'dubbing' && <Play size={24} />}
        {task.type === 'retelling' && <Headphones size={24} />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-slate-800 truncate">{task.title}</h3>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            isCompleted ? "bg-emerald-100 text-emerald-600" : 
            isOngoing ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
          )}>
            {isCompleted ? '已完成' : isOngoing ? '进行中' : '待开始'}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate mb-2">{task.description}</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><Clock size={12} /> {task.time}</span>
          {isCompleted && <span className="flex items-center gap-1 text-orange-500 font-bold"><Star size={12} fill="currentColor" /> {task.score} 分</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button className={cn(
          "px-4 py-2 rounded-full text-xs font-bold transition-all",
          isCompleted ? "bg-blue-500 text-white shadow-lg shadow-blue-200" : "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
        )}>
          {isCompleted ? '查看报告' : isOngoing ? '继续练习' : '开始任务'}
        </button>
      </div>
    </motion.div>
  );
};

// --- Views ---

const Dashboard = () => (
  <div className="space-y-6 pb-20">
    {/* Header Stats */}
    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
      <StatCard label="今日学习" value="1.5h" colorClass="text-blue-500" />
      <StatCard label="任务数量" value="2/5" colorClass="text-purple-500" />
      <StatCard label="完成率" value="40%" colorClass="text-emerald-500" />
      <StatCard label="积分成就" value="1280" icon={Trophy} colorClass="text-orange-500" />
    </div>

    {/* Calendar Section */}
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-blue-500" />
          <span className="font-bold text-slate-700">2026年3月第4周</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-full hover:bg-slate-50 text-slate-400"><ChevronLeft size={18} /></button>
          <button className="px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">今天</button>
          <button className="p-1.5 rounded-full hover:bg-slate-50 text-slate-400"><ChevronRight size={18} /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, i) => (
          <div key={day} className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-slate-400">{day}</span>
            <div className={cn(
              "w-10 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all",
              i === 3 ? "bg-blue-500 text-white shadow-lg shadow-blue-200" : "bg-slate-50 text-slate-600"
            )}>
              <span className="text-xs font-bold">3/{23 + i}</span>
              <div className={cn("w-1.5 h-1.5 rounded-full", i === 3 ? "bg-white" : "bg-emerald-400")} />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Task List */}
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <div className="w-1 h-5 bg-emerald-500 rounded-full" />
          我的学习计划
        </h2>
        <div className="flex gap-4 text-xs text-slate-400 font-medium">
          <button className="hover:text-blue-500">全部科目</button>
          <button className="hover:text-blue-500">完成优先</button>
        </div>
      </div>
      
      <div className="space-y-3">
        {MOCK_TASKS.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  </div>
);

const Statistics = () => (
  <div className="space-y-6 pb-20">
    <div className="flex gap-2 mb-4">
      <button className="px-4 py-1.5 rounded-full bg-blue-500 text-white text-xs font-bold">最近7天</button>
      <button className="px-4 py-1.5 rounded-full bg-white text-slate-500 text-xs font-bold border border-slate-100">最近30天</button>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">总任务数</div>
        <div className="text-xl font-bold text-blue-600">381</div>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">已完成</div>
        <div className="text-xl font-bold text-emerald-600">50</div>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">平均完成率</div>
        <div className="text-xl font-bold text-purple-600">13%</div>
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
        <div className="w-1 h-4 bg-blue-500 rounded-full" />
        每日任务完成情况
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              cursor={{ fill: '#f8fafc' }}
            />
            <Bar dataKey="tasks" fill="#bfdbfe" radius={[4, 4, 0, 0]} barSize={12} />
            <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <div className="w-1 h-4 bg-emerald-500 rounded-full" />
          分类时间占比
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={PIE_DATA}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {PIE_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {PIE_DATA.map(item => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] text-slate-500">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <div className="w-1 h-4 bg-purple-500 rounded-full" />
          弱项诊断报告
        </h3>
        <div className="space-y-4">
          {[
            { label: '/θ/ 咬舌音', value: 65, color: 'bg-red-400' },
            { label: '连读技巧', value: 42, color: 'bg-orange-400' },
            { label: '重音节奏', value: 88, color: 'bg-emerald-400' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-600 font-medium">{item.label}</span>
                <span className="text-slate-400">{item.value}% 掌握</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AITutor = () => (
  <div className="h-full flex flex-col pb-20">
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl blue-gradient flex items-center justify-center text-white shadow-lg shadow-blue-200">
          <Zap size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">AI 私人外教</h2>
          <p className="text-sm text-slate-500">正在讨论：School Life & Hobbies</p>
        </div>
      </div>
      
      <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">AI</div>
          <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none text-sm text-slate-700 max-w-[80%]">
            Hello! Today let's talk about your school life. What is your favorite subject and why?
          </div>
        </div>
        
        <div className="flex gap-3 flex-row-reverse">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">我</div>
          <div className="bg-blue-500 p-4 rounded-2xl rounded-tr-none text-sm text-white max-w-[80%] shadow-md shadow-blue-100">
            I like English very much because it is interesting.
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">AI</div>
          <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none text-sm text-slate-700 max-w-[80%]">
            That's great! English is a window to the world. Besides being "interesting", can you tell me more? For example, do you like the teacher or the stories in the books?
          </div>
        </div>
      </div>
    </div>

    {/* Scaffolding Tools */}
    <div className="grid grid-cols-3 gap-3 mb-6">
      <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <div className="text-[10px] text-slate-400 mb-1">关键词提示</div>
        <div className="text-xs font-bold text-blue-600">Literature, Culture</div>
      </button>
      <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <div className="text-[10px] text-slate-400 mb-1">句式模板</div>
        <div className="text-xs font-bold text-purple-600">Not only... but also</div>
      </button>
      <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <div className="text-[10px] text-slate-400 mb-1">参考范文</div>
        <div className="text-xs font-bold text-emerald-600">View Sample</div>
      </button>
    </div>

    {/* Input Area */}
    <div className="mt-auto flex items-center gap-4">
      <button className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
        <Headphones size={24} />
      </button>
      <button className="flex-1 h-14 rounded-full blue-gradient flex items-center justify-center gap-2 text-white font-bold shadow-xl shadow-blue-200 active:scale-95 transition-all">
        <Mic2 size={24} />
        按住说话
      </button>
      <button className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
        <Play size={24} />
      </button>
    </div>
  </div>
);

const VocabularyModule = () => {
  const [selectedGrade, setSelectedGrade] = useState('初二');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);

  const filteredVocab = FLTRP_VOCAB.filter(v => v.grade === selectedGrade);
  const currentWord = filteredVocab[currentIndex] || filteredVocab[0];

  const handleNext = (mastered: boolean) => {
    if (mastered) setMasteredCount(prev => prev + 1);
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredVocab.length);
    }, 150);
  };

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade);
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredCount(0);
  };

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">单词背记</h2>
          <p className="text-sm text-slate-500">外研社版 - {selectedGrade}</p>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
          {GRADES.map(grade => (
            <button
              key={grade}
              onClick={() => handleGradeChange(grade)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                selectedGrade === grade 
                  ? "bg-blue-500 text-white shadow-md shadow-blue-100" 
                  : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
              )}
            >
              {grade}
            </button>
          ))}
        </div>

        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold text-blue-600 shrink-0">
          已掌握: {masteredCount} / {filteredVocab.length}
        </div>
      </div>

      {/* Flashcard */}
      <div className="flex-1 flex flex-col items-center justify-center perspective-1000">
        {filteredVocab.length > 0 ? (
          <motion.div 
            key={`${selectedGrade}-${currentIndex}`}
            className="relative w-full max-w-sm aspect-[3/4] cursor-pointer preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-4xl font-black text-slate-800 mb-4 tracking-tight">{currentWord.word}</div>
              <div className="text-slate-400 font-mono mb-8">{currentWord.phonetic}</div>
              <button className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-all">
                <Volume2 size={24} />
              </button>
              <div className="mt-auto text-[10px] text-slate-300 flex items-center gap-1">
                <RotateCw size={10} /> 点击翻转查看释义
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden bg-blue-600 rounded-[2rem] shadow-xl text-white flex flex-col p-8 rotate-y-180">
              <div className="text-xl font-bold mb-2 opacity-60">{currentWord.word}</div>
              <div className="h-px w-full bg-white/20 mb-6" />
              <div className="text-2xl font-bold mb-4">{currentWord.definition}</div>
              <div className="text-sm opacity-80 italic leading-relaxed">
                "{currentWord.example}"
              </div>
              <div className="mt-auto flex justify-center">
                <button className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center">
                  <Volume2 size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="text-slate-400 text-center">
            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p>该年级暂无单词数据</p>
          </div>
        )}
      </div>

      {/* Controls */}
      {filteredVocab.length > 0 && (
        <div className="mt-8 flex justify-center gap-6">
          <button 
            onClick={() => handleNext(false)}
            className="w-16 h-16 rounded-full bg-white border border-slate-100 shadow-lg flex items-center justify-center text-red-500 hover:scale-110 active:scale-95 transition-all"
          >
            <X size={32} />
          </button>
          <button 
            onClick={() => handleNext(true)}
            className="w-16 h-16 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all"
          >
            <Check size={32} />
          </button>
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', label: '首页', icon: LayoutDashboard },
    { id: 'vocab', label: '单词', icon: BookOpen },
    { id: 'tutor', label: 'AI外教', icon: Mic2, primary: true },
    { id: 'stats', label: '统计', icon: BarChart3 },
    { id: 'profile', label: '我的', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg-main flex flex-col md:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-100 flex-col p-6 sticky top-0 h-screen">
        <div className="mb-10">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight">AceEnglish</h1>
          <p className="text-[10px] text-slate-400 mt-1">英语听说提分管家</p>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all",
                activeTab === item.id 
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-100" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <item.icon size={20} />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden">
              <img src="https://picsum.photos/seed/user/100/100" alt="Avatar" referrerPolicy="no-referrer" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Owen</p>
              <p className="text-[10px] text-slate-400">Level: Expert</p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-3/4" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Mobile & Desktop) */}
        <header className="p-6 flex items-center justify-between sticky top-0 bg-bg-main/80 backdrop-blur-md z-40">
          <div className="md:hidden">
            <h1 className="text-xl font-black text-blue-600 tracking-tight">AceEnglish</h1>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span>学习中心</span>
              <ChevronRight size={14} />
              <span className="text-slate-800 font-bold">
                {navItems.find(i => i.id === activeTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center bg-white border border-slate-100 rounded-full px-4 py-2 shadow-sm">
              <Search size={16} className="text-slate-400 mr-2" />
              <input type="text" placeholder="搜索课程或单词..." className="bg-transparent text-xs outline-none w-32 lg:w-48" />
            </div>
            <button className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400">
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 px-6 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'vocab' && <VocabularyModule />}
              {activeTab === 'tutor' && <AITutor />}
              {activeTab === 'stats' && <Statistics />}
              {(activeTab === 'exam' || activeTab === 'profile') && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                  <Mic2 size={64} className="mb-4 opacity-20" />
                  <p className="font-bold">{navItems.find(i => i.id === activeTab)?.label}模块开发中</p>
                  <p className="text-xs">即将上线，敬请期待</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50">
        {navItems.map((item) => (
          item.primary ? (
            <div key={item.id} className="relative -top-6">
              <button 
                onClick={() => setActiveTab(item.id)}
                className="w-14 h-14 rounded-full blue-gradient flex items-center justify-center text-white shadow-xl shadow-blue-200 active:scale-95 transition-all"
              >
                <item.icon size={28} />
              </button>
            </div>
          ) : (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn("flex flex-col items-center gap-1 transition-all", activeTab === item.id ? "text-blue-500" : "text-slate-400")}
            >
              <item.icon size={24} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          )
        ))}
      </nav>
    </div>
  );
}
