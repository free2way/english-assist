import express from 'express';
import {
  changePassword,
  cleanupExpiredSessions,
  createSessionForCredentials,
  createUser,
  deleteSession,
  deleteUser,
  getUserByToken,
  getTextbookContent,
  importAllTextbookSamples,
  importTextbookSample,
  listUsers,
  listTextbookSamples,
  listTextbooks,
  type AuthUser,
} from './db';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json());

const getBearerToken = (header?: string) => {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  cleanupExpiredSessions();
  const token = getBearerToken(req.header('authorization'));
  if (!token) {
    res.status(401).json({ error: '未登录' });
    return;
  }

  const user = getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: '登录已失效，请重新登录' });
    return;
  }

  (req as express.Request & { user: AuthUser; token: string }).user = user;
  (req as express.Request & { user: AuthUser; token: string }).token = token;
  next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as express.Request & { user: AuthUser }).user;
  if (user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const sessionHours = typeof req.body?.sessionHours === 'number' ? req.body.sessionHours : undefined;

  if (!username.trim() || !password.trim()) {
    res.status(400).json({ error: '请输入用户名和密码' });
    return;
  }

  const session = createSessionForCredentials(username, password, sessionHours);
  if (!session) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  res.json(session);
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: (req as express.Request & { user: AuthUser }).user });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  deleteSession((req as express.Request & { token: string }).token);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const sessionHours = typeof req.body?.sessionHours === 'number' ? req.body.sessionHours : undefined;
  const user = (req as express.Request & { user: AuthUser }).user;

  if (!currentPassword.trim() || !newPassword.trim()) {
    res.status(400).json({ error: '请输入当前密码和新密码' });
    return;
  }

  try {
    const session = changePassword(user.id, currentPassword, newPassword, sessionHours);
    res.json(session);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '修改密码失败',
    });
  }
});

app.get('/api/users', requireAuth, requireAdmin, (_req, res) => {
  res.json({ users: listUsers() });
});

app.get('/api/textbooks', requireAuth, (_req, res) => {
  res.json({ textbooks: listTextbooks() });
});

app.get('/api/textbooks/:id', requireAuth, (req, res) => {
  const textbook = getTextbookContent(req.params.id);
  if (!textbook) {
    res.status(404).json({ error: '教材不存在' });
    return;
  }
  res.json({ textbook });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const grade = typeof req.body?.grade === 'string' ? req.body.grade : '';
  const semester = typeof req.body?.semester === 'string' ? req.body.semester : '';
  const school = typeof req.body?.school === 'string' ? req.body.school : '';

  if (!username.trim() || !password.trim()) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  try {
    const user = createUser({ username, password, grade, semester, school });
    res.status(201).json({ user });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '创建用户失败',
    });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const ok = deleteUser(req.params.id);
  if (!ok) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/admin/textbook-samples', requireAuth, requireAdmin, (_req, res) => {
  res.json({ samples: listTextbookSamples() });
});

app.post('/api/admin/textbooks/import-sample', requireAuth, requireAdmin, (req, res) => {
  const sampleId = typeof req.body?.sampleId === 'string' ? req.body.sampleId : '';
  if (!sampleId.trim()) {
    res.status(400).json({ error: '缺少教材样板标识' });
    return;
  }

  try {
    const textbook = importTextbookSample(sampleId);
    res.status(201).json({ textbook });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '导入教材失败',
    });
  }
});

app.post('/api/admin/textbooks/import-all-samples', requireAuth, requireAdmin, (_req, res) => {
  try {
    const textbooks = importAllTextbookSamples();
    res.status(201).json({ textbooks });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '批量导入教材失败',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth API listening on http://localhost:${PORT}`);
});
