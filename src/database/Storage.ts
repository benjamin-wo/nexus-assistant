import { Database } from "bun:sqlite";
import pg from "pg";

export interface MediaAttachment {
  mimeType: string;
  data: string; // Base64 encoded string
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  subagent?: string;
  createdAt?: Date;
  media?: MediaAttachment[];
}

export interface Reminder {
  id?: number;
  chatId: string;
  message: string;
  dueAt: Date;
  sent: boolean;
}

export interface LogEntry {
  category: string;
  message: string;
  details?: string;
  durationMs?: number;
  isError: boolean;
}

export interface TaskEntry {
  taskId: string;
  chatId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  description: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface Expense {
  id?: number;
  chatId: string;
  amount: number;
  category: string;
  description: string;
  createdAt?: Date | string;
}

export interface ResearchNote {
  id?: number;
  chatId: string;
  title: string;
  content: string;
  createdAt?: Date;
}

export interface IStorage {
  initialize(): Promise<void>;
  saveMessage(chatId: string, message: Message): Promise<void>;
  getHistory(chatId: string, limit?: number): Promise<Message[]>;
  clearHistory(chatId: string): Promise<void>;
  createReminder(reminder: Reminder): Promise<number>;
  getPendingReminders(): Promise<Reminder[]>;
  markReminderSent(id: number): Promise<void>;
  logEvent(log: LogEntry): Promise<void>;
  createTask(task: TaskEntry): Promise<void>;
  updateTaskStatus(taskId: string, status: TaskEntry["status"]): Promise<void>;
  getTask(taskId: string): Promise<TaskEntry | null>;
  getActiveTasks(chatId?: string): Promise<TaskEntry[]>;
  createExpense(expense: Expense): Promise<number>;
  getExpenses(chatId: string): Promise<Expense[]>;
  deleteExpense(id: number, chatId: string): Promise<void>;
  createResearchNote(note: ResearchNote): Promise<number>;
  getResearchNotes(chatId: string): Promise<ResearchNote[]>;
  deleteResearchNote(id: number, chatId: string): Promise<void>;
  close(): Promise<void>;
}

export class StorageService implements IStorage {
  private pgPool: pg.Pool | null = null;
  private sqliteDb: Database | null = null;
  private isPostgres = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.trim() !== "") {
      this.pgPool = new pg.Pool({ connectionString: dbUrl });
      this.isPostgres = true;
    } else {
      this.sqliteDb = new Database("assistant.db");
      this.isPostgres = false;
    }
  }

  async initialize(): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      // PostgreSQL initialization
      const client = await this.pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            subagent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS reminders (
            id SERIAL PRIMARY KEY,
            chat_id TEXT NOT NULL,
            message TEXT NOT NULL,
            due_at TIMESTAMP NOT NULL,
            sent BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS logs (
            id SERIAL PRIMARY KEY,
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            duration_ms INTEGER,
            is_error BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS tasks (
            task_id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            status TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL,
            completed_at TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS expenses (
            id SERIAL PRIMARY KEY,
            chat_id TEXT NOT NULL,
            amount DOUBLE PRECISION NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS research_notes (
            id SERIAL PRIMARY KEY,
            chat_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } finally {
        client.release();
      }
    } else if (this.sqliteDb) {
      // SQLite initialization
      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          subagent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          message TEXT NOT NULL,
          due_at DATETIME NOT NULL,
          sent BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          duration_ms INTEGER,
          is_error BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          task_id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          status TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at DATETIME NOT NULL,
          completed_at DATETIME
        );
      `);

      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS research_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  }

  async saveMessage(chatId: string, message: Message): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query(
        "INSERT INTO conversations (chat_id, role, content, subagent) VALUES ($1, $2, $3, $4)",
        [chatId, message.role, message.content, message.subagent || null]
      );
    } else if (this.sqliteDb) {
      this.sqliteDb
        .prepare(
          "INSERT INTO conversations (chat_id, role, content, subagent) VALUES (?, ?, ?, ?)"
        )
        .run(chatId, message.role, message.content, message.subagent || null);
    }
  }

  async getHistory(chatId: string, limit = 50): Promise<Message[]> {
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "SELECT role, content, subagent, created_at FROM conversations WHERE chat_id = $1 ORDER BY id DESC LIMIT $2",
        [chatId, limit]
      );
      return res.rows
        .map((row: any) => ({
          role: row.role as Message["role"],
          content: row.content,
          subagent: row.subagent || undefined,
          createdAt: new Date(row.created_at),
        }))
        .reverse();
    } else if (this.sqliteDb) {
      const rows = this.sqliteDb
        .prepare(
          "SELECT role, content, subagent, created_at FROM conversations WHERE chat_id = ? ORDER BY id DESC LIMIT ?"
        )
        .all(chatId, limit) as any[];
      return rows
        .map((row) => ({
          role: row.role as Message["role"],
          content: row.content,
          subagent: row.subagent || undefined,
          createdAt: new Date(row.created_at),
        }))
        .reverse();
    }
    return [];
  }

  async clearHistory(chatId: string): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query("DELETE FROM conversations WHERE chat_id = $1", [chatId]);
    } else if (this.sqliteDb) {
      this.sqliteDb.prepare("DELETE FROM conversations WHERE chat_id = ?").run(chatId);
    }
  }

  async createReminder(reminder: Reminder): Promise<number> {
    const dueStr = reminder.dueAt.toISOString();
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "INSERT INTO reminders (chat_id, message, due_at, sent) VALUES ($1, $2, $3, $4) RETURNING id",
        [reminder.chatId, reminder.message, dueStr, reminder.sent ? 1 : 0]
      );
      return res.rows[0].id;
    } else if (this.sqliteDb) {
      const res = this.sqliteDb
        .prepare(
          "INSERT INTO reminders (chat_id, message, due_at, sent) VALUES (?, ?, ?, ?) RETURNING id"
        )
        .get(reminder.chatId, reminder.message, dueStr, reminder.sent ? 1 : 0) as any;
      return res.id;
    }
    return 0;
  }

  async getPendingReminders(): Promise<Reminder[]> {
    const nowStr = new Date().toISOString();
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "SELECT id, chat_id, message, due_at, sent FROM reminders WHERE sent = FALSE AND due_at <= $1",
        [nowStr]
      );
      return res.rows.map((row: any) => ({
        id: row.id,
        chatId: row.chat_id,
        message: row.message,
        dueAt: new Date(row.due_at),
        sent: row.sent,
      }));
    } else if (this.sqliteDb) {
      const rows = this.sqliteDb
        .prepare(
          "SELECT id, chat_id, message, due_at, sent FROM reminders WHERE sent = 0 AND due_at <= ?"
        )
        .all(nowStr) as any[];
      return rows.map((row) => ({
        id: row.id,
        chatId: row.chat_id,
        message: row.message,
        dueAt: new Date(row.due_at),
        sent: row.sent === 1 || row.sent === true,
      }));
    }
    return [];
  }

  async markReminderSent(id: number): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query("UPDATE reminders SET sent = TRUE WHERE id = $1", [id]);
    } else if (this.sqliteDb) {
      this.sqliteDb.prepare("UPDATE reminders SET sent = 1 WHERE id = ?").run(id);
    }
  }

  async logEvent(log: LogEntry): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query(
        "INSERT INTO logs (category, message, details, duration_ms, is_error) VALUES ($1, $2, $3, $4, $5)",
        [
          log.category,
          log.message,
          log.details || null,
          log.durationMs !== undefined ? log.durationMs : null,
          log.isError,
        ]
      );
    } else if (this.sqliteDb) {
      this.sqliteDb
        .prepare(
          "INSERT INTO logs (category, message, details, duration_ms, is_error) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          log.category,
          log.message,
          log.details || null,
          log.durationMs !== undefined ? log.durationMs : null,
          log.isError ? 1 : 0
        );
    }
  }

  async createTask(task: TaskEntry): Promise<void> {
    const createdStr = task.createdAt.toISOString();
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query(
        "INSERT INTO tasks (task_id, chat_id, status, description, created_at) VALUES ($1, $2, $3, $4, $5)",
        [task.taskId, task.chatId, task.status, task.description, createdStr]
      );
    } else if (this.sqliteDb) {
      this.sqliteDb
        .prepare(
          "INSERT INTO tasks (task_id, chat_id, status, description, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(task.taskId, task.chatId, task.status, task.description, createdStr);
    }
  }

  async updateTaskStatus(taskId: string, status: TaskEntry["status"]): Promise<void> {
    const completedStr =
      status === "completed" || status === "failed" || status === "cancelled"
        ? new Date().toISOString()
        : null;

    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query(
        "UPDATE tasks SET status = $1, completed_at = $2 WHERE task_id = $3",
        [status, completedStr, taskId]
      );
    } else if (this.sqliteDb) {
      this.sqliteDb
        .prepare("UPDATE tasks SET status = ?, completed_at = ? WHERE task_id = ?")
        .run(status, completedStr, taskId);
    }
  }

  async getTask(taskId: string): Promise<TaskEntry | null> {
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "SELECT task_id, chat_id, status, description, created_at, completed_at FROM tasks WHERE task_id = $1",
        [taskId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        taskId: row.task_id,
        chatId: row.chat_id,
        status: row.status as TaskEntry["status"],
        description: row.description,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      };
    } else if (this.sqliteDb) {
      const row = this.sqliteDb
        .prepare(
          "SELECT task_id, chat_id, status, description, created_at, completed_at FROM tasks WHERE task_id = ?"
        )
        .get(taskId) as any;
      if (!row) return null;
      return {
        taskId: row.task_id,
        chatId: row.chat_id,
        status: row.status as TaskEntry["status"],
        description: row.description,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      };
    }
    return null;
  }

  async getActiveTasks(chatId?: string): Promise<TaskEntry[]> {
    if (this.isPostgres && this.pgPool) {
      let query = "SELECT task_id, chat_id, status, description, created_at, completed_at FROM tasks WHERE status = 'running'";
      let params: any[] = [];
      if (chatId) {
        query += " AND chat_id = $1";
        params.push(chatId);
      }
      const res = await this.pgPool.query(query, params);
      return res.rows.map((row: any) => ({
        taskId: row.task_id,
        chatId: row.chat_id,
        status: row.status as TaskEntry["status"],
        description: row.description,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      }));
    } else if (this.sqliteDb) {
      let query = "SELECT task_id, chat_id, status, description, created_at, completed_at FROM tasks WHERE status = 'running'";
      let params: any[] = [];
      if (chatId) {
        query += " AND chat_id = ?";
        params.push(chatId);
      }
      const rows = this.sqliteDb.prepare(query).all(...params) as any[];
      return rows.map((row) => ({
        taskId: row.task_id,
        chatId: row.chat_id,
        status: row.status as TaskEntry["status"],
        description: row.description,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      }));
    }
    return [];
  }

  async createExpense(expense: Expense): Promise<number> {
    const createdStr = expense.createdAt 
      ? (expense.createdAt instanceof Date ? expense.createdAt.toISOString() : new Date(expense.createdAt).toISOString())
      : new Date().toISOString();

    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "INSERT INTO expenses (chat_id, amount, category, description, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [expense.chatId, expense.amount, expense.category, expense.description, createdStr]
      );
      return res.rows[0].id;
    } else if (this.sqliteDb) {
      const res = this.sqliteDb
        .prepare(
          "INSERT INTO expenses (chat_id, amount, category, description, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
        )
        .get(expense.chatId, expense.amount, expense.category, expense.description, createdStr) as any;
      return res.id;
    }
    return 0;
  }

  async getExpenses(chatId: string): Promise<Expense[]> {
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "SELECT id, chat_id, amount, category, description, created_at FROM expenses WHERE chat_id = $1 ORDER BY id DESC",
        [chatId]
      );
      return res.rows.map((row: any) => ({
        id: row.id,
        chatId: row.chat_id,
        amount: Number(row.amount),
        category: row.category,
        description: row.description,
        createdAt: new Date(row.created_at),
      }));
    } else if (this.sqliteDb) {
      const rows = this.sqliteDb
        .prepare(
          "SELECT id, chat_id, amount, category, description, created_at FROM expenses WHERE chat_id = ? ORDER BY id DESC"
        )
        .all(chatId) as any[];
      return rows.map((row) => ({
        id: row.id,
        chatId: row.chat_id,
        amount: Number(row.amount),
        category: row.category,
        description: row.description,
        createdAt: new Date(row.created_at),
      }));
    }
    return [];
  }

  async deleteExpense(id: number, chatId: string): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query("DELETE FROM expenses WHERE id = $1 AND chat_id = $2", [id, chatId]);
    } else if (this.sqliteDb) {
      this.sqliteDb
        .prepare("DELETE FROM expenses WHERE id = ? AND chat_id = ?")
        .run(id, chatId);
    }
  }

  async createResearchNote(note: ResearchNote): Promise<number> {
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "INSERT INTO research_notes (chat_id, title, content) VALUES ($1, $2, $3) RETURNING id",
        [note.chatId, note.title, note.content]
      );
      return res.rows[0].id;
    } else if (this.sqliteDb) {
      const res = this.sqliteDb
        .prepare(
          "INSERT INTO research_notes (chat_id, title, content) VALUES (?, ?, ?) RETURNING id"
        )
        .get(note.chatId, note.title, note.content) as any;
      return res.id;
    }
    return 0;
  }

  async getResearchNotes(chatId: string): Promise<ResearchNote[]> {
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(
        "SELECT id, chat_id, title, content, created_at FROM research_notes WHERE chat_id = $1 ORDER BY id DESC",
        [chatId]
      );
      return res.rows.map((row: any) => ({
        id: row.id,
        chatId: row.chat_id,
        title: row.title,
        content: row.content,
        createdAt: new Date(row.created_at),
      }));
    } else if (this.sqliteDb) {
      const rows = this.sqliteDb
        .prepare(
          "SELECT id, chat_id, title, content, created_at FROM research_notes WHERE chat_id = ? ORDER BY id DESC"
        )
        .all(chatId) as any[];
      return rows.map((row) => ({
        id: row.id,
        chatId: row.chat_id,
        title: row.title,
        content: row.content,
        createdAt: new Date(row.created_at),
      }));
    }
    return [];
  }

  async deleteResearchNote(id: number, chatId: string): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query("DELETE FROM research_notes WHERE id = $1 AND chat_id = $2", [id, chatId]);
    } else if (this.sqliteDb) {
      this.sqliteDb
        .prepare("DELETE FROM research_notes WHERE id = ? AND chat_id = ?")
        .run(id, chatId);
    }
  }

  async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
    }
    if (this.sqliteDb) {
      this.sqliteDb.close();
    }
  }
}
