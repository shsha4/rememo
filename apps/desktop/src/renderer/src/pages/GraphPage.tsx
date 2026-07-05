import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import CustomGraphNode from '../components/CustomGraphNode';
import './GraphPage.css';

interface GraphData {
  nodes: Array<{ path: string; title: string }>;
  edges: Array<{ source: string; target: string }>;
}

const nodeWidth = 180;
const nodeHeight = 80;

const nodeTypes = {
  custom: CustomGraphNode,
};

// Calculate node depth using BFS
const calculateNodeDepths = (nodes: Node[], edges: Edge[]): Map<string, number> => {
  const depths = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Build adjacency list
  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  });

  // Find root nodes (nodes with no incoming edges)
  const incomingCount = new Map<string, number>();
  edges.forEach(edge => {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  });

  const roots = nodes.filter(node => !incomingCount.has(node.id));

  // BFS to assign depths
  const queue: Array<{ id: string; depth: number }> = roots.map(node => ({ id: node.id, depth: 0 }));

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (!depths.has(id)) {
      depths.set(id, depth);

      const children = adjacency.get(id) || [];
      children.forEach(childId => {
        queue.push({ id: childId, depth: depth + 1 });
      });
    }
  }

  // Assign depth 0 to any remaining nodes
  nodes.forEach(node => {
    if (!depths.has(node.id)) {
      depths.set(node.id, 0);
    }
  });

  return depths;
};

// Dagre layout function for hierarchical graph
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure dagre layout
  dagreGraph.setGraph({
    rankdir: 'BT', // Bottom to Top (root nodes at top)
    ranksep: 100,   // Vertical spacing between ranks
    nodesep: 80,    // Horizontal spacing between nodes
    edgesep: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface GraphPageProps {
  onNavigateToEditor: () => void;
}

function GraphPage({ onNavigateToEditor }: GraphPageProps) {
  const { currentVault } = useVaultStore();
  const { setCurrentNote, notes } = useNoteStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);

  // Load graph data when component mounts or vault changes
  useEffect(() => {
    if (currentVault) {
      loadGraphData();
    }
  }, [currentVault]);

  // Reload graph when notes change (real-time update)
  useEffect(() => {
    if (currentVault) {
      loadGraphData();
    }
  }, [notes]);

  const loadGraphData = async () => {
    if (!currentVault) return;

    setLoading(true);
    try {
      const data: GraphData = await electronAPI.indexer.getGraphData(currentVault.path);

      // Transform data into React Flow format (without positions initially)
      const flowNodes: Node[] = data.nodes.map((node) => ({
        id: node.path,
        type: 'custom',
        data: { label: node.title, depth: 0 },
        position: { x: 0, y: 0 }, // Will be calculated by dagre
      }));

      const flowEdges: Edge[] = data.edges.map((edge, index) => ({
        id: `e-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: 'var(--accent-primary)',
          strokeWidth: 2,
        },
      }));

      // Calculate node depths
      const depths = calculateNodeDepths(flowNodes, flowEdges);

      // Apply depth to node data
      flowNodes.forEach(node => {
        node.data.depth = depths.get(node.id) || 0;
      });

      // Apply hierarchical layout using dagre
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (error) {
      console.error('Failed to load graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onNodeClick = useCallback(async (_event: any, node: Node) => {
    if (!currentVault) return;

    try {
      // node.id is the note path
      const note = await electronAPI.note.read(node.id, currentVault.id);
      setCurrentNote(note);
      onNavigateToEditor();
    } catch (error) {
      console.error('Failed to load note:', error);
      alert('Failed to load note');
    }
  }, [currentVault, setCurrentNote, onNavigateToEditor]);

  return (
    <div className="graph-page">
      <div className="graph-header">
        <h2>지식 그래프</h2>
      </div>

      {loading ? (
        <div className="graph-loading">그래프 불러오는 중...</div>
      ) : (
        <div className="graph-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--border-primary)" />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}

export default GraphPage;
