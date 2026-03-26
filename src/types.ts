export interface UserStats {
  studyTime: string;
  tasksCompleted: number;
  totalTasks: number;
  completionRate: number;
  points: number;
}

export interface Task {
  id: string;
  title: string;
  type: 'reading' | 'qa' | 'retelling' | 'dialogue' | 'dubbing';
  category: 'exam' | 'ai' | 'fun';
  status: 'pending' | 'completed' | 'ongoing';
  time: string;
  description: string;
  score?: number;
}

export interface DiagnosisData {
  phoneme: string;
  accuracy: number;
  frequency: number;
  suggestion: string;
}
