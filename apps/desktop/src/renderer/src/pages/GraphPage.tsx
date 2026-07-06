import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  NodeDragHandler,
  EdgeMouseHandler,
  Connection,
  ConnectionMode,
  MarkerType,
} from 'reactflow';
import type { OnConnectStart, OnConnectEnd, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import CustomGraphNode from '../components/CustomGraphNode';
import FloatingEdge from '../components/FloatingEdge';
import { computeGraphSearch } from '../utils/graph-search';
import { computeDegrees, degreeToDiameter } from '../utils/graph-degree';
import { getForceLayoutedElements } from '../utils/graph-layout';
import type { Note } from '../types';
import './GraphPage.css';

type EdgeLinkType = 'wiki_link' | 'entity_mention';

interface GraphData {
  nodes: Array<{ path: string; title: string }>;
  edges: Array<{ source: string; target: string; linkType: EdgeLinkType }>;
}

const nodeTypes = {
  custom: CustomGraphNode,
};

const edgeTypes = {
  floating: FloatingEdge,
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

// 포인터 위치 아래에 있는 노드의 id(=노트 경로)를 찾는다. 연결 드래그 종료 지점 판정에 쓴다.
const getNodeIdFromPoint = (event: MouseEvent | TouchEvent): string | null => {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event;
  if (!point) return null;
  const el = document.elementFromPoint(point.clientX, point.clientY);
  const nodeEl = el?.closest('.react-flow__node');
  return nodeEl?.getAttribute('data-id') ?? null;
};

interface GraphPageProps {
  onNavigateToEditor: () => void;
}

function GraphPage({ onNavigateToEditor }: GraphPageProps) {
  const { currentVault } = useVaultStore();
  const { currentNote, setCurrentNote, notes, graphRefreshTrigger } = useNoteStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // 검색 시 매칭 노드로부터 몇 단계 이웃까지 함께 노출할지(0=매칭만, 1~3=이웃 포함).
  const [searchHops, setSearchHops] = useState(1);
  // 연결 드래그 중인 시작 노드 id(없으면 null). 대상 노드 하이라이트 표시에 쓴다.
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);

  // 노드 중심 좌표 캐시(배치 안정화용). 새로고침 시 기존 노드를 제자리에 고정한다.
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // reactflow 인스턴스(최초 1회 화면 맞춤용).
  const rfRef = useRef<ReactFlowInstance | null>(null);
  // 노트 검색 인풋(재색인 후 포커스 복원용).
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 연결 드래그의 시작 노드와 실제 연결 성사 여부(클릭 vs 연결 구분용).
  const connectStartRef = useRef<string | null>(null);
  const didConnectRef = useRef(false);

  // 볼트가 바뀌면 이전 배치 좌표를 버린다(다른 그래프이므로).
  useEffect(() => {
    positionsRef.current = new Map();
  }, [currentVault]);

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
      const data: GraphData = await electronAPI.indexer.getGraphData({
        vaultPath: currentVault.path,
      });

      // 연결 수(degree)를 계산해 원 크기(지름)로 매핑한다. 연결 많을수록 큰 원.
      const degrees = computeDegrees(
        data.nodes.map((n) => n.path),
        data.edges,
      );
      const maxDegree = Math.max(0, ...degrees.values());

      // Transform data into React Flow format (without positions initially)
      const flowNodes: Node[] = data.nodes.map((node) => ({
        id: node.path,
        type: 'custom',
        data: {
          label: node.title,
          depth: 0,
          size: degreeToDiameter(degrees.get(node.path) ?? 0, maxDegree),
        },
        position: { x: 0, y: 0 }, // Will be calculated by force layout
      }));

      const flowEdges: Edge[] = data.edges.map((edge, index) => {
        // wiki_link: 사용자가 명시한 관계(실선, 그래프에서 삭제 가능)
        // entity_mention: 자동 감지된 관계(점선, 그래프에서 삭제 불가 — 본문 수정 필요)
        const isWikiLink = edge.linkType === 'wiki_link';
        return {
          id: `e-${index}`,
          source: edge.source,
          target: edge.target,
          type: 'floating',
          data: { linkType: edge.linkType },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent-primary)' },
          style: {
            stroke: 'var(--accent-primary)',
            strokeWidth: 1.5,
            strokeDasharray: isWikiLink ? undefined : '6 4',
          },
        };
      });

      // Calculate node depths (색상 결정용)
      const depths = calculateNodeDepths(flowNodes, flowEdges);

      // Apply depth to node data
      flowNodes.forEach((node) => {
        node.data.depth = depths.get(node.id) || 0;
      });

      // Apply organic force-directed layout.
      // 이전 배치 좌표(positionsRef)를 고정해, 새로고침 시 기존 노드는 제자리를 유지하고
      // 새 노드만 주변에 자리잡게 한다(배치가 매번 섞이는 문제 방지).
      const {
        nodes: layoutedNodes,
        edges: layoutedEdges,
        centers,
      } = getForceLayoutedElements(flowNodes, flowEdges, positionsRef.current);
      positionsRef.current = centers;

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
      await electronAPI.indexer.indexVault({
        vaultPath: currentVault.path,
        vaultId: currentVault.id,
      });
      await loadGraphData();
    } catch (error) {
      console.error('Failed to reindex vault:', error);
      alert('재색인에 실패했습니다');
    } finally {
      setReindexing(false);
      // 새로고침 버튼이 disabled 되며 포커스가 body로 빠지므로, 재색인 후 검색 인풋으로 포커스를 되돌린다.
      // 버튼 재활성화 리렌더 뒤에 실행되도록 rAF로 미룬다.
      requestAnimationFrame(() => searchInputRef.current?.focus());
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
        // 연결 드래그 중이면 시작 노드를 제외한 나머지를 "놓을 수 있는 대상"으로 표시.
        isConnectTarget: connectingNodeId !== null && node.id !== connectingNodeId,
      },
    }));
  }, [nodes, highlightedElements, selectedNode, connectingNodeId]);

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

  // 검색 결과 계산: 매칭 노드 + hops 이내 이웃까지 visible로 노출한다.
  const searchResult = useMemo(
    () =>
      computeGraphSearch(
        nodes.map((n) => ({ id: n.id, label: n.data.label as string })),
        edges.map((e) => ({ source: e.source, target: e.target })),
        searchQuery,
        searchHops,
      ),
    [nodes, edges, searchQuery, searchHops],
  );

  // Filter nodes by search query (매칭 노드 + 이웃 노드까지 노출; 이웃은 흐리게 표시)
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return displayNodes;
    }

    return displayNodes
      .filter((node) => searchResult.visibleIds.has(node.id))
      .map((node) => {
        const isSearchMatch = searchResult.matchedIds.has(node.id);
        return {
          ...node,
          data: {
            ...node.data,
            isSearchMatch,
            // 매칭이 아닌 이웃 노드는 흐리게. hover 선택이 있으면 기존 dim 규칙을 우선 유지.
            isDimmed: node.data.isDimmed || !isSearchMatch,
          },
        };
      });
  }, [displayNodes, searchResult, searchQuery]);

  const filteredEdges = useMemo(() => {
    if (!searchQuery.trim()) {
      return displayEdges;
    }

    return displayEdges.filter(
      (edge) =>
        searchResult.visibleIds.has(edge.source) && searchResult.visibleIds.has(edge.target),
    );
  }, [displayEdges, searchResult, searchQuery]);

  // 노드(=노트)를 열어 에디터로 이동한다. 원 전체를 덮는 연결 핸들 때문에 onNodeClick이
  // 안정적으로 발화하지 않으므로, 클릭 판정은 onConnectEnd에서 하고 여기서 실제 열기를 수행한다.
  const openNote = useCallback(
    async (nodeId: string) => {
      if (!currentVault) return;
      try {
        const note = await electronAPI.note.read({ notePath: nodeId, vaultId: currentVault.id });
        setCurrentNote(note);
        onNavigateToEditor();
      } catch (error) {
        console.error('Failed to load note:', error);
        alert('노트를 불러오지 못했습니다');
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

  // 사용자가 노드를 옮기면 새 중심 좌표를 캐시에 반영한다(다음 새로고침 때 옮긴 위치 유지).
  const onNodeDragStop: NodeDragHandler = useCallback((_event, node) => {
    const r = ((node.data?.size as number) ?? 48) / 2;
    positionsRef.current.set(node.id, { x: node.position.x + r, y: node.position.y + r });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // 대상 제목이 vault 안에서 유일하지 않으면(동명 노트) WikiLink가 title 기준으로 해석돼
  // 드래그한 노드와 다른 노트로 연결/삭제될 수 있다. 이 경우 오연결을 막기 위해 편집을 차단한다.
  const isTitleAmbiguous = useCallback(
    (title: string) => nodes.filter((n) => (n.data.label as string) === title).length > 1,
    [nodes],
  );

  // 그래프에서 링크를 편집한 노트가 현재 에디터에 열린 노트면, 갱신된 내용을 스토어에 반영한다.
  // (반영하지 않으면 에디터로 돌아가 저장할 때 옛 내용으로 덮어써 방금 만든/지운 링크가 사라진다.)
  const syncCurrentNote = (sourceNotePath: string, updatedNote: Note) => {
    if (currentNote?.path === sourceNotePath) {
      setCurrentNote(updatedNote);
    }
  };

  // 노드 A→B로 드래그하면 A 노트 본문에 [[B]] WikiLink를 추가해 관계를 만든다(파일에 즉시 반영).
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!currentVault) return;
      const { source, target } = connection;
      if (!source || !target || source === target) return;

      // 실제 연결 제스처(다른 노드로 드래그)임을 기록 → onConnectEnd에서 클릭으로 오인해 노트를 열지 않도록.
      didConnectRef.current = true;

      const targetTitle = (nodes.find((n) => n.id === target)?.data.label as string) ?? '';
      if (!targetTitle) return;

      if (isTitleAmbiguous(targetTitle)) {
        alert(
          `제목이 "${targetTitle}"인 노트가 여러 개예요. 동명 노트는 그래프에서 관계를 편집할 수 없어요.`,
        );
        return;
      }

      try {
        const updatedNote = await electronAPI.link.add({
          sourceNotePath: source,
          targetTitle,
          vaultId: currentVault.id,
          vaultPath: currentVault.path,
        });
        syncCurrentNote(source, updatedNote);
        await loadGraphData();
      } catch (error) {
        console.error('Failed to add link:', error);
        alert('관계 추가에 실패했습니다');
      }
    },
    [currentVault, nodes, currentNote, isTitleAmbiguous],
  );

  // 엣지를 클릭하면 관계를 끊는다. 자동 감지(entity_mention) 관계는 본문 수정이 필요하므로 막는다.
  const onEdgeClick: EdgeMouseHandler = useCallback(
    async (_event, edge) => {
      if (!currentVault) return;

      const linkType = (edge.data?.linkType as EdgeLinkType) ?? 'wiki_link';
      if (linkType !== 'wiki_link') {
        alert(
          '자동 감지된 관계예요. 본문에 대상 노트 제목이 등장해 생긴 링크라 그래프에서 끊을 수 없어요. 노트 본문을 직접 수정해 주세요.',
        );
        return;
      }

      const sourceTitle =
        (nodes.find((n) => n.id === edge.source)?.data.label as string) ?? edge.source;
      const targetTitle = (nodes.find((n) => n.id === edge.target)?.data.label as string) ?? '';
      if (!targetTitle) return;

      if (isTitleAmbiguous(targetTitle)) {
        alert(
          `제목이 "${targetTitle}"인 노트가 여러 개예요. 동명 노트는 그래프에서 관계를 편집할 수 없어요.`,
        );
        return;
      }

      const confirmed = confirm(`"${sourceTitle}" → "${targetTitle}" 관계를 끊을까요?`);
      if (!confirmed) return;

      try {
        const updatedNote = await electronAPI.link.remove({
          sourceNotePath: edge.source,
          targetTitle,
          vaultId: currentVault.id,
          vaultPath: currentVault.path,
        });
        syncCurrentNote(edge.source, updatedNote);
        await loadGraphData();
      } catch (error) {
        console.error('Failed to remove link:', error);
        alert('관계 삭제에 실패했습니다');
      }
    },
    [currentVault, nodes, currentNote, isTitleAmbiguous],
  );

  // 연결 드래그 시작: 시작 노드를 기록하고 대상 하이라이트를 켠다.
  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    connectStartRef.current = params.nodeId ?? null;
    didConnectRef.current = false;
    setConnectingNodeId(params.nodeId ?? null);
  }, []);

  // 연결 드래그 종료: 하이라이트를 끄고, 실제 연결이 아니라 같은 노드에서 뗀 경우(=클릭)면 노트를 연다.
  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      setConnectingNodeId(null);
      const startId = connectStartRef.current;
      connectStartRef.current = null;
      if (didConnectRef.current || !startId) return;

      const endId = getNodeIdFromPoint(event);
      if (endId === startId) {
        openNote(startId);
      }
    },
    [openNote],
  );

  return (
    <div className="graph-page">
      <div className="graph-header">
        <h2>지식 그래프</h2>
        <input
          ref={searchInputRef}
          type="text"
          className="graph-search"
          placeholder="노트 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <label
          className="graph-hops"
          title="검색한 노드에서 몇 단계까지 연결된 노트를 함께 볼지 선택해요"
        >
          이웃
          <select
            className="graph-hops-select"
            value={searchHops}
            onChange={(e) => setSearchHops(Number(e.target.value))}
            disabled={!searchQuery.trim()}
          >
            <option value={0}>0 (매칭만)</option>
            <option value={1}>1단계</option>
            <option value={2}>2단계</option>
            <option value={3}>3단계</option>
          </select>
        </label>
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

      <div className="graph-hint">
        💡 노드 몸통을 드래그하면 이동, 노드에 커서를 올리면 나타나는 테두리 점을 다른 노드로
        드래그하면 관계 추가. 관계선을 클릭하면 끊어요(점선=자동 감지 관계라 본문에서만 수정).
      </div>

      {/* 로딩 스피너는 '처음' 그래프가 없을 때만 노출한다.
          재로딩(연결/업데이트/새로고침) 때는 ReactFlow를 유지해 unmount로 인한 뷰포트 리셋(확대)을 막는다. */}
      {loading && nodes.length === 0 ? (
        <div className="graph-loading">그래프 불러오는 중...</div>
      ) : (
        <div className="graph-container">
          <ReactFlow
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_event, node) => openNote(node.id)}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onEdgeClick={onEdgeClick}
            onInit={(instance) => {
              rfRef.current = instance;
              // 최초 마운트 시에만 화면 맞춤. 이후 연결/업데이트에서는 뷰포트를 유지한다.
              instance.fitView({ padding: 0.2 });
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            nodesDraggable={true}
            nodesConnectable={true}
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
