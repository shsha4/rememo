import { memo } from 'react';
import type { CSSProperties } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import './CustomGraphNode.css';

interface CustomNodeData {
  label: string;
  depth: number;
  // 노드 색(카테고리+깊이 반영). GraphPage에서 계산해 주입한다. 없으면 depth 팔레트로 폴백.
  color?: string;
  // 원 지름(px). 연결 수(degree)에 비례해 커진다.
  size?: number;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isDimmed?: boolean;
  isSearchMatch?: boolean;
  // 다른 노드에서 연결을 드래그하는 중, 이 노드가 놓을 수 있는 대상임을 표시.
  isConnectTarget?: boolean;
}

// 깊이(연결 구조상 거리)별로 노드 색을 달리해 그래프를 색으로 구분한다.
const DEPTH_COLORS = [
  'var(--depth-0)',
  'var(--depth-1)',
  'var(--depth-2)',
  'var(--depth-3)',
  'var(--depth-4)',
];
const getDepthColor = (depth: number): string =>
  DEPTH_COLORS[Math.min(Math.max(depth, 0), DEPTH_COLORS.length - 1)];

function CustomGraphNode({ data }: NodeProps<CustomNodeData>) {
  const depth = data.depth || 0;
  const size = data.size || 48;
  const isHighlighted = data.isHighlighted || false;
  const isSelected = data.isSelected || false;
  const isDimmed = data.isDimmed || false;
  const isSearchMatch = data.isSearchMatch || false;
  const isConnectTarget = data.isConnectTarget || false;

  const className = [
    'custom-graph-node',
    isSelected && 'selected',
    isHighlighted && 'highlighted',
    isDimmed && 'dimmed',
    isSearchMatch && 'search-match',
    isConnectTarget && 'connect-target',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={
        {
          '--node-color': data.color ?? getDepthColor(depth),
          width: size,
          height: size,
          // 원이 클수록 글자도 살짝 키운다(가독성).
          fontSize: `${Math.max(10, Math.min(15, Math.round(size / 8)))}px`,
        } as CSSProperties
      }
    >
      {/*
        테두리 연결 핸들(상/우/하/좌). 몸통은 드래그로 이동, 이 핸들에서 드래그하면 연결.
        ConnectionMode.Loose와 함께라 어느 핸들에서 시작하든 그 노드가 source가 된다(방향 고정),
        어느 핸들에 놓아도 연결이 완성된다. 평소 숨어 있다가 hover 시 드러난다.
      */}
      <Handle id="t" type="source" position={Position.Top} className="node-handle" />
      <Handle id="r" type="source" position={Position.Right} className="node-handle" />
      <Handle id="b" type="source" position={Position.Bottom} className="node-handle" />
      <Handle id="l" type="source" position={Position.Left} className="node-handle" />
      <span className="node-label">{data.label}</span>
    </div>
  );
}

export default memo(CustomGraphNode);
