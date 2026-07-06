import { useCallback } from 'react';
import { useStore, getStraightPath, BaseEdge } from 'reactflow';
import type { EdgeProps, ReactFlowState } from 'reactflow';
import { getCircleEdgeParams, type Circle } from '../utils/floating-edge';

// 원형 노드 사이를 잇는 floating 엣지.
// 고정된 top/bottom 핸들 위치가 아니라 두 원의 중심을 잇는 직선의 경계점에서 그려,
// 노드가 어느 방향에 있든 방사형으로 자연스럽게 연결된다.
function FloatingEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useStore(
    useCallback((store: ReactFlowState) => store.nodeInternals.get(source), [source]),
  );
  const targetNode = useStore(
    useCallback((store: ReactFlowState) => store.nodeInternals.get(target), [target]),
  );

  if (!sourceNode || !targetNode) {
    return null;
  }

  // reactflow 노드에서 원(중심+반지름)을 구한다.
  const toCircle = (node: NonNullable<typeof sourceNode>): Circle => {
    const w = node.width ?? 48;
    const h = node.height ?? 48;
    const x = (node.positionAbsolute?.x ?? node.position.x) + w / 2;
    const y = (node.positionAbsolute?.y ?? node.position.y) + h / 2;
    return { x, y, r: Math.min(w, h) / 2 };
  };

  const { sx, sy, tx, ty } = getCircleEdgeParams(toCircle(sourceNode), toCircle(targetNode));
  const [path] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  // BaseEdge는 보이는 선 + 넓은 투명 클릭 영역(interactionWidth)을 함께 렌더해
  // 얇은 관계선도 클릭(끊기)하기 쉽게 한다.
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={28} />;
}

export default FloatingEdge;
