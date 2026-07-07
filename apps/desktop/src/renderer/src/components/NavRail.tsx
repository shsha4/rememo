import './NavRail.css';

export type NavPage = 'editor' | 'graph' | 'search' | 'todo' | 'settings' | 'help';

interface NavItem {
  id: NavPage;
  label: string;
  icon: JSX.Element;
}

// 아이콘은 외부 의존성 없이 인라인 SVG(24x24, stroke=currentColor)로 그린다.
const TOP_ITEMS: NavItem[] = [
  {
    id: 'editor',
    label: '에디터',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 20h9M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'graph',
    label: '그래프',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 7.2 15.6 8M7.6 8 8.6 15.8M11 17l5.4-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'search',
    label: '검색',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'todo',
    label: '할 일',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="m8 12 2.5 2.5L16 9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    id: 'settings',
    label: '설정',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'help',
    label: '도움말',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.3.9-1.3 1.7v.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="11.9" cy="17" r="1" fill="currentColor" />
      </svg>
    ),
  },
];

interface NavRailProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
}

function NavRail({ currentPage, onNavigate }: NavRailProps) {
  const renderItem = (item: NavItem) => (
    <button
      key={item.id}
      type="button"
      className={`nav-rail-item ${currentPage === item.id ? 'active' : ''}`}
      data-label={item.label}
      aria-label={item.label}
      aria-current={currentPage === item.id ? 'page' : undefined}
      onClick={() => onNavigate(item.id)}
    >
      {item.icon}
    </button>
  );

  return (
    <nav className="nav-rail" aria-label="주요 메뉴">
      <div className="nav-rail-group">{TOP_ITEMS.map(renderItem)}</div>
      <div className="nav-rail-group nav-rail-bottom">{BOTTOM_ITEMS.map(renderItem)}</div>
    </nav>
  );
}

export default NavRail;
