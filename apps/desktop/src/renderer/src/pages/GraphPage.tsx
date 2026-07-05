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
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import './GraphPage.css';

interface GraphData {
  nodes: Array<{ path: string; title: string }>;
  edges: Array<{ source: string; target: string }>;
}

function GraphPage() {
  const { currentVault } = useVaultStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentVault) {
      loadGraphData();
    }
  }, [currentVault]);

  const loadGraphData = async () => {
    if (!currentVault) return;

    setLoading(true);
    try {
      const data: GraphData = await electronAPI.indexer.getGraphData(currentVault.path);

      // Transform data into React Flow format
      const flowNodes: Node[] = data.nodes.map((node, index) => ({
        id: node.path,
        type: 'default',
        data: { label: node.title },
        position: {
          x: Math.random() * 800,
          y: Math.random() * 600,
        },
        style: {
          background: '#569cd6',
          color: '#fff',
          border: '1px solid #3e3e3e',
          borderRadius: '4px',
          padding: '10px',
          fontSize: '12px',
        },
      }));

      const flowEdges: Edge[] = data.edges.map((edge, index) => ({
        id: `e-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#858585',
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error('Failed to load graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onNodeClick = useCallback((_event: any, node: Node) => {
    console.log('Node clicked:', node.id);
    // TODO: Navigate to the note
  }, []);

  return (
    <div className="graph-page">
      <div className="graph-header">
        <h2>Knowledge Graph</h2>
        <button className="btn-refresh" onClick={loadGraphData}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="graph-loading">Loading graph...</div>
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
