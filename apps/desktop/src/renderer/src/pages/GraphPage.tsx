import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeMouseHandler,
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
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  });

  // Find root nodes (nodes with no incoming edges)
  const incomingCount = new Map<string, number>();
  edges.forEach((edge) => {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  });

  const roots = nodes.filter((node) => !incomingCount.has(node.id));

  // BFS to assign depths
  const queue: Array<{ id: string; depth: number }> = roots.map((node) => ({
    id: node.id,
    depth: 0,
  }));

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (!depths.has(id)) {
      depths.set(id, depth);

      const children = adjacency.get(id) || [];
      children.forEach((childId) => {
        queue.push({ id: childId, depth: depth + 1 });
      });
    }
  }

  // Assign depth 0 to any remaining nodes
  nodes.forEach((node) => {
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
    ranksep: 100, // Vertical spacing between ranks
    nodesep: 80, // Horizontal spacing between nodes
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
  const { setCurrentNote, notes, graphRefreshTrigger } = useNoteStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Reload graph when graphRefreshTrigger changes (after note content update)
  useEffect(() => {
    if (currentVault && graphRefreshTrigger > 0) {
      loadGraphData();
    }
  }, [graphRefreshTrigger]);

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
      flowNodes.forEach((node) => {
        node.data.depth = depths.get(node.id) || 0;
      });

      // Apply hierarchical layout using dagre
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges,
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (error) {
      console.error('Failed to load graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 전체 재색인: 인덱스를 깨끗이 재빌드해 고아/중복 노드를 정리하고 그래프를 새로고침한다.
  const handleReindex = async () => {
    if (!currentVault || reindexing) return;
    setReindexing(true);
    try {
      await electronAPI.indexer.indexVault(currentVault.path, currentVault.id);
      await loadGraphData();
    } catch (error) {
      console.error('Failed to reindex vault:', error);
      alert('재색인에 실패했습니다');
    } finally {
      setReindexing(false);
    }
  };

  // Highlight connected nodes and edges
  const highlightedElements = useMemo(() => {
    if (!selectedNode) {
      return { nodes: new Set<string>(), edges: new Set<string>() };
    }

    const connectedNodes = new Set<string>([selectedNode]);
    const connectedEdges = new Set<string>();

    edges.forEach((edge) => {
      if (edge.source === selectedNode || edge.target === selectedNode) {
        connectedEdges.add(edge.id);
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
    });

    return { nodes: connectedNodes, edges: connectedEdges };
  }, [selectedNode, edges]);

  // Apply highlighting to nodes and edges
  const displayNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isHighlighted: highlightedElements.nodes.has(node.id),
        isSelected: node.id === selectedNode,
        isDimmed: selectedNode !== null && !highlightedElements.nodes.has(node.id),
      },
    }));
  }, [nodes, highlightedElements, selectedNode]);

  const displayEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      animated: highlightedElements.edges.has(edge.id),
      style: {
        ...edge.style,
        opacity: selectedNode === null || highlightedElements.edges.has(edge.id) ? 1 : 0.2,
        strokeWidth: highlightedElements.edges.has(edge.id) ? 3 : 2,
      },
    }));
  }, [edges, highlightedElements, selectedNode]);

  // Filter nodes by search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return displayNodes;
    }

    const query = searchQuery.toLowerCase();
    return displayNodes.filter((node) => node.data.label.toLowerCase().includes(query));
  }, [displayNodes, searchQuery]);

  const filteredEdges = useMemo(() => {
    if (!searchQuery.trim()) {
      return displayEdges;
    }

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return displayEdges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );
  }, [displayEdges, filteredNodes, searchQuery]);

  const onNodeClick = useCallback(
    async (_event: any, node: Node) => {
      if (!currentVault) return;

      // Toggle selection
      setSelectedNode((prev) => (prev === node.id ? null : node.id));

      try {
        // node.id is the note path
        const note = await electronAPI.note.read(node.id, currentVault.id);
        setCurrentNote(note);
        onNavigateToEditor();
      } catch (error) {
        console.error('Failed to load note:', error);
        alert('Failed to load note');
      }
    },
    [currentVault, setCurrentNote, onNavigateToEditor],
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="graph-page">
      <div className="graph-header">
        <h2>지식 그래프</h2>
        <input
          type="text"
          className="graph-search"
          placeholder="노트 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className="graph-reindex-btn"
          onClick={handleReindex}
          disabled={reindexing}
          title="그래프가 실제 노트와 다르게 보일 때 눌러 다시 정리해요"
        >
          <span className={`reindex-icon ${reindexing ? 'spinning' : ''}`}>⟳</span>
          {reindexing ? '정리 중...' : '새로고침'}
        </button>
      </div>

      {loading ? (
        <div className="graph-loading">그래프 불러오는 중...</div>
      ) : (
        <div className="graph-container">
          <ReactFlow
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            nodesDraggable={true}
            fitView
            minZoom={0.1}
            maxZoom={4}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="var(--border-primary)"
            />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const customData = node.data as any;
                if (customData.isSelected) return 'var(--accent-primary)';
                if (customData.isHighlighted) return 'var(--accent-secondary)';
                if (customData.isDimmed) return 'rgba(255, 255, 255, 0.2)';
                return 'var(--text-secondary)';
              }}
              maskColor="rgba(0, 0, 0, 0.6)"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}

export default GraphPage;
