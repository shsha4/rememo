// 그래프 검색 로직(순수 함수). 렌더러 표시용 계산만 담당하며 Node API에 의존하지 않는다.
// 검색어에 매칭되는 노드뿐 아니라, 그 노드와 관계 맺은 이웃(hops 단계까지)도 함께 노출하기 위한 집합을 계산한다.

export interface GraphSearchNode {
  id: string;
  label: string;
}

export interface GraphSearchEdge {
  source: string;
  target: string;
}

export interface GraphSearchResult {
  // 검색어에 직접 매칭된 노드 id(강조 대상).
  matchedIds: Set<string>;
  // 화면에 표시할 노드 id(매칭 노드 + hops 이내 이웃). 매칭이 아닌 노드는 흐리게 표시한다.
  visibleIds: Set<string>;
}

// 무방향 인접 리스트를 만든다. 링크는 방향이 있지만, "관계 맺은 것"을 보여줄 때는
// 들어오는·나가는 링크를 모두 이웃으로 취급한다.
function buildAdjacency(edges: GraphSearchEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  const add = (from: string, to: string) => {
    if (!adjacency.has(from)) {
      adjacency.set(from, new Set());
    }
    adjacency.get(from)!.add(to);
  };

  edges.forEach((edge) => {
    add(edge.source, edge.target);
    add(edge.target, edge.source);
  });

  return adjacency;
}

/**
 * 검색어에 매칭되는 노드와, 그 노드로부터 hops 단계 이내의 이웃 노드를 계산한다.
 *
 * - 빈 검색어: 전체 노드를 visible로 반환하고 matched는 빈 집합.
 * - hops < 1: 이웃 확장 없이 매칭 노드만 visible.
 * - 매칭은 label에 대한 대소문자 무시 부분일치(한글 부분일치 포함).
 */
export function computeGraphSearch(
  nodes: GraphSearchNode[],
  edges: GraphSearchEdge[],
  query: string,
  hops = 1,
): GraphSearchResult {
  const trimmed = query.trim();

  // 검색어가 없으면 전체 노출.
  if (!trimmed) {
    return {
      matchedIds: new Set(),
      visibleIds: new Set(nodes.map((n) => n.id)),
    };
  }

  const lowerQuery = trimmed.toLowerCase();
  const matchedIds = new Set(
    nodes.filter((n) => n.label.toLowerCase().includes(lowerQuery)).map((n) => n.id),
  );

  // 이웃 확장 없이 매칭 노드만.
  if (hops < 1) {
    return { matchedIds, visibleIds: new Set(matchedIds) };
  }

  const adjacency = buildAdjacency(edges);

  // 매칭 노드에서 시작해 hops 단계까지 BFS로 이웃을 모은다.
  const visibleIds = new Set(matchedIds);
  let frontier = new Set(matchedIds);

  for (let depth = 0; depth < hops; depth++) {
    const next = new Set<string>();
    frontier.forEach((id) => {
      const neighbors = adjacency.get(id);
      if (!neighbors) return;
      neighbors.forEach((neighborId) => {
        if (!visibleIds.has(neighborId)) {
          visibleIds.add(neighborId);
          next.add(neighborId);
        }
      });
    });
    if (next.size === 0) break;
    frontier = next;
  }

  return { matchedIds, visibleIds };
}
