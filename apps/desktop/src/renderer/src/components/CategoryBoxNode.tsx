import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { NodeProps } from 'reactflow';
import './CategoryBoxNode.css';

interface CategoryBoxData {
  label: string;
  width: number;
  height: number;
}

/**
 * 그래프의 카테고리 "박스". 같은 카테고리 노트 노드들을 시각적으로 감싸는 배경 사각형.
 * 노트 노드 뒤에 깔리며(zIndex 낮음), 클릭/드래그를 가로채지 않도록 pointer-events는 없다
 * (카테고리 이동 판정은 GraphPage가 드래그 종료 시 좌표로 직접 히트테스트한다).
 */
function CategoryBoxNode({ data }: NodeProps<CategoryBoxData>) {
  return (
    <div
      className="category-box"
      style={{ width: data.width, height: data.height } as CSSProperties}
    >
      <span className="category-box-label">{data.label}</span>
    </div>
  );
}

export default memo(CategoryBoxNode);
