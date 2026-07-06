import { Notification } from 'electron';
import path from 'path';
import { toggleTodoLine, setDueDateOnLine } from '@memograph/core';
import type { NotificationSettings } from '@memograph/core';
import { databaseService } from './database.service';
import { noteService } from './note.service';
import { indexerService } from './indexer.service';
import { vaultService } from './vault.service';

/** 렌더러로 전달하는 할 일 항목 (DB row + 노트 제목) */
export interface TodoItem {
  notePath: string;
  noteTitle: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  hasTime: boolean;
  line: number;
}

// 설정이 없을 때 쓰는 기본 알림 설정 (마감일에 시각이 없으면 09:00에 알림)
const DEFAULT_SETTINGS: NotificationSettings = { enabled: true, defaultTime: '09:00' };

// 알림 발송 여부를 점검하는 주기 (60초)
const CHECK_INTERVAL_MS = 60_000;

export class TodoService {
  // 알림 대상으로 등록된 볼트 경로들
  private activeVaults = new Set<string>();
  // 볼트별 알림 설정 캐시 (매 tick마다 파일을 읽지 않도록)
  private configs = new Map<string, NotificationSettings>();
  // 이번 세션에서 이미 알림을 보낸 할 일 키 (중복 알림 방지)
  private notified = new Set<string>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  getTodos(vaultPath: string): TodoItem[] {
    return databaseService.getAllTodos(vaultPath).map((todo) => ({
      ...todo,
      noteTitle: this.titleFromPath(todo.notePath),
    }));
  }

  /**
   * 지정한 노트의 특정 줄 체크박스를 토글하고 파일에 반영한 뒤 재인덱싱한다.
   * 반환: 토글 후의 완료 여부(체크박스가 아니면 null).
   */
  async toggleTodo(
    vaultPath: string,
    notePath: string,
    line: number,
    vaultId: string,
  ): Promise<boolean | null> {
    const note = await noteService.readNote(notePath, vaultId);
    const newContent = toggleTodoLine(note.content, line);

    // 변경이 없으면(체크박스가 아니거나 범위 밖) 파일을 건드리지 않는다.
    if (newContent === note.content) {
      return null;
    }

    await noteService.updateNote(notePath, vaultId, { content: newContent });
    await indexerService.reindexNote(notePath, vaultPath, vaultId);

    // 할 일 상태가 바뀌었으니 알림 예약을 갱신한다.
    this.rescheduleVault(vaultPath);

    // 토글 결과의 완료 여부를 다시 파싱해 확인
    const toggled = databaseService
      .getAllTodos(vaultPath)
      .find((t) => t.notePath === notePath && t.line === line);
    return toggled ? toggled.completed : null;
  }

  /**
   * 지정한 노트 줄의 할 일 마감일을 설정/변경/삭제하고 파일에 반영한 뒤 재인덱싱한다.
   * @param dueDate 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm', 삭제는 null.
   */
  async setDueDate(
    vaultPath: string,
    notePath: string,
    line: number,
    dueDate: string | null,
    vaultId: string,
  ): Promise<void> {
    const note = await noteService.readNote(notePath, vaultId);
    const newContent = setDueDateOnLine(note.content, line, dueDate);

    // 변경이 없으면(체크박스가 아니거나 범위 밖) 파일을 건드리지 않는다.
    if (newContent === note.content) {
      return;
    }

    await noteService.updateNote(notePath, vaultId, { content: newContent });
    await indexerService.reindexNote(notePath, vaultPath, vaultId);

    // 마감일이 바뀌었으니 알림 예약을 갱신한다.
    this.rescheduleVault(vaultPath);
  }

  // --- 알림 스케줄러 ---

  /** 볼트를 알림 대상으로 등록하고 즉시 한 번 점검한다(앱/볼트 열 때 오늘 마감분 확인). */
  async registerVault(vaultPath: string): Promise<void> {
    this.activeVaults.add(vaultPath);
    await this.loadSettings(vaultPath);
    this.ensureInterval();
    this.checkVault(vaultPath);
  }

  unregisterVault(vaultPath: string): void {
    this.activeVaults.delete(vaultPath);
    this.configs.delete(vaultPath);
    if (this.activeVaults.size === 0) {
      this.stopInterval();
    }
  }

  stopAll(): void {
    this.activeVaults.clear();
    this.configs.clear();
    this.notified.clear();
    this.stopInterval();
  }

