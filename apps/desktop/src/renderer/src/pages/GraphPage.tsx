import { useState, useEffect, useCallback } from 'react';
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
import './GraphPage.css';

interface GraphData {
  nodes: Array<{ path: string; title: string }>;
  edges: Array<{ source: string; target: string }>;
}

const nodeWidth = 180;
const nodeHeight = 60;

// Dagre layout function for hierarchical graph
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure dagre layout
  dagreGraph.setGraph({
    rankdir: 'TB', // Top to Bottom
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
  const { setCurrentNote } = useNoteStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);

  // Load graph data when component mounts or vault changes
  useEffect(() => {
    if (currentVault) {
      loadGraphData();
    }
  }, [currentVault]);

  // Reload graph data every time the component mounts (page becomes visible)
  useEffect(() => {
    if (currentVault) {
      loadGraphData();
    }
  }, []);

  const loadGraphData = async () => {
    if (!currentVault) return;

    setLoading(true);
    try {
      const data: GraphData = await electronAPI.indexer.getGraphData(currentVault.path);

      // Transform data into React Flow format (without positions initially)
      const flowNodes: Node[] = data.nodes.map((node) => ({
        id: node.path,
        type: 'default',
        data: { label: node.title },
        position: { x: 0, y: 0 }, // Will be calculated by dagre
        style: {
          background: '#569cd6',
          color: '#fff',
          border: '1px solid #3e3e3e',
          borderRadius: '4px',
          padding: '10px',
          fontSize: '14px',
          minWidth: nodeWidth,
          minHeight: nodeHeight,
        },
      }));

      const flowEdges: Edge[] = data.edges.map((edge, index) => ({
        id: `e-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: '#858585',
          strokeWidth: 2,
        },
      }));

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
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}

export default GraphPage;
