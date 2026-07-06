export interface Todo {
  /** 체크박스 뒤의 할 일 텍스트 (체크 마커·마감일 토큰 제외) */
  text: string;
  /** 체크 여부 ([x]/[X] 이면 true) */
  completed: boolean;
  /**
   * 마감일. 없으면 undefined.
   * - 날짜만: `YYYY-MM-DD`
   * - 시간 포함: `YYYY-MM-DDTHH:mm`
   * (로컬 타임존 기준의 벽시계 값이며 타임존 표기는 붙이지 않는다.)
   */
  dueDate?: string;
  /** 마감일에 시각(HH:mm)이 포함됐는지 여부 */
  hasTime: boolean;
  /** 할 일이 위치한 노트 경로. 파서는 빈 문자열로 두고 서비스가 채운다. */
  notePath: string;
  /** 체크박스가 있는 줄 번호 (1-based). 토글 시 대상 줄 식별에 사용한다. */
  line: number;
  position?: TodoPosition;
}

export interface TodoPosition {
  start: number;
  end: number;
  line: number;
}