  /** 알림 설정을 vault.json에 저장하고 캐시를 갱신한 뒤 즉시 재점검한다. */
  async updateSettings(vaultPath: string, settings: NotificationSettings): Promise<void> {
    await vaultService.updateVaultConfig(vaultPath, { notifications: settings });
    this.configs.set(vaultPath, { ...DEFAULT_SETTINGS, ...settings });
    this.checkVault(vaultPath);
  }

  /** vault.json에서 알림 설정을 읽어 캐시에 채운다. 실패 시 기본값. */
  private async loadSettings(vaultPath: string): Promise<void> {
    try {
      const vault = await vaultService.openVault(vaultPath);
      this.configs.set(vaultPath, { ...DEFAULT_SETTINGS, ...(vault.config.notifications ?? {}) });
    } catch {
      this.configs.set(vaultPath, { ...DEFAULT_SETTINGS });
    }
  }

  private rescheduleVault(vaultPath: string): void {
    // 토글로 사라진/추가된 항목의 키가 남아 재알림되지 않도록 이 볼트 키를 정리한다.
    for (const key of [...this.notified]) {
      if (key.startsWith(`${vaultPath}::`)) {
        this.notified.delete(key);
      }
    }
    this.checkVault(vaultPath);
  }

  private ensureInterval(): void {
    if (this.intervalHandle) {
      return;
    }
    this.intervalHandle = setInterval(() => {
      for (const vaultPath of this.activeVaults) {
        // 한 볼트의 점검 실패가 타이머 콜백 전체(그리고 main 프로세스)로 번지지 않게 한다.
        try {
          this.checkVault(vaultPath);
        } catch (error) {
          console.error('[TodoService] checkVault failed:', error);
        }
      }
    }, CHECK_INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /** 오늘 마감이면서 알림 시각이 도달한 미완료·미알림 할 일을 찾아 알림을 보낸다. */
  private checkVault(vaultPath: string): void {
    if (!Notification.isSupported()) {
      return;
    }

    const settings = this.configs.get(vaultPath) ?? DEFAULT_SETTINGS;
    if (!settings.enabled) {
      return;
    }

    const now = Date.now();
    // 오늘 0시. 이보다 이전의 알림 시각(=지나간 과거 마감)은 알리지 않는다.
    // "마감일 당일의 알림 시각"에만 발송하고, 지난 마감을 계속 알리지 않기 위함.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const due: TodoItem[] = [];

    for (const todo of this.getTodos(vaultPath)) {
      if (todo.completed || !todo.dueDate) {
        continue;
      }
      const notifyAt = this.computeNotifyAt(todo.dueDate, todo.hasTime, settings.defaultTime);
      // 알림 시각이 아직 안 됐거나(미래), 오늘 이전(지나간 마감)이면 발송하지 않는다.
      if (
        notifyAt === null ||
        notifyAt.getTime() > now ||
        notifyAt.getTime() < startOfToday.getTime()
      ) {
        continue;
      }
      const key = `${vaultPath}::${todo.notePath}::${todo.line}::${todo.dueDate}`;
      if (this.notified.has(key)) {
        continue;
      }
      this.notified.add(key);
      due.push(todo);
    }

    if (due.length === 0) {
      return;
    }

    if (due.length === 1) {
      this.notify('오늘 마감인 할 일', due[0].text);
    } else {
      this.notify('오늘 마감인 할 일', `오늘 마감인 할 일이 ${due.length}개 있어요.`);
    }
  }

  /** 마감일 문자열을 알림 발송 시각(Date)으로 변환한다. 시각이 없으면 설정의 기본 시각을 쓴다. */
  private computeNotifyAt(dueDate: string, hasTime: boolean, defaultTime: string): Date | null {
    const [datePart, timePart] = dueDate.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }

    if (hasTime && timePart) {
      const [hour, minute] = timePart.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute);
    }
    const [dh, dm] = this.parseDefaultTime(defaultTime);
    return new Date(year, month - 1, day, dh, dm);
  }

  /** 'HH:mm' 기본 시각을 [시, 분]으로 파싱한다. 형식이 이상하면 09:00으로 폴백. */
  private parseDefaultTime(defaultTime: string): [number, number] {
    const [hour, minute] = defaultTime.split(':').map(Number);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return [hour, minute];
    }
    return [9, 0];
  }

  private notify(title: string, body: string): void {
    try {
      new Notification({ title, body }).show();
    } catch (error) {
      console.error('[TodoService] Failed to show notification:', error);
    }
  }

  private titleFromPath(notePath: string): string {
    return path.basename(notePath, '.md');
  }
}

export const todoService = new TodoService();
