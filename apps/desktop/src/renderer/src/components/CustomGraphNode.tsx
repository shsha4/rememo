import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import './CustomGraphNode.css';

interface CustomNodeData {
  label: string;
  depth: number;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isDimmed?: boolean;
}

function CustomGraphNode({ data }: NodeProps<CustomNodeData>) {
  const depth = data.depth || 0;
  const isHighlighted = data.isHighlighted || false;
  const isSelected = data.isSelected || false;
  const isDimmed = data.isDimmed || false;

  // Generate color based on depth
  const getDepthColor = (d: number) => {
    const colors = [
      'var(--depth-0)',  // Root nodes
      'var(--depth-1)',  // Level 1
      'var(--depth-2)',  // Level 2
      'var(--depth-3)',  // Level 3
      'var(--depth-4)',  // Level 4+
    ];
    return colors[Math.min(d, colors.length - 1)];
  };

  const className = [
    'custom-graph-node',
    isSelected && 'selected',
    isHighlighted && 'highlighted',
    isDimmed && 'dimmed',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      style={{
        '--node-color': getDepthColor(depth),
        '--node-depth': depth,
      } as any}
    >
      <Handle type="source" position={Position.Top} className="node-handle" />

      <div className="node-content">
        <div className="node-depth-indicator">{depth}</div>
        <div className="node-label">{data.label}</div>
      </div>

      <Handle type="target" position={Position.Bottom} className="node-handle" />
    </div>
  );
}

export default memo(CustomGraphNode);
