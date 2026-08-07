import { createContext, FormEvent, PointerEvent as ReactPointerEvent, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, BookOpen, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Clipboard, Clock3, Compass, Eye, FileText, Heart, Image, Layers3, LayoutDashboard, LineChart, Lock, LogOut, Menu, MessageCircle, Package, Palette, Pencil, PenLine, RotateCcw, Search, Send, Settings, ShoppingCart, Sparkles, Tags, TicketPercent, Trash2, Upload, Volume2, X } from "lucide-react";
import { AiCompanionDock, AiMissionPage, emitAiActivity, useAiMission } from "./AiMission";
import { assetUrl } from "./assets";
import { ProgressiveImage } from "./ProgressiveImage";
import { clearUserQueryState, subscribeMarketChatChanges } from "./query-client";
import { RichContent, RichTextEditor, type RichDocument, type UploadedPostImage } from "./RichTextEditor";
import AdminPage from "./AdminPage";
type User = {
  id: number;
  email: string;
  nickname: string;
  accountStatus?: "ACTIVE" | "BLOCKED" | "WITHDRAWN";
  passwordChangeRequired?: boolean;
  interests?: string[];
  blog?: {
    id: number;
    name: string;
    slug: string;
    profileImageUrl?: string | null;
    subscriberCount?: number;
  } | null;
};
type Blog = {
  id: number;
  name: string;
  slug: string;
  url?: string;
  description: string;
  shopName?: string;
  shopDescription?: string;
  profileImageUrl?: string | null;
  owner?: { id: number; nickname: string };
  isSubscribed?: boolean;
  subscriberCount?: number;
  isOfficial?: boolean;
};
type BlogCategory = {
  id: number;
  name: string;
  position: number;
  isDefault?: boolean;
  activePostCount: number;
  trashPostCount: number;
};
type BlogClassification = BlogCategory & { source: "INTEREST" | "CUSTOM" };
type Post = {
  id: number;
  url?: string;
  title: string;
  content?: string;
  contentDocument?: RichDocument | null;
  excerpt?: string;
  thumbnailUrl?: string | null;
  status: "DRAFT" | "PUBLISHED";
  category?: { id: number; name: string } | null;
  classifications: { id: number; name: string }[];
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  author: { id: number; nickname: string };
  blog: { id: number; name: string; slug: string };
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  purgeAfter?: string | null;
};
type Page = {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};
type MarketImage = { id: number; url: string; position: number };
type MarketItem = {
  id: number | string;
  url?: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  condition: "NEW" | "LIKE_NEW" | "USED";
  pricePoints: number;
  status: "SELLING" | "RESERVED" | "SOLD";
  seller: { id: number | string; nickname: string };
  likeCount: number;
  isLiked: boolean;
  images?: MarketImage[];
  thumbnailUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  purgeAfter?: string | null;
};
type Conversation = {
  id: number | string;
  itemId: number | string;
  buyerId?: number;
  sellerId?: number;
  item?: { id: number; title: string } | null;
  peer?: { id: number; nickname: string; profileImageUrl?: string | null } | null;
  lastMessage?: { id: number; body: string; senderId: number; createdAt: string } | null;
  unreadCount?: number;
};
type ChatMessage = {
  id: number | string;
  conversationId?: number | string;
  senderId: number | string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  pending?: boolean;
  replyTo?: { id: number | string; body?: string | null; senderId?: number | string } | null;
  reactions?: { type: ChatReaction; count: number; reactedByMe: boolean }[];
};
type ChatReaction = "HEART" | "CHECK" | "THUMBS_UP" | "SAD" | "COOL" | "LAUGH";
type WalletTransaction = {
  id: number;
  orderId?: number;
  type: "INITIAL_GRANT" | "POINT_CHARGE" | "MARKET_PURCHASE" | "MARKET_SALE" | "REFUND" | "MISSION_REWARD";
  amount: number;
  balanceAfter: number;
  createdAt: string;
};
type Wallet = {
  balance: number;
  updatedAt: string;
  transactions: WalletTransaction[];
};
type MarketOrder = {
  id: number;
  itemId: number;
  buyerId: number;
  sellerId: number;
  pricePoints: number;
  status: "PAID" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  item?: {
    id: number;
    title: string;
    imageUrls?: string[];
    images?: MarketImage[];
    status: MarketItem["status"];
  };
};
type SearchBlog = Blog & { owner?: { id: number; nickname: string } };
type HomeBanner = {
  id: number;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  ctaLabel: string;
  ctaUrl: string;
  startsAt: string;
  endsAt?: string | null;
  position: number;
  isActive: boolean;
};
type HomeCreator = {
  blog: Blog;
  subscriberCount: number;
  isSubscribed: boolean;
  posts: Post[];
};
type HomeData = {
  banners: HomeBanner[];
  popularPosts: Post[];
  categoryPosts: Post[];
  trendingPosts: Post[];
  latestPosts: Post[];
  creators: HomeCreator[];
  marketItems: MarketItem[];
};
type Comment = {
  id: number;
  postId: number;
  parentId?: number | null;
  body: string;
  author: { id: number; nickname: string };
  anonymous: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};
type NotificationItem = {
  id: number;
  type: "LIKE" | "REPLY";
  actor: { id: number; nickname: string };
  post: { id: number; title: string };
  commentId?: number | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};
type NotificationData = {
  items: NotificationItem[];
  unreadCount: number;
  pagination: Page;
};

const AUTH_SNAPSHOT_KEY = "jungletory.auth-display.v1";
const AI_DOCK_STATE_KEY = "jungletory.ai-dock-state.v1";
const AuthBootstrapContext = createContext<{
  pending: boolean;
  cachedUser: User | null;
}>({ pending: false, cachedUser: null });
const readAuthSnapshot = (): User | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(AUTH_SNAPSHOT_KEY) ?? "null") as Partial<User> | null;
    return value && typeof value.id === "number" && typeof value.nickname === "string" ? (value as User) : null;
  } catch {
    return null;
  }
};
const writeAuthSnapshot = (user: User) => {
  sessionStorage.setItem(
    AUTH_SNAPSHOT_KEY,
    JSON.stringify({
      id: user.id,
      email: "",
      nickname: user.nickname,
      blog: user.blog ?? null,
    }),
  );
};
const readAiDockEnabled = (userId: number) => {
  try {
    const value = JSON.parse(sessionStorage.getItem(AI_DOCK_STATE_KEY) ?? "null") as { userId?: number; enabled?: boolean } | null;
    return value?.userId === userId && value.enabled === true;
  } catch {
    return false;
  }
};
const writeAiDockEnabled = (userId: number, enabled: boolean) => {
  if (enabled) sessionStorage.setItem(AI_DOCK_STATE_KEY, JSON.stringify({ userId, enabled: true }));
  else sessionStorage.removeItem(AI_DOCK_STATE_KEY);
};
const clearClientAuthState = () => {
  sessionStorage.removeItem(AUTH_SNAPSHOT_KEY);
  sessionStorage.removeItem(AI_DOCK_STATE_KEY);
  clearUserQueryState();
  csrfToken = "";
};

// Production authentication relies on the same-origin /api rewrite so the
// HttpOnly SameSite cookie is never treated as a third-party cookie.
const API = import.meta.env.DEV ? (import.meta.env.VITE_API_URL ?? "") : "";
const interestGroups = [
  {
    title: "작품 관심분야",
    description: "좋아하는 작품의 종류를 선택해주세요.",
    items: ["보컬로이드", "마스코트", "버추얼", "소설", "게임", "애니메이션/만화", "2.5차원/3D", "작품 카테고리", "아이돌 캐릭터", "자작 캐릭터"],
  },
  {
    title: "형태 관심분야",
    description: "주로 즐기는 콘텐츠 형태를 선택해주세요.",
    items: ["원작", "공식", "수집", "게임", "1차 창작", "2차 창작"],
  },
  {
    title: "외형/관계성",
    description: "마음이 가는 외형과 관계성을 선택해주세요.",
    items: ["고양이상", "덤앤더머", "깐머", "수인", "흑막", "강아지상", "오드아이", "금발/백발", "신뢰&유대", "구원 서사", "스승&제자", "주종", "장발남", "순애", "삼각관계", "계약 관계", "뱀상", "흑발", "혐관", "짝사랑", "서사 중심", "콤비", "앙숙", "덮머"],
  },
  {
    title: "성격",
    description: "좋아하는 캐릭터의 성격을 선택해주세요.",
    items: ["햇살캐", "어른스러운", "신중한", "순수한", "별난", "다정한", "낙천적", "내성적", "폭력적인", "집착적", "애정결핍인", "위선적", "소심한", "불안정한", "냉소적", "냉담한", "쾌활한", "댕댕이", "퇴폐미", "능글맞은", "멘헤라", "얀데레", "츤데레", "정의로운"],
  },
] as const;
const interestCatalog = [...new Set(interestGroups.flatMap((group) => [...group.items]))];
const solidColors = ["#9DB6AD", "#91A8B5", "#C79A7D", "#AAA982", "#C79A94", "#8FA3C2", "#C3A6B8", "#94B99B", "#C9AD78", "#92AEB0"];
const solidColor = (index: number, offset = 0) => solidColors[(index + offset) % solidColors.length];
const sampleMarketItems: MarketItem[] = [
  {
    id: "sample-1",
    title: "최애 캐릭터 한정 아크릴 스탠드",
    description: "개봉 후 진열만 한 상품입니다. 구성품은 본체와 받침대이며 눈에 띄는 흠집 없이 깨끗하게 보관했습니다.",
    category: "애니메이션 굿즈",
    tags: ["최애캐", "아크릴스탠드"],
    condition: "LIKE_NEW",
    pricePoints: 18000,
    status: "SELLING",
    seller: { id: "sample-seller-1", nickname: "굿즈수집가" },
    likeCount: 18,
    isLiked: false,
  },
  {
    id: "sample-2",
    title: "공식 캐릭터 봉제인형",
    description: "미개봉 새 상품이며 태그가 포함되어 있습니다.",
    category: "인형",
    tags: ["공식굿즈", "봉제인형"],
    condition: "NEW",
    pricePoints: 32000,
    status: "SELLING",
    seller: { id: "sample-seller-2", nickname: "덕질하는정글러" },
    likeCount: 12,
    isLiked: false,
  },
  {
    id: "sample-3",
    title: "극장판 특전 포토카드 세트",
    description: "슬리브에 보관해 상태가 좋습니다.",
    category: "포토카드",
    tags: ["극장판", "특전", "포토카드"],
    condition: "LIKE_NEW",
    pricePoints: 9500,
    status: "SELLING",
    seller: { id: "sample-seller-3", nickname: "애니기록소" },
    likeCount: 9,
    isLiked: false,
  },
  {
    id: "sample-4",
    title: "팝업스토어 랜덤 키링 세트",
    description: "중복으로 나온 키링 두 개를 함께 판매합니다.",
    category: "키링",
    tags: ["팝업스토어", "랜덤굿즈"],
    condition: "NEW",
    pricePoints: 14000,
    status: "SELLING",
    seller: { id: "sample-seller-4", nickname: "오늘도덕질" },
    likeCount: 6,
    isLiked: false,
  },
  {
    id: "sample-5",
    title: "입문용 캐릭터 프라모델",
    description: "한 번 조립했으며 부품과 설명서를 모두 보관했습니다.",
    category: "프라모델",
    tags: ["입문", "캐릭터굿즈"],
    condition: "USED",
    pricePoints: 22000,
    status: "SELLING",
    seller: { id: "sample-seller-5", nickname: "조립연구소" },
    likeCount: 0,
    isLiked: false,
  },
];
const fallbackPost = (id: number, title: string, tags: string[], category: string): Post => ({
  id: -id,
  title,
  status: "PUBLISHED",
  category: { id, name: category },
  classifications: tags.map((name, index) => ({ id: id * 10 + index, name })),
  viewCount: Math.max(24, 120 - id * 4),
  likeCount: Math.max(3, 20 - Math.floor(id / 2)),
  bookmarkCount: Math.max(1, 10 - Math.floor(id / 4)),
  commentCount: 4 + (id % 9),
  isLiked: false,
  isBookmarked: false,
  author: { id: 0, nickname: "팬덤 에디터" },
  blog: { id: 0, name: "팬덤 에디터", slug: "fandom-editor" },
  publishedAt: new Date().toISOString(),
});
const fallbackPopular = [fallbackPost(1, "이번 달 가장 만족했던 최애 굿즈 TOP 5", ["애니메이션", "굿즈리뷰"], "애니메이션"), fallbackPost(2, "예약 전에 확인해야 할 여름 신작 피규어 정리", ["피규어", "신상품"], "애니메이션"), fallbackPost(3, "중복 포토카드 안전하게 교환하는 방법", ["포토카드", "교환팁"], "버튜버"), fallbackPost(4, "누이 먼지 없이 오래 보관하는 관리 루틴", ["봉제인형", "보관법"], "게임"), fallbackPost(5, "작은 책상에도 잘 어울리는 아크릴 굿즈 배치법", ["아크릴스탠드", "전시"], "웹툰·캐릭터"), fallbackPost(6, "오픈 첫날 다녀온 공식 팝업스토어 후기", ["팝업스토어", "방문후기"], "애니메이션"), fallbackPost(7, "포토카드와 특전을 안전하게 정리하는 방법", ["포토카드", "수납팁"], "버튜버")];
const fallbackFocus = [fallbackPost(11, "극장판 한정 아크릴 스탠드 실물 후기", ["애니메이션", "아크릴스탠드"], "애니메이션"), fallbackPost(12, "공식 팝업스토어 마스코트 인형 비교", ["게임", "마스코트인형"], "게임"), fallbackPost(13, "시즌 한정 포토카드 3종 구성 정리", ["아이돌", "포토카드"], "버튜버"), fallbackPost(14, "랜덤 굿즈 중복을 줄이는 구매 방법", ["캐릭터", "랜덤굿즈"], "웹툰·캐릭터"), fallbackPost(15, "처음 조립하는 사람을 위한 프라모델과 공구 추천", ["프라모델", "입문정보"], "애니메이션")];
const fallbackLatest = [fallbackPost(21, "오픈 첫날 구매한 굿즈를 전부 열어봤어요", ["하울후기", "팝업스토어"], "애니메이션"), fallbackPost(22, "포토카드와 특전을 한 번에 정리하는 방법", ["굿즈정리", "수납팁"], "버튜버"), fallbackPost(23, "처음 해본 굿즈 교환, 이것만은 확인하세요", ["교환후기", "안전거래"], "게임"), fallbackPost(24, "1년 동안 모은 최애 굿즈 컬렉션 공개", ["덕질기록", "최애캐"], "웹툰·캐릭터"), fallbackPost(25, "책상 위 작은 굿즈존을 꾸며봤어요", ["전시팁", "아크릴굿즈"], "애니메이션")];
const fillPostSlots = (posts: Post[] | undefined, templates: Post[], count: number) => {
  const actual = (posts ?? []).slice(0, count);
  const actualTitles = new Set(actual.map((post) => post.title));
  return [...actual, ...templates.filter((post) => !actualTitles.has(post.title)).slice(0, Math.max(0, count - actual.length))];
};
const fillMarketSlots = (items: MarketItem[] | undefined, count: number) => {
  const actual = (items ?? []).slice(0, count);
  const titles = new Set(actual.map((item) => item.title));
  return [...actual, ...sampleMarketItems.filter((item) => !titles.has(item.title)).slice(0, Math.max(0, count - actual.length))];
};
const categoryTemplates = (category: string) =>
  category === "전체"
    ? fallbackPopular.slice(0, 7)
    : fallbackPopular.slice(0, 7).map((post, index) => ({
        ...post,
        id: -(1000 + ["애니메이션·만화", "게임", "버튜버", "웹툰·캐릭터"].indexOf(category) * 10 + index),
        category: { id: 100 + index, name: category },
        classifications: [{ id: 1000 + index * 2, name: category }, post.classifications[1] ?? post.classifications[0]],
      }));

const sidebarTips = [
  ["첫 문장에 핵심을 담아\n제목 완성하기", "TITLE", "#f3ece3"],
  ["직접 찍은 사진으로\n기록에 온도 더하기", "PHOTO", "#e5eeea"],
  ["작품명과 캐릭터명을\n검색 키워드로 쓰기", "KEYWORD", "#e9eaf3"],
  ["상태와 구성품이 보이는\n거래 후기 남기기", "REVIEW", "#f2e8e6"],
];

const popularCharacters = [
  ["치이카와", "치이카와", assetUrl("characters/chiikawa.webp"), "#f7e9d7"],
  ["산리오", "산리오", assetUrl("characters/sanrio.webp"), "#f5e2e8"],
  ["포켓몬", "포켓몬", assetUrl("characters/pokemon.webp"), "#f4e9b8"],
  ["짱구", "짱구", assetUrl("characters/shinchan.webp"), "#e9edcf"],
  ["잔망루피", "잔망루피", assetUrl("characters/loopy.webp"), "#f4dfe6"],
  ["스누피", "스누피", assetUrl("characters/snoopy.webp"), "#e7e4dc"],
];

const RECENT_MARKET_KEY = "jungletory.recent-market-items";
const readRecentMarketItems = () => {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_MARKET_KEY) ?? "[]") as MarketItem[]).slice(0, 20);
  } catch {
    return [];
  }
};
const rememberMarketItem = (item: MarketItem) => {
  const recent = readRecentMarketItems().filter((entry) => String(entry.id) !== String(item.id));
  localStorage.setItem(RECENT_MARKET_KEY, JSON.stringify([{ ...item, isLiked: false }, ...recent].slice(0, 20)));
};

const creatorPages = [
  [
    {
      blog: "최애를 기록하는 방",
      meta: "애니메이션 분야 · 1,467명 구독",
      posts: [["한정 아크릴 스탠드 실물 후기"], ["작은 책상에 굿즈존 꾸미기"]],
    },
    {
      blog: "포카 교환 연구소",
      meta: "버튜버 분야 · 392명 구독",
      posts: [["중복 포토카드 안전 교환 체크리스트"], ["슬리브와 바인더 보관법"]],
    },
  ],
  [
    {
      blog: "게임 굿즈 아카이브",
      meta: "게임 분야 · 826명 구독",
      posts: [["팝업스토어 마스코트 인형 비교"], ["예약 굿즈 발매 일정 정리"]],
    },
    {
      blog: "캐릭터 수집 일지",
      meta: "웹툰·캐릭터 분야 · 618명 구독",
      posts: [["랜덤 굿즈 중복을 줄이는 방법"], ["1년 동안 모은 컬렉션 공개"]],
    },
  ],
];

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const target = (event.target as Element | null)?.closest('[data-od-id="story-more"]') as HTMLElement | null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const module = target.closest(".story-creator");
      if (!module) return;
      const current = module.querySelector(".story-info-popover");
      if (current) {
        current.remove();
        target.setAttribute("aria-expanded", "false");
        return;
      }
      const popover = document.createElement("div");
      popover.className = "story-info-popover";
      popover.innerHTML = '<strong>스토리 크리에이터란?</strong><p>뚜렷한 주제를 가지고 우수한 창작 활동을 펼치는 창작자 입니다.</p><a href="/feed">선정조건 자세히보기 <span>›</span></a>';
      module.appendChild(popover);
      target.setAttribute("aria-expanded", "true");
    },
    true,
  );
}

let csrfToken = "";
const visitorIdStorageKey = "jungletory:visitor-id";
let volatileVisitorId = "";
function getVisitorId() {
  if (volatileVisitorId) return volatileVisitorId;
  try {
    const stored = window.localStorage.getItem(visitorIdStorageKey);
    if (stored) return (volatileVisitorId = stored);
    volatileVisitorId = crypto.randomUUID();
    window.localStorage.setItem(visitorIdStorageKey, volatileVisitorId);
    return volatileVisitorId;
  } catch {
    return (volatileVisitorId = crypto.randomUUID());
  }
}
class ApiRequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "") {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}
async function refreshCsrfToken() {
  const response = await fetch(`${API}/api/auth/csrf`, {
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.data?.csrfToken) throw new ApiRequestError(body.error?.message ?? "보안 토큰을 발급하지 못했습니다.", response.status, body.error?.code);
  csrfToken = body.data.csrfToken;
}
async function request<T>(path: string, options: RequestInit = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const needsCsrf = method !== "GET" && method !== "HEAD";
  if (needsCsrf && !csrfToken) await refreshCsrfToken();
  const multipart = options.body instanceof FormData;
  const send = () =>
    fetch(`${API}/api${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(!multipart ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...(options.headers ?? {}),
      },
    });
  let response = await send();
  let body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (needsCsrf && response.status === 403 && body.error?.code === "CSRF_TOKEN_INVALID") {
    csrfToken = "";
    await refreshCsrfToken();
    response = await send();
    body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  }
  if (response.status === 204) return undefined as T;
  if (!response.ok) throw new ApiRequestError(body.error?.message ?? "요청을 처리하지 못했습니다.", response.status, body.error?.code);
  return body.data as T;
}

async function requestList<T>(path: string) {
  const response = await fetch(`${API}/api${path}`, { credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? "목록을 불러오지 못했습니다.");
  return {
    data: (body.data ?? []) as T[],
    pagination: body.pagination as Page,
  };
}

function useRoute() {
  const [locationKey, setLocationKey] = useState(window.location.pathname + window.location.search);
  const path = locationKey.split("?")[0];
  useEffect(() => {
    const onPop = () => setLocationKey(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = (to: string) => {
    window.history.pushState({}, "", to);
    setLocationKey(window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  };
  return { path, go };
}

const notificationTime = (value: string) => {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (elapsed < 60_000) return "방금 전";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}분 전`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}시간 전`;
  return new Date(value).toLocaleDateString("ko-KR");
};

function Header({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const { pending: authPending, cachedUser } = useContext(AuthBootstrapContext);
  const displayUser = user ?? (authPending ? cachedUser : null);
  const [mobile, setMobile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [query, setQuery] = useState("");
  const path = window.location.pathname;
  const notificationQuery = useQuery({
    queryKey: ["notifications", "header", displayUser?.id],
    queryFn: () => request<NotificationData>("/notifications?page=1&size=8"),
    enabled: Boolean(displayUser && !authPending),
    refetchInterval: 30_000,
  });
  const notificationData = notificationQuery.data;
  const readNotification = async (item: NotificationItem) => {
    if (!item.read) await request(`/notifications/${item.id}/read`, { method: "PATCH" });
    await notificationQuery.refetch();
    navigate(`/post/${item.post.id}${item.commentId ? `?comment=${item.commentId}` : ""}`);
  };
  const readAllNotifications = async () => {
    await request("/notifications/read-all", { method: "PATCH" });
    await notificationQuery.refetch();
  };
  useEffect(() => {
    const onScroll = () => setFixed(window.scrollY > 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go("/search" + (query.trim() ? "?q=" + encodeURIComponent(query.trim()) : ""));
    setMobile(false);
  };
  const navigate = (to: string) => {
    go(to);
    setMobile(false);
    setProfileOpen(false);
    setNotificationOpen(false);
  };
  const logout = async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearClientAuthState();
      window.location.href = "/";
    }
  };
  const publicBlogPath = displayUser?.blog ? `/blog/${displayUser.blog.slug}` : "/blog/new";
  return (
    <div className="site-header-slot">
      <header className={fixed ? "site-header is-fixed" : "site-header"} data-od-id="site-header">
        <div className="header-inner">
          <button className="brand" data-od-id="brand" onClick={() => navigate("/")}>
            정글토리
          </button>
          <nav className={mobile ? "main-nav open" : "main-nav"} aria-label="주요 메뉴">
            {[
              ["홈", "/"],
              ["피드", "/feed"],
              ["마켓", "/market"],
              ["AI", "/ai"],
            ].map(([label, to]) => (
              <button key={to} className={path === to || (to === "/market" && path.startsWith("/market/")) ? "active" : ""} onClick={() => navigate(to)}>
                {label}
              </button>
            ))}
          </nav>
          <form className="header-search" data-od-id="header-search" onSubmit={submit}>
            <input name="query" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="검색어 입력" placeholder="검색어 입력" />
            <button aria-label="검색">
              <Search size={17} />
            </button>
          </form>
          <div className="header-actions">
            <button className="header-notice" onClick={() => navigate("/notice/2702")}>
              <Volume2 size={16} />
              <span>불법촬영물 유통 방지 조치 대상 확대 안내</span>
            </button>
            {displayUser ? (
              <div className="signed-header-actions">
                <button
                  className="header-icon-button notification-trigger"
                  aria-label={`알림${notificationData?.unreadCount ? ` ${notificationData.unreadCount}개 미확인` : ""}`}
                  aria-expanded={notificationOpen}
                  onClick={() => {
                    setNotificationOpen(!notificationOpen);
                    setProfileOpen(false);
                  }}
                >
                  <Bell size={20} />
                  {Boolean(notificationData?.unreadCount) && <i />}
                </button>
                {notificationOpen && (
                  <>
                    <button className="profile-menu-scrim" aria-label="알림 닫기" onClick={() => setNotificationOpen(false)} />
                    <div className="notification-popover">
                      <header>
                        <strong>알림</strong>
                        {Boolean(notificationData?.unreadCount) && <button onClick={readAllNotifications}>모두 읽음</button>}
                      </header>
                      <div className="notification-scroll">
                        {notificationQuery.isPending ? (
                          <p className="notification-empty">알림을 불러오는 중…</p>
                        ) : notificationData?.items.length ? (
                          notificationData.items.map((item) => (
                            <button className={item.read ? "notification-item" : "notification-item unread"} key={item.id} onClick={() => readNotification(item)}>
                              <span>{item.actor.nickname.slice(0, 1)}</span>
                              <div>
                                <p>
                                  <b>{item.actor.nickname}</b>님이 {item.type === "LIKE" ? "회원님의 글을 좋아합니다." : "회원님의 댓글에 답글을 남겼습니다."}
                                </p>
                                <small>{item.post.title}</small>
                                <time>{notificationTime(item.createdAt)}</time>
                              </div>
                            </button>
                          ))
                        ) : (
                          <p className="notification-empty">새로운 알림이 없습니다.</p>
                        )}
                      </div>
                      <button className="notification-all" onClick={() => navigate("/notifications")}>
                        전체보기 <ArrowRight size={13} />
                      </button>
                    </div>
                  </>
                )}
                <button
                  className={`profile-trigger${displayUser.blog?.profileImageUrl ? " has-photo" : ""}`}
                  style={
                    displayUser.blog?.profileImageUrl
                      ? {
                          backgroundImage: `url(${displayUser.blog.profileImageUrl})`,
                        }
                      : undefined
                  }
                  aria-label="프로필 메뉴"
                  aria-expanded={profileOpen}
                  onClick={() => {
                    setProfileOpen(!profileOpen);
                    setNotificationOpen(false);
                  }}
                >
                  {displayUser.blog?.profileImageUrl ? "" : displayUser.nickname.slice(0, 1).toUpperCase()}
                </button>
                {profileOpen && (
                  <>
                    <button className="profile-menu-scrim" aria-label="프로필 메뉴 닫기" onClick={() => setProfileOpen(false)} />
                    <div className="profile-popover" role="menu">
                      <div className="profile-summary">
                        <span
                          className={`profile-avatar${displayUser.blog?.profileImageUrl ? " has-photo" : ""}`}
                          style={
                            displayUser.blog?.profileImageUrl
                              ? {
                                  backgroundImage: `url(${displayUser.blog.profileImageUrl})`,
                                }
                              : undefined
                          }
                        >
                          {displayUser.blog?.profileImageUrl ? "" : displayUser.nickname.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{displayUser.nickname}</strong>
                          <span>{displayUser.email}</span>
                          <button disabled={authPending} onClick={() => navigate("/blog/me/manage")}>
                            계정관리
                          </button>
                        </div>
                      </div>
                      <div className="profile-blog">
                        <p>운영중인 블로그</p>
                        <div>
                          <button onClick={() => navigate(publicBlogPath)}>{displayUser.blog?.name ?? displayUser.nickname}</button>
                          <span>
                            <button disabled={authPending} aria-label="글쓰기" onClick={() => navigate(displayUser.blog ? "/write" : "/blog/new")}>
                              <Pencil size={16} />
                            </button>
                            <button disabled={authPending} aria-label="블로그 관리" onClick={() => navigate(displayUser.blog ? "/blog/me/manage" : "/blog/new")}>
                              <Settings size={16} />
                            </button>
                          </span>
                        </div>
                      </div>
                      <button className="profile-bookmarks" role="menuitem" disabled={authPending} onClick={() => navigate("/bookmarks")}>
                        <Bookmark size={15} /> 저장한 글
                      </button>
                      <button className="profile-wallet" role="menuitem" disabled={authPending} onClick={() => navigate("/market/wallet")}>
                        <ShoppingCart size={15} /> 포인트 지갑 · 거래내역
                      </button>
                      <button className="profile-logout" role="menuitem" onClick={logout}>
                        로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : authPending ? (
              <span className="header-auth-skeleton" aria-label="로그인 상태 확인 중" />
            ) : (
              <button className="outline-button" onClick={onLogin}>
                시작하기
              </button>
            )}
            <button className="mobile-trigger" onClick={() => setMobile(!mobile)} aria-expanded={mobile} aria-label={mobile ? "메뉴 닫기" : "메뉴 열기"}>
              <Menu size={21} />
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}

function AccountPanel({ user, go }: { user: User; go: (to: string) => void }) {
  const publicBlogPath = user.blog ? `/blog/${user.blog.slug}` : "/blog/new";
  const statsQuery = useQuery({
    queryKey: ["blog-home-stats", user.blog?.id],
    queryFn: () => request<{ totalPostViews: number; totalVisitors: number }>("/blogs/me/stats"),
    enabled: Boolean(user.blog),
    refetchInterval: 30_000,
    retry: false,
  });
  const stats = statsQuery.data;
  return (
    <section className="account-dashboard">
      <div className="account-dashboard-head">
        <span className={`account-dashboard-avatar${user.blog?.profileImageUrl ? " has-photo" : ""}`} style={user.blog?.profileImageUrl ? { backgroundImage: `url(${user.blog.profileImageUrl})` } : undefined}>
          {user.blog?.profileImageUrl ? "" : user.nickname.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong className="font-jua">{user.nickname}</strong>
          <span className="font-jua">
            구독자 <b className="font-jua">{user.blog?.subscriberCount ?? 0}명</b>
          </span>
        </div>
        <button className="account-dashboard-toggle" aria-label="계정 정보 펼치기">
          <ChevronDown size={18} />
        </button>
      </div>
      <div className="account-dashboard-actions">
        <button className="font-jua" onClick={() => go(user.blog ? "/write" : "/blog/new")}>글쓰기</button>
        <button className="font-jua" onClick={() => go(publicBlogPath)}>내 블로그</button>
        <button className="font-jua" onClick={() => go(user.blog ? "/blog/me/manage" : "/blog/new")}>관리</button>
      </div>
      <dl>
        <div>
          <dt className="font-jua">조회수</dt>
          <dd>
            <b className="font-jua">{stats ? `${stats.totalPostViews.toLocaleString()}회` : "—"}</b>
            <ChevronRight size={18} />
          </dd>
        </div>
        <div>
          <dt className="font-jua">방문자</dt>
          <dd>
            <b className="font-jua">{stats ? `${stats.totalVisitors.toLocaleString()}명` : "—"}</b>
            <ChevronRight size={18} />
          </dd>
        </div>
        <div>
          <dt className="font-jua">수익</dt>
          <dd>
            <button className="font-jua" onClick={() => go("/blog/me/manage")}>
              <i>₩</i> 내 수익 <b className="font-jua">예측해보기</b>
            </button>
            <ChevronRight size={18} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Shell({ children, go, user, onLogin }: { children: React.ReactNode; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  return (
    <>
      <a className="skip-link" href="#main">
        본문 바로가기
      </a>
      <Header go={go} user={user} onLogin={onLogin} />
      {children}
      <Footer go={go} />
    </>
  );
}

function Footer({ go }: { go: (to: string) => void }) {
  const groups = [
    [
      "메뉴가 궁금할 땐",
      [
        ["홈", "/"],
        ["피드", "/feed"],
        ["마켓", "/market"],
        ["AI", "/ai"],
      ],
    ],
    [
      "사용하다 궁금할 땐",
      [
        ["마켓 이용안내", "/market"],
        ["고객센터", "#"],
        ["공지사항", "/notice/2702"],
      ],
    ],
    [
      "정책이 궁금할 땐",
      [
        ["이용약관", "#"],
        ["이전 이용약관", "#"],
        ["운영정책", "#"],
        ["개인정보처리방침", "#"],
        ["청소년보호정책", "#"],
      ],
    ],
    [
      "도움이 필요할 땐",
      [
        ["권리침해신고", "#"],
        ["상거래 피해 구제신청", "#"],
      ],
    ],
  ];
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <strong>JUNGLETORY</strong>
          <p>
            정글토리는 Daum에서 <ProgressiveImage src={assetUrl("jungletory/heart.png")} alt="사랑" /> 을 담아 만듭니다.
          </p>
          <small>© Daum Corp.</small>
        </div>
        <div className="footer-links">
          {groups.map(([title, links]) => (
            <FooterGroup key={title as string} title={title as string} links={links as string[][]} go={go} />
          ))}
        </div>
      </div>
    </footer>
  );
}
function FooterGroup({ title, links, go }: { title: string; links: string[][]; go: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="footer-group">
      <button className="footer-title" onClick={() => setOpen(!open)}>
        {title}
        <ChevronDown size={14} className={open ? "rotated" : ""} />
      </button>
      <div className={open ? "footer-list expanded" : "footer-list"}>
        {links.map(([name, path]) => (
          <button key={name} onClick={() => path.startsWith("/") && go(path)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pager({ page, total, onChange, label }: { page: number; total: number; onChange: (page: number) => void; label: string }) {
  const move = (delta: number) => onChange(((page - 1 + delta + total) % total) + 1);
  return (
    <div className="jungletory-pager" aria-label={label}>
      <button onClick={() => move(-1)} aria-label="이전 페이지">
        <ChevronDown size={14} />
      </button>
      <span>
        <b>{page}</b>/ {total}
      </span>
      <button onClick={() => move(1)} aria-label="다음 페이지">
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

function StoryCreator({ page, onPage, go }: { page: number; onPage: (page: number) => void; go: (to: string) => void }) {
  const creators = creatorPages[(page - 1) % creatorPages.length];
  return (
    <section className="sidebar-module story-creator">
      <div className="sidebar-heading">
        <h2>
          관심 분야 크리에이터 <em>ⓘ</em>
        </h2>
      </div>
      <div className="creator-page">
        {creators.map((creator, creatorIndex) => (
          <article className="creator-card" key={creator.blog}>
            <div className="creator-profile">
              <button className="creator-name" onClick={() => go("/feed")}>
                <strong>{creator.blog}</strong>
                <span>{creator.meta}</span>
              </button>
              <button className="creator-subscribe">+ 구독</button>
            </div>
            <div className="creator-posts">
              {creator.posts.map(([title], postIndex) => (
                <button className="creator-post" key={title} onClick={() => go("/feed")}>
                  <span>
                    <strong>{title}</strong>
                    <small>
                      ♡ {17 - postIndex * 3}　□ {6 + creatorIndex}　{postIndex ? "1일 전" : "8시간 전"}
                    </small>
                  </span>
                  <span
                    className="creator-color"
                    style={{
                      backgroundColor: solidColor(postIndex, creatorIndex * 3),
                    }}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <Pager page={page} total={16} onChange={onPage} label="스토리 크리에이터 페이지" />
    </section>
  );
}

function ShoppingShortcutModule({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const interests = [...new Set((user?.interests ?? []).map((interest) => interest.trim()).filter(Boolean))].slice(0, 8);
  const searchInterests = () => {
    if (!user) return onLogin();
    if (!interests.length) return go("/blog/me/manage/interests");
    const params = new URLSearchParams({ tab: "posts" });
    interests.forEach((interest) => params.append("interest", interest));
    go(`/search?${params.toString()}`);
  };
  const openWishlist = () => (user ? go("/market/wishlist") : onLogin());
  const shortcuts = [
    ["관심카테고리", interests.length ? `${interests.length}개 관심사 검색` : "관심사 검색", Tags, searchInterests],
    ["최근 본 상품", "다시 보기", Clock3, () => go("/market/recent")],
    ["장바구니", "담은 상품", ShoppingCart, () => go("/market/cart")],
    ["찜", "좋아한 상품", Heart, openWishlist],
    ["중고 최근 시세", "가격 흐름", LineChart, () => go("/market/price-guide")],
    ["쿠폰", "혜택 모아보기", TicketPercent, () => go("/market/coupons")],
  ] as const;
  return (
    <section className="sidebar-module shopping-shortcuts">
      <div className="sidebar-heading">
        <h2>나의 쇼핑</h2>
        <span>필요한 메뉴를 빠르게 찾아보세요.</span>
      </div>
      <div className="shopping-shortcut-grid">
        {shortcuts.map(([title, detail, Icon, action]) => (
          <button key={title} onClick={action}>
            <Icon size={20} strokeWidth={1.7} />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            <ChevronRight size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}

function Home({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [category, setCategory] = useState("전체");
  const [categoryPage, setCategoryPage] = useState(1);
  const [tipPage, setTipPage] = useState(1);
  const [bannerPage, setBannerPage] = useState(0);
  const [bannerHover, setBannerHover] = useState(false);
  const { data: home = null } = useQuery({
    queryKey: ["home"],
    queryFn: () => request<HomeData>("/home"),
    refetchInterval: 30_000,
  });
  const categories = ["전체", "애니메이션·만화", "게임", "버튜버", "웹툰·캐릭터"];
  const recommendations = fillPostSlots(home?.popularPosts, fallbackPopular, 5);
  const connectedCategoryPosts = (home?.categoryPosts ?? []).filter((post) => category === "전체" || post.category?.name === category || (category === "애니메이션·만화" && (post.category?.name === "애니메이션" || post.category?.name === "만화")));
  const categoryPosts = fillPostSlots(connectedCategoryPosts, categoryTemplates(category), 7);
  const categoryPagePosts = categoryPosts.map((_, index) => categoryPosts[(index + categoryPage - 1) % categoryPosts.length]);
  const latestPosts = fillPostSlots(home?.latestPosts, fallbackLatest, 5);
  const popularMarketItems = fillMarketSlots(home?.marketItems, 5);
  const shownTips = tipPage === 1 ? sidebarTips : [...sidebarTips].reverse();
  const bannerPlaceholders: HomeBanner[] = [
    { id:-1,eyebrow:"NOTICE · EVENT",title:"최애를 기록하고\n취향을 나누는 새로운 공간",description:"팬들이 함께 만드는 굿즈 이야기와 새로운 이벤트를 만나보세요.",imageUrl:null,ctaLabel:"이벤트 자세히 보기",ctaUrl:"/blog/admin",startsAt:"",position:0,isActive:true },
    { id:-2,eyebrow:"FANDOM · STORY",title:"좋아하는 마음이\n한 편의 기록이 되는 곳",description:"팬들의 새로운 이야기와 취향을 천천히 둘러보세요.",imageUrl:null,ctaLabel:"새로운 글 둘러보기",ctaUrl:"/feed",startsAt:"",position:1,isActive:true },
    { id:-3,eyebrow:"GOODS · MARKET",title:"소중히 간직한 굿즈의\n다음 주인을 찾아요",description:"취향이 맞는 팬과 안전하게 굿즈를 나눠보세요.",imageUrl:null,ctaLabel:"마켓 둘러보기",ctaUrl:"/market",startsAt:"",position:2,isActive:true },
    { id:-4,eyebrow:"FAN · COMMUNITY",title:"같은 장면을 좋아하는\n사람들과 만나는 순간",description:"오늘의 감상과 오래 간직한 이야기를 함께 나눠보세요.",imageUrl:null,ctaLabel:"팬 이야기 만나기",ctaUrl:"/feed",startsAt:"",position:3,isActive:true },
    { id:-5,eyebrow:"JUNGLETORY · PICK",title:"오늘 발견한 취향을\n나만의 방식으로 기록해요",description:"사진과 글로 완성된 다채로운 팬 기록을 만나보세요.",imageUrl:null,ctaLabel:"추천 기록 보기",ctaUrl:"/",startsAt:"",position:4,isActive:true },
  ];
  const connectedBanners = (home?.banners ?? []).slice(0,5);
  const bannerImages = [
    "/assets/events/event-chiikawa.png",
    "/assets/events/event-kitty.png",
    "/assets/events/event-usagi.png",
    "/assets/events/event-zanmang-loopy.png",
    "/assets/events/event-onepiece-luffy.png",
  ];
  const bannerSlides = [...connectedBanners, ...bannerPlaceholders.slice(connectedBanners.length)]
    .slice(0,5)
    .map((slide,index)=>({ ...slide, imageUrl: bannerImages[index] }));
  useEffect(()=>{ if(bannerHover)return; const timer=window.setInterval(()=>setBannerPage((page)=>(page+1)%5),3000); return()=>window.clearInterval(timer) },[bannerHover]);
  useEffect(()=>{ if(bannerPage>=bannerSlides.length)setBannerPage(0) },[bannerPage,bannerSlides.length]);
  const openPost = (post: Post) => (post.id > 0 ? go(`/post/${post.id}`) : go("/feed"));
  const tags = (post: Post) => (
    <span className="home-post-tags">
      {post.classifications
        .slice(0, 2)
        .map((item) => `#${item.name}`)
        .join(" ")}
    </span>
  );

  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="home-main">
        <div className="home-frame">
          <div className="home-content">
            <section className="today-jungletory" aria-roledescription="carousel" aria-label="이벤트 및 주요 소식" onMouseEnter={()=>setBannerHover(true)} onMouseLeave={()=>setBannerHover(false)}>
              {bannerSlides.map((slide,index)=>(
                <div
                  aria-hidden={bannerPage!==index}
                  className={`today-card today-slide-${index}${slide.imageUrl ? " has-image" : ""}${bannerPage===index ? " active" : ""}`}
                  key={slide.id}
                  style={
                    slide.imageUrl
                      ? {
                          backgroundImage: `linear-gradient(90deg,rgba(16,19,24,.1),rgba(16,19,24,0)),url(${slide.imageUrl})`,
                        }
                      : { backgroundColor: solidColor(index) }
                  }
                >
                  <div>
                    <p>{slide.eyebrow}</p>
                    <h1>{slide.title}</h1>
                    <span>{slide.description}</span>
                    <button tabIndex={bannerPage===index ? 0 : -1} onClick={() => go(slide.ctaUrl)}>{slide.ctaLabel}</button>
                  </div>
                </div>
              ))}
              <svg className="today-goo-defs" aria-hidden="true" focusable="false">
                <defs>
                  <filter id="today-goo" x="-200%" y="-200%" width="500%" height="500%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="blur" />
                    <feColorMatrix
                      in="blur"
                      mode="matrix"
                      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 32 -11"
                      result="goo"
                    />
                  </filter>
                </defs>
              </svg>
              <button className="today-nav today-nav-prev" aria-label="이전 이벤트" onClick={()=>setBannerPage((page)=>(page+4)%5)}><span/><ChevronLeft size={22}/></button>
              <button className="today-nav today-nav-next" aria-label="다음 이벤트" onClick={()=>setBannerPage((page)=>(page+1)%5)}><span/><ChevronRight size={22}/></button>
              <div className="today-dots" role="tablist" aria-label="이벤트 페이지 선택">{bannerSlides.map((slide,index)=><button key={slide.id} role="tab" aria-selected={bannerPage===index} aria-label={`${index+1}번 이벤트`} className={bannerPage===index?"active":""} onClick={()=>setBannerPage(index)}/>)}</div>
            </section>

            <section className="best-popularity" aria-label="추천글">
              <div className="best-list">
                {recommendations.map((post, index) => (
                  <article className="best-row" key={post.id}>
                    <b>{index + 1}/</b>
                    <div className="best-copy">
                      {tags(post)}
                      <h3>
                        <button onClick={() => openPost(post)}>{post.title}</button>
                      </h3>
                      <small>
                        조회 {post.viewCount} · 좋아요 {post.likeCount} · 댓글 {post.commentCount}
                      </small>
                    </div>
                    <div className={`post-thumb${post.thumbnailUrl ? " has-image" : ""}`} style={{ backgroundColor: solidColor(index, 1) }}>
                      {post.thumbnailUrl && <ProgressiveImage src={post.thumbnailUrl} alt="" />}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="category-popularity">
              <div className="category-tabs" role="tablist">
                {categories.map((label) => (
                  <button
                    key={label}
                    role="tab"
                    aria-selected={(category || "전체") === label}
                    className={(category || "전체") === label ? "active" : ""}
                    onClick={() => {
                      setCategory(label);
                      setCategoryPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="category-grid">
                {categoryPagePosts.length ? (
                  categoryPagePosts.slice(0, 3).map((post, index) => (
                    <article key={post.id}>
                      <div>
                        {tags(post)}
                        <h3>
                          <button onClick={() => openPost(post)}>{post.title}</button>
                        </h3>
                        <p>{post.excerpt ?? "팬들이 함께 나누는 새로운 이야기입니다."}</p>
                        <small>
                          조회 {post.viewCount}　♡ {post.likeCount}　댓글 {post.commentCount}
                        </small>
                      </div>
                      <div
                        className={`post-thumb${post.thumbnailUrl ? " has-image" : ""}`}
                        style={{
                          backgroundColor: solidColor(index, categoryPage),
                        }}
                      >
                        {post.thumbnailUrl && <ProgressiveImage src={post.thumbnailUrl} alt="" />}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="home-empty">이 카테고리의 글을 준비하고 있습니다.</div>
                )}
              </div>
              <Pager page={categoryPage} total={7} onChange={setCategoryPage} label="카테고리 추천글 페이지" />
            </section>

            <HomeMarketEditorial items={popularMarketItems} go={go} />
            <HomeEditorial title="최애 이야기를 나눠요" description="구매 후기부터 전시와 보관까지 팬들의 기록을 만나보세요." posts={latestPosts} go={go} />
          </div>

          <aside className="jungletory-right">
            {user ? (
              <AccountPanel user={user} go={go} />
            ) : (
              <section className="my-jungletory">
                <p>정글토리에 로그인하시고 더 많은 기능을 이용해보세요!</p>
                <button onClick={onLogin}>✉　이메일로 시작하기</button>
              </section>
            )}

            <ShoppingShortcutModule go={go} user={user} onLogin={onLogin} />

            <section className="sidebar-module tip-module">
              <div className="sidebar-heading">
                <h2>블로그 작성 Tip</h2>
              </div>
              <div className="tip-grid">
                {shownTips.map(([title, label, color]) => (
                  <button key={title} style={{ backgroundColor: color }} onClick={() => (user ? go("/write") : onLogin())}>
                    <small>{label}</small>
                    <span>{title}</span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
              <Pager page={tipPage} total={2} onChange={setTipPage} label="블로그 작성 팁 페이지" />
            </section>

            <section className="sidebar-module character-module">
              <div className="sidebar-heading">
                <h2>인기 캐릭터 보기</h2>
              </div>
              <div className="character-grid">
                {popularCharacters.map(([name, query, image, color]) => (
                  <button key={name} style={{ backgroundColor: color }} onClick={() => go(`/market?q=${encodeURIComponent(`#${query}`)}`)}>
                    <span>
                      <ProgressiveImage src={image} alt="" />
                    </span>
                    <strong>{name}</strong>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </Shell>
  );
}

function HomeEditorial({ title, description, posts, go }: { title: string; description: string; posts: Post[]; go: (to: string) => void }) {
  return (
    <section className="home-editorial">
      <div className="editorial-heading">
        <div>
          <p>FOCUS</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
      </div>
      <div className="editorial-list">
        {posts.map((post, index) => (
          <article key={post.id}>
            <span className="home-post-tags">
              {post.classifications
                .slice(0, 2)
                .map((item) => `#${item.name}`)
                .join(" ")}
            </span>
            <h3>
              <button onClick={() => (post.id > 0 ? go(`/post/${post.id}`) : go("/feed"))}>{post.title}</button>
            </h3>
            <p>{post.excerpt ?? "팬들이 함께 나누는 새로운 이야기와 기록입니다."}</p>
            <div className={`editorial-thumb${post.thumbnailUrl ? " has-image" : ""}`} style={{ backgroundColor: solidColor(index, title.length) }}>
              {post.thumbnailUrl && <ProgressiveImage src={post.thumbnailUrl} alt="" />}
            </div>
            <small>
              조회 {post.viewCount}　♡ {post.likeCount}　댓글 {post.commentCount}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
function HomeMarketEditorial({ items, go }: { items: MarketItem[]; go: (to: string) => void }) {
  return (
    <section className="home-editorial home-market-editorial">
      <div className="editorial-heading">
        <div>
          <p>FOCUS</p>
          <h2>지금 팬들이 찾는 굿즈</h2>
          <span>좋아요가 많은 판매 중 굿즈를 모았습니다.</span>
        </div>
      </div>
      <div className="editorial-list">
        {items.map((item, index) => (
          <article className="home-market-card" key={item.id}>
            <span className="home-post-tags">
              {item.tags
                .slice(0, 2)
                .map((tag) => `#${tag}`)
                .join(" ")}
            </span>
            <h3>
              <button onClick={() => go(item.url ?? `/market/${item.id}`)}>{item.title}</button>
            </h3>
            <p>{item.description}</p>
            <small>
              {item.category} · {conditionLabel[item.condition]}
            </small>
            <strong className="home-market-price">{item.pricePoints.toLocaleString()} P</strong>
            <small>
              {item.seller.nickname} · ♡ {item.likeCount ?? 0}
            </small>
            <button className={`editorial-thumb home-market-thumb${item.thumbnailUrl ? " has-image" : ""}`} style={{ backgroundColor: solidColor(index, 6) }} onClick={() => go(item.url ?? `/market/${item.id}`)} aria-label={`${item.title} 상품 보기`}>
              {item.thumbnailUrl ? <ProgressiveImage src={item.thumbnailUrl} alt="" /> : <span>{item.category}</span>}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
function Feed({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [query, setQuery] = useState(new URLSearchParams(window.location.search).get("q") ?? "");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const scope = user ? "following" : "public";
  const feedQuery = useQuery({
    queryKey: ["posts", scope, query, sort],
    queryFn: () => request<Post[]>(`/posts?scope=${scope}&q=${encodeURIComponent(query)}&sort=${sort}&page=1&size=10`),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
  const posts = feedQuery.data ?? [];
  const error = feedQuery.error instanceof Error ? feedQuery.error.message : "";
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="page-main">
        <div className="section-inner">
          <div className="page-intro">
            <p className="eyebrow">JUNGLETORY FEED</p>
            <h1>
              {user ? (
                <>
                  구독한 블로그의
                  <br />
                  새로운 이야기.
                </>
              ) : (
                <>
                  새로운 이야기를
                  <br />
                  발견해보세요.
                </>
              )}
            </h1>
            <div className="feed-search">
              <Search size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQuery(query.trim())} placeholder="제목, 본문, 블로그 검색" />
            </div>
          </div>
          <div className="feed-toolbar">
            <strong>
              {user ? "구독 피드" : "전체 글"} <em>{posts.length}</em>
            </strong>
            <div>
              <button className={sort === "latest" ? "active" : ""} onClick={() => setSort("latest")}>
                최신순
              </button>
              <button className={sort === "popular" ? "active" : ""} onClick={() => setSort("popular")}>
                인기순
              </button>
            </div>
          </div>
          {error ? (
            <Empty text="피드를 불러오지 못했습니다." detail={error} />
          ) : feedQuery.isPending ? (
            <ContentSkeleton rows={5} />
          ) : posts.length ? (
            <div className="feed-list">
              {posts.map((post) => (
                <PostRow key={post.id} post={post} go={go} />
              ))}
            </div>
          ) : (
            <Empty text={query ? `‘${query}’에 대한 글이 없습니다.` : user ? "구독 피드가 비어 있습니다." : "아직 발행된 글이 없습니다."} detail={user && !query ? "관심 있는 블로그를 구독하면 새 글이 여기에 표시됩니다." : undefined} />
          )}
        </div>
      </main>
    </Shell>
  );
}

function BookmarkedPosts({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    request<Post[]>("/posts?scope=bookmarked&sort=latest&page=1&size=50")
      .then(setPosts)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [user]);
  if (!user)
    return (
      <Shell go={go} user={user} onLogin={onLogin}>
        <main id="main" className="page-main">
          <div className="section-inner">
            <Empty text="로그인 후 저장한 글을 확인할 수 있습니다." />
            <button className="primary-button compact saved-login" onClick={onLogin}>
              로그인
            </button>
          </div>
        </main>
      </Shell>
    );
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="page-main">
        <div className="section-inner">
          <div className="page-intro saved-intro">
            <p className="eyebrow">SAVED POSTS</p>
            <h1>
              다시 보고 싶은
              <br />
              이야기.
            </h1>
            <p>북마크한 글은 본인에게만 표시됩니다.</p>
          </div>
          {error ? (
            <Empty text="저장한 글을 불러오지 못했습니다." detail={error} />
          ) : loading ? (
            <Empty text="저장한 글을 불러오는 중입니다." />
          ) : posts.length ? (
            <div className="feed-list">
              {posts.map((post) => (
                <PostRow key={post.id} post={post} go={go} />
              ))}
            </div>
          ) : (
            <Empty text="아직 저장한 글이 없습니다." detail="게시글의 북마크 버튼을 누르면 이곳에서 다시 볼 수 있습니다." />
          )}
        </div>
      </main>
    </Shell>
  );
}

function PostRow({ post, go, mine = false }: { post: Post; go: (to: string) => void; mine?: boolean }) {
  return (
    <article className="feed-row">
      <div>
        <p className="post-blog">{post.blog.name}</p>
        <h2>
          <button onClick={() => go(`/post/${post.id}`)}>{post.title}</button>
        </h2>
        <p className="excerpt">{post.excerpt ?? post.content ?? "내용이 없습니다."}</p>
        <small>
          {post.author.nickname} · {post.status === "DRAFT" ? "임시저장" : new Date(post.publishedAt ?? post.updatedAt ?? "").toLocaleDateString("ko-KR")} {mine && `· ${post.status}`}
        </small>
      </div>
      <div className="row-stats" aria-label={`조회 ${post.viewCount}, 좋아요 ${post.likeCount}, 댓글 ${post.commentCount}, 북마크 ${post.bookmarkCount}`}>
        <span>
          <Eye size={14} /> {post.viewCount}
        </span>
        <span>
          <Heart size={14} /> {post.likeCount}
        </span>
        <span>
          <MessageCircle size={14} /> {post.commentCount}
        </span>
        <span>
          <Bookmark size={14} /> {post.bookmarkCount}
        </span>
      </div>
    </article>
  );
}
function Empty({ text, detail }: { text: string; detail?: string }) {
  return (
    <div className="empty-state">
      <FileText size={24} />
      <strong>{text}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
function ContentSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="content-skeleton" aria-label="콘텐츠를 불러오는 중">
      {Array.from({ length: rows }, (_, index) => (
        <div className="content-skeleton-row" key={index}>
          <span>
            <i />
            <i />
            <i />
          </span>
          <b />
        </div>
      ))}
    </div>
  );
}

function NotificationsPage({ go, user, onLogin }: { go: (to: string) => void; user: User; onLogin: () => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["notifications", "all", user.id, page],
    queryFn: () => request<NotificationData>(`/notifications?page=${page}&size=30`),
    refetchInterval: 30_000,
  });
  const refreshNotifications = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const open = async (item: NotificationItem) => {
    if (!item.read) await request(`/notifications/${item.id}/read`, { method: "PATCH" });
    await refreshNotifications();
    go(`/post/${item.post.id}${item.commentId ? `?comment=${item.commentId}` : ""}`);
  };
  const readAll = async () => {
    await request("/notifications/read-all", { method: "PATCH" });
    await refreshNotifications();
  };
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="notifications-page">
        <div className="section-inner">
          <header className="notifications-head">
            <div>
              <p className="eyebrow">NOTIFICATIONS</p>
              <h1>전체 알림</h1>
              <span>좋아요와 답글 소식을 확인하세요.</span>
            </div>
            {Boolean(query.data?.unreadCount) && <button onClick={readAll}>모두 읽음</button>}
          </header>
          {query.isPending ? (
            <ContentSkeleton rows={5} />
          ) : query.error ? (
            <Empty text="알림을 불러오지 못했습니다." detail={(query.error as Error).message} />
          ) : query.data?.items.length ? (
            <div className="notifications-list">
              {query.data.items.map((item) => (
                <button className={item.read ? "notification-item" : "notification-item unread"} key={item.id} onClick={() => open(item)}>
                  <span>{item.actor.nickname.slice(0, 1)}</span>
                  <div>
                    <p>
                      <b>{item.actor.nickname}</b>님이 {item.type === "LIKE" ? "회원님의 글을 좋아합니다." : "회원님의 댓글에 답글을 남겼습니다."}
                    </p>
                    <small>{item.post.title}</small>
                    <time>{notificationTime(item.createdAt)}</time>
                  </div>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <Empty text="아직 알림이 없습니다." detail="글에 좋아요가 달리거나 댓글에 답글이 달리면 알려드릴게요." />
          )}
          <ManagePager page={query.data?.pagination.page ?? page} total={query.data?.pagination.totalPages ?? 0} onPage={setPage} />
        </div>
      </main>
    </Shell>
  );
}

function Auth({ mode, go, onSuccess }: { mode: "login" | "signup"; go: (to: string) => void; onSuccess: (user: User, requiresThirdPartyConsent: boolean) => void }) {
  const [form, setForm] = useState({
    email: "",
    nickname: "",
    password: "",
    passwordConfirm: "",
    interests: [] as string[],
  });
  const [signupStep, setSignupStep] = useState<"account" | "interests">("account");
  const [interestStep, setInterestStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await request<{
        user: User;
        blog?: Blog | null;
        requiresThirdPartyConsent?: boolean;
      }>(`/auth/${signup ? "signup" : "login"}`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSuccess({ ...data.user, blog: data.blog ?? null }, data.requiresThirdPartyConsent === true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!signup)
    return (
      <main id="main" className="jungletory-auth-page">
        <button className="standalone-close" onClick={() => go("/")} aria-label="로그인 닫기">
          <X size={24} />
        </button>
        <section className="jungletory-auth-card credentials">
          <button className="login-wordmark" onClick={() => go("/")}>
            JUNGLETORY
          </button>
          <p className="credential-title">이메일로 로그인</p>
          <p className="login-description">회원가입할 때 등록한<br />이메일과 비밀번호를 입력하세요.</p>
          <form className="credential-form" onSubmit={submit}>
            <label>
              <span>이메일</span>
              <input required autoFocus type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </label>
            <label>
              <span>비밀번호</span>
              <input required minLength={8} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="비밀번호" />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="credential-submit" disabled={busy}>
              {busy ? "로그인 중…" : "로그인"}
            </button>
          </form>
          <div className="credential-links">
            <button onClick={() => go("/signup")}>회원가입</button>
            <span>회원가입한 이메일을 사용하세요</span>
          </div>
          <button className="credential-back" onClick={() => go("/")}>
            <ArrowLeft size={14} /> 홈으로
          </button>
        </section>
      </main>
    );

  const toggleInterest = (interest: string) =>
    setForm({
      ...form,
      interests: form.interests.includes(interest) ? form.interests.filter((item) => item !== interest) : form.interests.length < 8 ? [...form.interests, interest] : form.interests,
    });
  if (signupStep === "interests") {
    const group = interestGroups[interestStep];
    const last = interestStep === interestGroups.length - 1;
    return (
      <main id="main" className="auth-page interest-step-page">
        <form
          className="auth-panel interest-step-panel"
          onSubmit={
            last
              ? submit
              : (event) => {
                  event.preventDefault();
                  setInterestStep((step) => step + 1);
                }
          }
        >
          <header className="interest-step-top">
            <button type="button" className="auth-brand" onClick={() => go("/")}>
              정글토리
            </button>
            <span>관심분야 설정</span>
          </header>
          <nav className="interest-group-progress" aria-label="관심분야 선택 단계">
            {interestGroups.map((item, index) => (
              <button type="button" className={index === interestStep ? "active" : index < interestStep ? "done" : ""} onClick={() => setInterestStep(index)} key={item.title}>
                <b>{index + 1}</b>
                <span>{item.title}</span>
              </button>
            ))}
          </nav>
          <div className="interest-step-intro">
            <p className="eyebrow">INTERESTS · {String(interestStep + 1).padStart(2, "0")} / 04</p>
            <h1>{group.title}</h1>
            <p className="interest-step-description">{group.description}</p>
          </div>
          <div className="interest-step-heading">
            <strong>관심분야</strong>
            <span aria-live="polite">
              <b>{form.interests.length}</b>개 선택 <em>/ 최대 8개</em>
            </span>
          </div>
          <div className="interest-step-options" role="group" aria-label={`${group.title} 선택`}>
            {group.items.map((interest) => {
              const active = form.interests.includes(interest);
              return (
                <button type="button" aria-pressed={active} disabled={!active && form.interests.length >= 8} className={active ? "active" : ""} onClick={() => toggleInterest(interest)} key={interest}>
                  {active && <Check size={13} />}
                  <span>{interest}</span>
                </button>
              );
            })}
          </div>
          <p className={form.interests.length === 8 ? "interest-step-guide limit" : "interest-step-guide"}>{form.interests.length === 8 ? "최대 8개까지 선택할 수 있습니다." : "1개 이상, 최대 8개까지 선택해주세요."}</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="interest-step-actions">
            <button
              type="button"
              className="interest-step-back"
              onClick={() => {
                if (interestStep > 0) setInterestStep((step) => step - 1);
                else {
                  setSignupStep("account");
                  setError("");
                }
              }}
            >
              <ArrowLeft size={14} /> 이전
            </button>
            <button className="primary-button" disabled={busy || (last && !form.interests.length)}>
              {busy ? "처리 중…" : last ? "회원가입" : "다음"} <ArrowRight size={16} />
            </button>
          </footer>
        </form>
      </main>
    );
  }
  const advanceSignup = (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError("");
    setSignupStep("interests");
  };
  return (
    <main id="main" className="auth-page">
      <div className="auth-panel">
        <button className="auth-brand" onClick={() => go("/")}>
          정글토리
        </button>
        <p className="eyebrow">CREATE YOUR SPACE · STEP 01</p>
        <h1>
          나만의 이야기를
          <br />
          시작해보세요.
        </h1>
        <form onSubmit={advanceSignup}>
          <label>
            닉네임
            <input required minLength={2} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="닉네임을 입력하세요" />
          </label>
          <label>
            이메일
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </label>
          <label>
            비밀번호
            <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8자 이상 입력하세요" />
          </label>
          <label>
            비밀번호 확인
            <input required type="password" value={form.passwordConfirm} onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })} placeholder="비밀번호를 한 번 더 입력하세요" />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button">
            관심분야 선택 <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-switch">
          이미 계정이 있나요? <button onClick={() => go("/login")}>로그인</button>
        </p>
      </div>
    </main>
  );
}

function Agreement({ go, onDecided }: { go: (to: string) => void; onDecided: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const decide = async (accepted: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request("/me/third-party-consent", {
        method: "POST",
        body: JSON.stringify({ accepted }),
      });
      onDecided();
      go("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <main id="main" className="agreement-page">
      <section className="agreement-panel">
        <h1>[선택] 정글토리 개인정보 제 3자 제공동의</h1>
        <table>
          <tbody>
            <tr>
              <th>제공받는 자</th>
              <td>카카오</td>
            </tr>
            <tr>
              <th>제공 목적</th>
              <td>카카오 서비스 내 데이터 분석 및 통계화 처리, 개인화 된 콘텐츠 추천 및 광고 마케팅에 활용</td>
            </tr>
            <tr>
              <th>제공 항목</th>
              <td>블로그 방문, 활동 기록 등 정글토리 서비스 이용내역</td>
            </tr>
            <tr>
              <th>보유 및 이용 기간</th>
              <td>
                <strong>동의 철회 또는 회원 탈퇴 시 지체없이 파기</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          개인정보 제공에 대한 동의를 거부할 권리가 있으며, 동의를 거부하더라도 정글토리 서비스를 이용할 수 있습니다.
          <br />
          자세한 내용은 <button>개인정보처리방침</button>을 확인해주세요.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="agreement-actions">
          <button disabled={busy} onClick={() => decide(false)}>
            동의안함
          </button>
          <button disabled={busy} onClick={() => decide(true)}>
            {busy ? "처리 중…" : "동의"}
          </button>
        </div>
      </section>
    </main>
  );
}

function PasswordChange({ go, onDone }: { go: (to: string) => void; onDone: () => void }) {
  const [form, setForm] = useState({ currentPassword: "", password: "", passwordConfirm: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await request("/auth/change-password", { method: "POST", body: JSON.stringify(form) }); onDone(); go("/"); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <main className="jungletory-auth-page"><section className="jungletory-auth-card credentials"><strong className="login-wordmark">JUNGLETORY</strong><p className="credential-title">새 비밀번호 설정</p><p className="login-description">관리자가 발급한 임시 비밀번호를 변경해야 서비스를 계속 이용할 수 있습니다.</p><form className="credential-form" onSubmit={submit}><label><span>임시 비밀번호</span><input autoFocus required type="password" value={form.currentPassword} onChange={(e)=>setForm({...form,currentPassword:e.target.value})}/></label><label><span>새 비밀번호</span><input required minLength={8} type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})}/></label><label><span>새 비밀번호 확인</span><input required minLength={8} type="password" value={form.passwordConfirm} onChange={(e)=>setForm({...form,passwordConfirm:e.target.value})}/></label>{error&&<p className="form-error">{error}</p>}<button className="credential-submit" disabled={busy}>{busy?"변경 중…":"비밀번호 변경"}</button></form></section></main>;
}

function NoticeArticle({ go }: { go: (to: string) => void }) {
  return (
    <div className="notice-blog-page">
      <a className="skip-link" href="#notice-content">
        본문 바로가기
      </a>
      <header className="notice-blog-header">
        <button onClick={() => go("/")}>JUNGLETORY</button>
        <button className="notice-menu" aria-label="메뉴">
          <Menu size={22} />
        </button>
      </header>
      <main id="notice-content" className="notice-article">
        <div className="notice-inner">
          <div className="notice-title-group">
            <span className="notice-category">운영 정책 안내</span>
            <h1>[안내] 불법촬영물 유통 방지 조치 대상 확대 안내</h1>
            <p>
              <strong>JUNGLETORY</strong>
              <time>2026. 6. 25. 11:08</time>
            </p>
          </div>
          <article className="notice-body">
            <p>안녕하세요. 정글토리입니다.</p>
            <p>관련 법령에 따라 불법촬영물 등의 유통을 방지하고 이용자를 보호하기 위한 기술적·관리적 조치를 시행하고 있습니다.</p>
            <p>불법촬영물 유통 방지 조치의 적용 대상이 기존 동영상 파일에서 이미지 파일까지 확대됩니다. 새로운 의무가 추가되는 것이 아니라 기존 조치의 적용 범위가 이미지까지 넓어지는 변경입니다.</p>
            <p>정보통신망에서 불법촬영물을 유통하면 게시물 삭제와 검색 제한 등 필요한 조치가 적용되며 관련 법률에 따라 처벌될 수 있으니 서비스 이용 시 유의해 주세요.</p>
            <h2>— 다 음 —</h2>
            <dl className="notice-summary">
              <div>
                <dt>시행일자</dt>
                <dd>2026년 7월 1일부터</dd>
              </div>
              <div>
                <dt>확대 내용</dt>
                <dd>동영상 파일에 적용되던 식별·게재 제한·검색 제한 조치를 이미지 파일까지 확대 적용</dd>
              </div>
              <div>
                <dt>적용 조치</dt>
                <dd>
                  <ul>
                    <li>불법촬영물 신고 기능 제공 및 삭제 요청 처리</li>
                    <li>불법촬영물 식별 및 검색 제한</li>
                    <li>불법촬영물 식별 및 게재 제한</li>
                    <li>유통에 대한 사전 경고</li>
                    <li>기술적 조치에 관한 로그 기록 보관</li>
                  </ul>
                </dd>
              </div>
            </dl>
            <p className="notice-note">※ 이미지 식별 및 게재 제한 조치는 2026년 7월 1일부터 12월 31일까지 계도기간이 운영되며, 적용 일정은 변경될 수 있습니다.</p>
            <p>서비스에서 불법촬영물 유통을 발견했다면 해당 게시물의 신고 기능이나 유통 신고·삭제 요청 절차를 이용해 주세요. 접수된 내용은 검토 후 조치 결과를 안내합니다.</p>
            <p>안전한 디지털 환경을 위한 이용자 여러분의 관심과 참여를 부탁드립니다.</p>
            <p>감사합니다.</p>
          </article>
          <div className="notice-reactions">
            <button>♥　좋아요 257</button>
            <button>공유하기</button>
          </div>
          <section className="notice-related">
            <h2>'운영 정책 안내' 관련 글</h2>
            {["카카오 애드핏 신규 연동 신청 종료 안내", "동영상 백업 편의 기능 개선 알림", "동영상 백업 기간 연장 안내", "동영상 업로드 기능 조정 예정"].map((title) => (
              <button key={title}>
                <span>NO IMAGE</span>
                {title}
                <ChevronRight size={16} />
              </button>
            ))}
          </section>
        </div>
      </main>
      <footer className="notice-blog-footer">
        <strong>JUNGLETORY</strong>
        <span>정글토리의 새로운 소식을 전합니다.</span>
        <button onClick={() => go("/")}>정글토리 홈으로</button>
      </footer>
    </div>
  );
}

function BlogSetup({ go, onDone }: { go: (to: string) => void; onDone: (blog: Blog) => void }) {
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [checkedSlug, setCheckedSlug] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setError("");
    try {
      const data = await request<{
        slug: string;
        url: string;
        available: boolean;
      }>(`/blogs/check-slug?slug=${encodeURIComponent(form.slug)}`);
      setForm((current) => ({ ...current, slug: data.slug }));
      setCheckedSlug(data.slug);
      setPublicUrl(data.url);
      setAvailable(data.available);
    } catch (e) {
      setCheckedSlug("");
      setPublicUrl("");
      setAvailable(null);
      setError((e as Error).message);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!available || checkedSlug !== form.slug) {
      setError("블로그 주소 중복 확인을 완료해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const blog = await request<Blog>("/blogs", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onDone(blog);
    } catch (e) {
      setAvailable(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main id="main" className="setup-page">
      <div className="setup-panel">
        <button className="back-button" onClick={() => go("/")}>
          <ArrowLeft size={16} /> 홈으로
        </button>
        <p className="eyebrow">SET UP YOUR BLOG</p>
        <h1>
          이제 블로그를
          <br />
          만들어볼까요?
        </h1>
        <p className="muted">공개 주소와 이름은 나중에 변경할 수 없으니 신중하게 정해주세요.</p>
        <form onSubmit={submit}>
          <label>
            블로그 이름
            <input required minLength={2} maxLength={30} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 정글 개발 기록" />
          </label>
          <label>
            블로그 주소
            <div className="slug-field">
              <input
                required
                pattern="(?!.*--)[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?"
                value={form.slug}
                onChange={(e) => {
                  setForm({
                    ...form,
                    slug: e.target.value.trim().toLowerCase(),
                  });
                  setCheckedSlug("");
                  setPublicUrl("");
                  setAvailable(null);
                  setError("");
                }}
                placeholder="jungle-dev"
              />
              <span>.jungletory.com</span>
              <button type="button" onClick={check}>
                중복 확인
              </button>
            </div>
            {available !== null && <small className={available ? "available" : "unavailable"}>{available ? `사용할 수 있는 주소입니다: ${window.location.origin}${publicUrl}` : "이미 사용 중인 주소입니다."}</small>}
          </label>
          <label>
            블로그 소개 <span className="counter">{form.description.length}/160</span>
            <textarea maxLength={160} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="블로그를 한 줄로 소개해보세요." />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy || !available || checkedSlug !== form.slug}>
            {busy ? "생성 중…" : "블로그 만들기"} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </main>
  );
}

function BlogPage({ slug, go, user, onLogin }: { slug: string; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  type BlogData = {
    blog: Blog;
    posts: { items: Post[]; pagination: Page };
    market: { items: MarketItem[]; pagination: Page };
  };
  const blankPlaceholder = "\u00A0";
  const queryClient = useQueryClient();
  const queryKey = ["blog", slug] as const;
  const blogQuery = useQuery({
    queryKey,
    queryFn: () => request<BlogData>(`/blogs/${slug}?page=1&size=9`, {
      headers: { "X-Visitor-Id": getVisitorId() },
    }),
    refetchInterval: 30_000,
  });
  const data = blogQuery.data ?? null;
  const [mutationError, setMutationError] = useState("");
  const error = mutationError || (blogQuery.error instanceof Error ? blogQuery.error.message : "");
  const [busy, setBusy] = useState(false);
  const mine = Boolean(user && data?.blog.owner?.id === user.id);
  const toggleSubscription = async () => {
    if (!user) return onLogin();
    if (!data || mine) return;
    setBusy(true);
    try {
      const subscribed = Boolean(data.blog.isSubscribed);
      await request(`/blogs/${slug}/subscription`, {
        method: subscribed ? "DELETE" : "POST",
      });
      queryClient.setQueryData<BlogData>(queryKey, {
        ...data,
        blog: {
          ...data.blog,
          isSubscribed: !subscribed,
          subscriberCount: Math.max(0, (data.blog.subscriberCount ?? 0) + (subscribed ? -1 : 1)),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    } catch (e) {
      setMutationError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const posts = data?.posts.items ?? [];
  const market = data?.market.items ?? [];
  const official = slug === "admin" || data?.blog.isOfficial === true;
  const ownerName = data?.blog.owner?.nickname ?? slug;
  const statusLabel: Record<MarketItem["status"], string> = {
    SELLING: "판매 중",
    RESERVED: "예약",
    SOLD: "판매 완료",
  };
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="creator-blog-page">
        <div className="creator-blog-shell">
          {error && <p className="creator-blog-error">{error}</p>}
          <div className="creator-blog-top">
            <aside className={`creator-profile-panel${official ? " official-profile-panel" : ""}`}>
              {!official && <div className={`creator-profile-image${data?.blog.profileImageUrl ? " has-photo" : ""}`} style={data?.blog.profileImageUrl ? { backgroundImage: `url(${data.blog.profileImageUrl})` } : undefined} aria-label={`${ownerName} 프로필 이미지`} />}
              {!official && <p className="creator-kicker">CREATOR JOURNAL</p>}
              <h1 className="font-jua">{official ? "관리자" : data?.blog.name ?? slug}</h1>
              {!official && <span className="creator-handle">@{data?.blog.slug ?? slug}</span>}
              <p className="creator-description">{official ? "서비스 소식과 주요 안내를 전하는 공식 공지 블로그입니다." : data?.blog.description || blankPlaceholder}</p>
              {!official && <dl className="creator-stats">
                <div>
                  <dt className="font-jua">{data?.posts.pagination.totalItems ?? posts.length}</dt>
                  <dd className="font-jua">글</dd>
                </div>
                <div>
                  <dt className="font-jua">{data?.blog.subscriberCount ?? 0}</dt>
                  <dd className="font-jua">구독자</dd>
                </div>
                <div>
                  <dt className="font-jua">{data?.market.pagination.totalItems ?? market.length}</dt>
                  <dd className="font-jua">상품</dd>
                </div>
              </dl>}
              {official ? <span className="official-blog-badge"><i aria-hidden="true">T</i><span><b>공식 운영 블로그</b><small>Official notice channel</small></span></span> : mine ? (
                <button className="creator-subscribe font-jua" onClick={() => go("/blog/me/manage")}>
                  블로그 관리
                </button>
              ) : (
                <button className={`creator-subscribe font-jua${data?.blog.isSubscribed ? " active" : ""}`} disabled={busy || !data} onClick={toggleSubscription}>
                  {busy ? "처리 중…" : data?.blog.isSubscribed ? "구독 중 ✓" : "+ 구독하기"}
                </button>
              )}
            </aside>
            <section className="creator-editorial">
              <header className="creator-section-head">
                <div>
                  {!official && <p className="creator-kicker">LATEST STORIES</p>}
                  <h2 className="font-jua">{official ? "공지사항" : "요즘의 기록"}</h2>
                </div>
                {mine && !official && (
                  <div className="creator-section-actions">
                    <button className="font-jua" onClick={() => go("/market/new")}>새 상품 등록 ↗</button>
                    <button className="font-jua" onClick={() => go("/write")}>새 글 쓰기 ↗</button>
                  </div>
                )}
              </header>
              {blogQuery.isPending ? (
                <ContentSkeleton rows={3} />
              ) : posts.length ? (
                <div className="creator-editorial-grid">
                  <div className="creator-story-list">
                    {posts.slice(0, 3).map((post, index) => (
                      <button className="creator-story" key={post.id} onClick={() => go(official ? `/notice/${post.id}` : `/post/${post.id}`)}>
                        <small>{index === 0 ? "LATEST" : "STORY 0" + (index + 1)}</small>
                        <h3 className="font-jua">{post.title}</h3>
                        <time>
                          <span>{new Date(post.publishedAt ?? post.updatedAt ?? "").toLocaleDateString("ko-KR")}</span>
                          <span>조회 {post.viewCount}</span>
                        </time>
                      </button>
                    ))}
                  </div>
                  <div className="creator-gallery" aria-label="최근 글 갤러리">
                    {posts.slice(0, 9).map((post, index) => (
                      <button className={`creator-gallery-tile creator-tone-${index % 9}${post.thumbnailUrl ? " has-image" : ""}`} key={post.id} onClick={() => go(official ? `/notice/${post.id}` : `/post/${post.id}`)}>
                        {post.thumbnailUrl ? <ProgressiveImage src={post.thumbnailUrl} alt="" /> : <i />}
                        <span className="font-jua">{post.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty text="아직 발행된 글이 없습니다." detail={mine ? "첫 글을 작성해 블로그를 채워보세요." : undefined} />
              )}
            </section>
          </div>
          {!official && <section className="creator-shop">
            <header className="creator-section-head">
              <div>
                <p className="creator-kicker">CURATOR'S SHOP</p>
                <h2 className="font-jua">{data?.blog.shopName || "취향을 나누는 상점"}</h2>
                <span>{data?.blog.shopDescription || blankPlaceholder}</span>
              </div>
              {mine ? <button onClick={() => go("/blog/me/manage/market")}>내 상품 관리 ↗</button> : <button onClick={() => go("/market")}>마켓 둘러보기 ↗</button>}
            </header>
            {market.length ? (
              <div className="creator-product-grid">
                {market.map((item, index) => (
                  <button className={`creator-product creator-tone-${(index + 2) % 9}${item.thumbnailUrl ? " has-image" : ""}`} key={item.id} onClick={() => go(`/market/${item.id}`)}>
                    {item.thumbnailUrl ? <ProgressiveImage src={item.thumbnailUrl} alt="" /> : <i />}
                    <span>
                      <em>{statusLabel[item.status]}</em>
                      <strong>{item.title}</strong>
                      <b>{item.pricePoints.toLocaleString()} P</b>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty text="아직 등록된 상품이 없습니다." detail={mine ? "상품을 등록하면 내 블로그 상점에도 자동으로 표시됩니다." : undefined} />
            )}
          </section>}
        </div>
      </main>
    </Shell>
  );
}

function Editor({ id, go, user }: { id?: string; go: (to: string) => void; user: User }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentDocument, setContentDocument] = useState<RichDocument | null>(null);
  const contentRef = useRef("");
  const contentDocumentRef = useRef<RichDocument | null>(null);
  const getCurrentDocumentRef = useRef<(() => RichDocument) | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [classificationIds, setClassificationIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [classifications, setClassifications] = useState<BlogClassification[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorReady, setEditorReady] = useState(!id);
  const [draftKey] = useState(() => crypto.randomUUID());
  const [classificationError, setClassificationError] = useState("");
  const [classificationBusy, setClassificationBusy] = useState(false);
  const [newClassification, setNewClassification] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const interests = user.interests?.length ? user.interests : interestCatalog;
  const loadTaxonomy = () =>
    Promise.all([request<BlogCategory[]>("/blogs/me/categories"), request<BlogClassification[]>("/blogs/me/classifications")])
      .then(([nextCategories, nextClassifications]) => {
        setCategories(nextCategories);
        if (!id) setCategoryId(nextCategories.find((item) => item.isDefault)?.id ?? nextCategories[0]?.id ?? null);
        setClassifications(nextClassifications);
        setClassificationError("");
      })
      .catch((error) => setClassificationError(error.message));
  useEffect(() => {
    loadTaxonomy();
    if (id)
      request<Post>(`/posts/${id}`)
        .then((post) => {
          setTitle(post.title);
          setContent(post.content ?? "");
          setContentDocument(post.contentDocument ?? null);
          contentRef.current = post.content ?? "";
          contentDocumentRef.current = post.contentDocument ?? null;
          setCategoryId(post.category?.id ?? null);
          setClassificationIds(post.classifications.map((item) => item.id));
          setEditorReady(true);
        })
        .catch((error) => {
          setError(error.message);
          setEditorReady(false);
        });
  }, [id]);
  const aiEditorMilestones = useRef({ title: false, body: false, classification: false });
  useEffect(() => {
    if (title.trim() && !aiEditorMilestones.current.title) {
      aiEditorMilestones.current.title = true;
      emitAiActivity({ type: "post_progress", milestone: "title" });
    }
  }, [title]);
  useEffect(() => {
    if (content.trim().length >= 30 && !aiEditorMilestones.current.body) {
      aiEditorMilestones.current.body = true;
      emitAiActivity({ type: "post_progress", milestone: "body" });
    }
  }, [content]);
  useEffect(() => {
    const hasInterest = classifications.some((item) => item.source === "INTEREST" && classificationIds.includes(item.id));
    if (hasInterest && !aiEditorMilestones.current.classification) {
      aiEditorMilestones.current.classification = true;
      emitAiActivity({ type: "post_progress", milestone: "classification" });
    }
  }, [classificationIds, classifications]);
  const toggleClassification = (classificationId: number) => setClassificationIds((ids) => (ids.includes(classificationId) ? ids.filter((value) => value !== classificationId) : ids.length < 5 ? [...ids, classificationId] : ids));
  const createClassification = async (name: string, source: BlogClassification["source"]) => {
    const normalizedName = name.trim().toLocaleLowerCase("ko-KR");
    const existing = classifications.find((item) => item.name.trim().toLocaleLowerCase("ko-KR") === normalizedName);
    if (existing && (existing.source === source || source === "CUSTOM")) {
      toggleClassification(existing.id);
      return existing;
    }
    setClassificationBusy(true);
    try {
      const created = await request<BlogClassification>("/blogs/me/classifications", { method: "POST", body: JSON.stringify({ name, source }) });
      setClassifications((items) => [...items.filter((item) => item.id !== created.id), created]);
      setClassificationIds((ids) => (ids.includes(created.id) ? ids : [...ids, created.id].slice(0, 5)));
      return created;
    } catch (error) {
      setClassificationError((error as Error).message);
    } finally {
      setClassificationBusy(false);
    }
  };
  const addInterest = (name: string) => createClassification(name, "INTEREST");
  const addCustom = async (event: FormEvent) => {
    event.preventDefault();
    const name = newClassification.trim();
    if (!name) return;
    await createClassification(name, "CUSTOM");
    setNewClassification("");
  };
  const removeClassification = async (item: BlogClassification) => {
    if (item.source !== "CUSTOM") return;
    setClassificationBusy(true);
    setClassificationError("");
    try {
      await request(`/blogs/me/classifications/${item.id}`, {
        method: "DELETE",
      });
      setClassifications((items) => items.filter((value) => value.id !== item.id));
      setClassificationIds((ids) => ids.filter((value) => value !== item.id));
    } catch (error) {
      setClassificationError((error as Error).message);
    } finally {
      setClassificationBusy(false);
    }
  };
  const uploadImage = async (file: File, width: number, height: number) => {
    const form = new FormData();
    form.append("file", file);
    form.append("draftKey", draftKey);
    form.append("width", String(width));
    form.append("height", String(height));
    return request<UploadedPostImage>("/posts/images", {
      method: "POST",
      body: form,
    });
  };
  const deleteImage = (imageId: string) => request<void>(`/posts/images/${imageId}`, { method: "DELETE" });
  const save = async (status: "DRAFT" | "PUBLISHED") => {
    if (uploading || busy || classificationBusy) return;
    setBusy(true);
    setError("");
    try {
      const latestDocument = getCurrentDocumentRef.current?.() ?? contentDocumentRef.current;
      const body = JSON.stringify({
        title,
        contentText: contentRef.current,
        contentDocument: latestDocument,
        draftKey,
        status,
        categoryId,
        classificationIds,
      });
      const post = id ? await request<Post>(`/posts/${id}`, { method: "PATCH", body }) : await request<Post>("/posts", { method: "POST", body });
      emitAiActivity({
        type: "post_saved",
        status,
        titleLength: title.trim().length,
        contentLength: content.trim().length,
        interestClassificationCount: classifications.filter((item) => item.source === "INTEREST" && classificationIds.includes(item.id)).length,
      });
      go(status === "PUBLISHED" ? `/post/${post.id}` : "/blog/me/manage/posts?status=DRAFT&page=1");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main id="main" className="editor-page">
      <div className="editor-top">
        <button onClick={() => go("/blog/me/manage/posts")}>
          <ArrowLeft size={17} /> 나가기
        </button>
        <div>
          {uploading && <span className="editor-upload-state">이미지 처리 중…</span>}
          <button className="save-button" disabled={busy || uploading || classificationBusy} onClick={() => save("DRAFT")}>
            임시저장
          </button>
          <button className="publish-button" disabled={busy || uploading || classificationBusy} onClick={() => save("PUBLISHED")}>
            발행하기
          </button>
        </div>
      </div>
      <div
        className="editor-body"
        onPointerDownCapture={(event) => {
          if (!(event.target as Element).closest(".editor-taxonomy-category")) setCategoryPickerOpen(false);
          if (!(event.target as Element).closest(".editor-taxonomy-classification")) setPickerOpen(false);
        }}
      >
        <section className={`editor-taxonomy-bar${pickerOpen || categoryPickerOpen ? " is-picker-open" : ""}`}>
          <div className="editor-taxonomy-category">
            <span>카테고리</span>
            <button
              type="button"
              className="editor-category-trigger"
              aria-expanded={categoryPickerOpen}
              onClick={() => {
                setCategoryPickerOpen((open) => !open);
                setPickerOpen(false);
              }}
            >
              {categories.find((item) => item.id === categoryId)?.name ?? "카테고리 없음"}
              <ChevronDown size={14} />
            </button>
            {categoryPickerOpen && (
              <div className="editor-category-popover simple category-options">
                <div className="editor-category-list" role="listbox" aria-label="카테고리 선택">
                  <p>카테고리 선택</p>
                  <button
                    type="button"
                    role="option"
                    aria-selected={categoryId === null}
                    onClick={() => {
                      setCategoryId(null);
                      setCategoryPickerOpen(false);
                    }}
                  >
                    카테고리 없음
                    {categoryId === null && <Check size={13} />}
                  </button>
                  {categories.map((item) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={categoryId === item.id}
                      onClick={() => {
                        setCategoryId(item.id);
                        setCategoryPickerOpen(false);
                      }}
                      key={item.id}
                    >
                      {item.name}
                      {categoryId === item.id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="editor-taxonomy-classification">
            <span>
              분류 <small>{classificationIds.length}/5</small>
            </span>
            <button type="button" className="editor-category-trigger" aria-expanded={pickerOpen} onClick={() => { setPickerOpen(!pickerOpen); setCategoryPickerOpen(false); }}>
              {classificationIds.length
                ? classifications
                    .filter((item) => classificationIds.includes(item.id))
                    .map((item) => `#${item.name}`)
                    .join(" · ")
                : "분류 선택"}{" "}
              <ChevronDown size={14} />
            </button>
            {pickerOpen && (
              <div className="editor-category-popover simple">
                <div className="editor-category-list">
                  <p>직접 만든 분류</p>
                  {classifications
                    .filter((item) => item.source === "CUSTOM")
                    .map((item) => (
                      <div className="editor-category-list-row" key={item.id}>
                        <button type="button" aria-pressed={classificationIds.includes(item.id)} disabled={classificationBusy || (!classificationIds.includes(item.id) && classificationIds.length >= 5)} onClick={() => toggleClassification(item.id)}>
                          {item.name}
                          {classificationIds.includes(item.id) && <Check size={13} />}
                        </button>
                        <button type="button" className="editor-category-remove" disabled={classificationBusy} onClick={() => removeClassification(item)} aria-label={`${item.name} 분류 삭제`}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  <p>관심분야</p>
                  {interests.map((name) => {
                    const item = classifications.find((value) => value.source === "INTEREST" && value.name === name);
                    const selected = item ? classificationIds.includes(item.id) : false;
                    return (
                      <button type="button" aria-pressed={selected} disabled={classificationBusy || (!selected && classificationIds.length >= 5)} onClick={() => (item ? toggleClassification(item.id) : addInterest(name))} key={name}>
                        {name}
                        {selected && <Check size={13} />}
                      </button>
                    );
                  })}
                </div>
                <form className="editor-category-add" onSubmit={addCustom}>
                  <input maxLength={30} value={newClassification} onChange={(event) => setNewClassification(event.target.value)} placeholder="새 분류 이름" />
                  <button disabled={!newClassification.trim() || classificationBusy || classificationIds.length >= 5}>추가</button>
                </form>
              </div>
            )}
          </div>
          {classificationError && (
            <p className="editor-category-error">
              {classificationError}{" "}
              <button type="button" onClick={loadTaxonomy}>
                다시 시도
              </button>
            </p>
          )}
        </section>
        <input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목을 입력하세요" maxLength={100} />
        <div className="editor-count">
          {title.length}/100 · {content.length.toLocaleString()}/20,000
        </div>
        {editorReady ? (
          <RichTextEditor
            value={contentDocument}
            legacyText={content}
            draftKey={draftKey}
            onChange={(document, text) => {
              contentDocumentRef.current = document;
              contentRef.current = text;
              setContentDocument(document);
              setContent(text);
            }}
            onUpload={uploadImage}
            onDelete={deleteImage}
            onUploading={setUploading}
            onDocumentReady={(getDocument) => {
              getCurrentDocumentRef.current = getDocument;
            }}
          />
        ) : (
          <div className="editor-loading" aria-live="polite">본문을 불러오는 중…</div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </main>
  );
}

function PostDetail({ id, go, user, onLogin }: { id: string; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const queryClient = useQueryClient();
  const postQueryKey = ["post", id] as const;
  const postQuery = useQuery({
    queryKey: postQueryKey,
    queryFn: () => request<Post>(`/posts/${id}`),
    refetchInterval: 30_000,
  });
  const post = postQuery.data ?? null;
  const setPost = (updater: (current: Post | null) => Post | null) => queryClient.setQueryData<Post | null>(postQueryKey, (current) => updater(current ?? null));
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [anonymousComment, setAnonymousComment] = useState(false);
  const [reactionBusy, setReactionBusy] = useState<"like" | "bookmark" | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const loadComments = () =>
    requestList<Comment>(`/posts/${id}/comments?page=1&size=100`)
      .then((result) => setComments(result.data))
      .catch((error) => setError(error.message));
  useEffect(() => {
    loadComments();
  }, [id]);
  const mine = post && user?.id === post.author.id;
  const remove = async () => {
    if (!post || !confirm("이 글을 삭제할까요?")) return;
    try {
      await request(`/posts/${post.id}`, { method: "DELETE" });
      go(`/blog/${post.blog.slug}`);
    } catch (error) {
      setError((error as Error).message);
    }
  };
  const toggle = async (kind: "like" | "bookmark") => {
    if (!user) return onLogin();
    if (!post || reactionBusy) return;
    const active = kind === "like" ? post.isLiked : post.isBookmarked;
    setReactionBusy(kind);
    setError("");
    try {
      await request(`/posts/${post.id}/${kind}`, {
        method: active ? "DELETE" : "POST",
      });
      setPost((current) =>
        current
          ? {
              ...current,
              ...(kind === "like"
                ? {
                    isLiked: !active,
                    likeCount: Math.max(0, current.likeCount + (active ? -1 : 1)),
                  }
                : {
                    isBookmarked: !active,
                    bookmarkCount: Math.max(0, current.bookmarkCount + (active ? -1 : 1)),
                  }),
            }
          : current,
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setReactionBusy(null);
    }
  };
  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return onLogin();
    if (!post || !comment.trim() || commentBusy) return;
    setCommentBusy(true);
    setError("");
    try {
      await request<Comment>(`/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: comment,
          parentId: replyTo,
          anonymous: anonymousComment,
        }),
      });
      setComment("");
      setReplyTo(null);
      setPost((current) => (current ? { ...current, commentCount: current.commentCount + 1 } : current));
      await loadComments();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setCommentBusy(false);
    }
  };
  const saveComment = async (item: Comment) => {
    const body = editingBody.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true);
    setError("");
    try {
      const updated = await request<Comment>(`/comments/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      });
      setComments((current) => current.map((value) => (value.id === item.id ? updated : value)));
      setEditingCommentId(null);
      setEditingBody("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setCommentBusy(false);
    }
  };
  const removeComment = async (item: Comment) => {
    if (commentBusy || !confirm("댓글을 삭제할까요?")) return;
    setCommentBusy(true);
    setError("");
    try {
      await request(`/comments/${item.id}`, { method: "DELETE" });
      setPost((current) => (current && !item.deleted ? { ...current, commentCount: Math.max(0, current.commentCount - 1) } : current));
      await loadComments();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setCommentBusy(false);
    }
  };
  const renderComment = (item: Comment) => (
    <article className={`post-comment${item.parentId ? " reply" : ""}`} key={item.id}>
      <div>
        <strong>{item.author.nickname}</strong>
        {item.anonymous && <Lock size={11} aria-label="익명 댓글" />}
        <time>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</time>
      </div>
      {editingCommentId === item.id ? (
        <form
          className="comment-edit"
          onSubmit={(event) => {
            event.preventDefault();
            saveComment(item);
          }}
        >
          <textarea autoFocus maxLength={1000} value={editingBody} onChange={(event) => setEditingBody(event.target.value)} />
          <div>
            <button
              type="button"
              onClick={() => {
                setEditingCommentId(null);
                setEditingBody("");
              }}
            >
              취소
            </button>
            <button disabled={commentBusy || !editingBody.trim()}>저장</button>
          </div>
        </form>
      ) : (
        <p>{item.body}</p>
      )}
      {!item.deleted && editingCommentId !== item.id && (
        <footer>
          {!item.parentId && (
            <button
              onClick={() => {
                if (!user) return onLogin();
                setReplyTo(item.id);
                setComment("");
              }}
            >
              답글
            </button>
          )}
          {user?.id === item.author.id && (
            <>
              <button
                onClick={() => {
                  setEditingCommentId(item.id);
                  setEditingBody(item.body);
                }}
              >
                수정
              </button>
              <button disabled={commentBusy} onClick={() => removeComment(item)}>
                삭제
              </button>
            </>
          )}
        </footer>
      )}
    </article>
  );
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="detail-page">
        <div className="detail-inner">
          {(error || postQuery.error) && (
            <p className="form-error" role="alert">
              {error || (postQuery.error as Error).message}
            </p>
          )}
          {postQuery.isPending ? (
            <ContentSkeleton rows={4} />
          ) : (
            post && (
              <>
                {mine && (
                  <div className="post-owner-actions" aria-label="게시글 관리">
                    <button onClick={() => go(`/post/${post.id}/edit`)}>
                      <Pencil size={12} /> 수정
                    </button>
                    <button onClick={remove}>
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                )}
                <div className="detail-tags">
                  {post.classifications.map((item) => (
                    <span key={item.id}>#{item.name}</span>
                  ))}
                </div>
                <p className="eyebrow">{post.blog.name}</p>
                <h1>{post.title}</h1>
                <div className="detail-info">
                  <span>{post.author.nickname}</span>
                  <span>{new Date(post.publishedAt ?? post.updatedAt ?? "").toLocaleDateString("ko-KR")}</span>
                  <span>
                    <Eye size={14} /> {post.viewCount}
                  </span>
                </div>
                <div className="detail-content">
                  <RichContent document={post.contentDocument} fallback={post.content} />
                </div>
                <div className="post-engagement">
                  <button aria-pressed={post.isLiked} aria-label={`좋아요 ${post.likeCount}개`} disabled={Boolean(reactionBusy)} className={post.isLiked ? "active" : ""} onClick={() => toggle("like")}>
                    <Heart size={16} fill={post.isLiked ? "currentColor" : "none"} /> 좋아요 {post.likeCount}
                  </button>
                  <button aria-pressed={post.isBookmarked} aria-label={`북마크 ${post.bookmarkCount}개`} disabled={Boolean(reactionBusy)} className={post.isBookmarked ? "active" : ""} onClick={() => toggle("bookmark")}>
                    <Bookmark size={16} fill={post.isBookmarked ? "currentColor" : "none"} /> 북마크 {post.bookmarkCount}
                  </button>
                  <span>
                    <MessageCircle size={16} /> 댓글 {post.commentCount}
                  </span>
                </div>
                <section className="post-comments">
                  <header>
                    <h2>댓글과 답글</h2>
                    <span>{post.commentCount}</span>
                  </header>
                  <form onSubmit={submitComment}>
                    {replyTo && (
                      <p>
                        <b>
                          {comments.find((item) => item.id === replyTo)?.author.nickname}
                          님에게 답글 작성 중
                        </b>
                        <button type="button" onClick={() => setReplyTo(null)}>
                          취소
                        </button>
                      </p>
                    )}
                    <textarea maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={user ? "팬들과 이야기를 나눠보세요." : "로그인 후 댓글을 작성할 수 있습니다."} />
                    {user && (
                      <label className={`anonymous-comment-toggle${anonymousComment ? " active" : ""}`}>
                        <input type="checkbox" checked={anonymousComment} onChange={(event) => setAnonymousComment(event.target.checked)} />
                        <Lock size={12} /> 익명으로 남기기
                      </label>
                    )}
                    <button disabled={commentBusy || (Boolean(user) && !comment.trim())}>{commentBusy ? "처리 중…" : user ? "등록" : "로그인"}</button>
                  </form>
                  <div>
                    {comments
                      .filter((item) => !item.parentId)
                      .map((parent) => (
                        <div key={parent.id}>
                          {renderComment(parent)}
                          {comments.filter((item) => item.parentId === parent.id).map(renderComment)}
                        </div>
                      ))}
                  </div>
                </section>
              </>
            )
          )}
        </div>
      </main>
    </Shell>
  );
}

type Dashboard = {
  blog: Blog;
  counts: {
    posts: { total: number; published: number; draft: number; trash: number };
    market: {
      total: number;
      selling: number;
      reserved: number;
      sold: number;
      trash: number;
    };
    subscribers: number;
  };
  recentPosts: Post[];
  recentMarketItems: MarketItem[];
};

function CropModal({ source, onClose, onDone }: { source: string; onClose: () => void; onDone: (file: File, preview: string) => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [busy, setBusy] = useState(false);
  const crop = async () => {
    const image = imageRef.current;
    if (!image) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const base = Math.max(512 / image.naturalWidth, 512 / image.naturalHeight);
    const scale = base * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, (512 - width) / 2 + x, (512 - height) / 2 + y, width, height);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob || blob.size > 2 * 1024 * 1024) return alert("변환된 이미지가 2MB를 초과합니다.");
        const file = new File([blob], "profile.webp", { type: "image/webp" });
        onDone(file, URL.createObjectURL(blob));
      },
      "image/webp",
      0.85,
    );
  };
  return (
    <div className="manage-modal" role="dialog" aria-modal="true" aria-label="프로필 이미지 자르기">
      <div className="crop-dialog">
        <header>
          <div>
            <p className="eyebrow">PROFILE IMAGE</p>
            <h2>보일 영역을 조정하세요</h2>
          </div>
          <button onClick={onClose} aria-label="닫기">
            <X />
          </button>
        </header>
        <div className="crop-stage">
          <img ref={imageRef} src={source} alt="선택한 프로필" style={{ transform: `translate(${x}px,${y}px) scale(${zoom})` }} />
        </div>
        <div className="crop-controls">
          <label>
            확대 <input type="range" min="1" max="3" step=".05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <label>
            가로 <input type="range" min="-120" max="120" value={x} onChange={(e) => setX(Number(e.target.value))} />
          </label>
          <label>
            세로 <input type="range" min="-120" max="120" value={y} onChange={(e) => setY(Number(e.target.value))} />
          </label>
        </div>
        <footer>
          <button onClick={onClose}>취소</button>
          <button className="manage-primary" disabled={busy} onClick={crop}>
            {busy ? "변환 중…" : "적용하기"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function MarketImageCropModal({ file, remaining, onCancel, onDone }: { file: File; remaining: number; onCancel: () => void; onDone: (file: File) => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    lastX: number;
    lastY: number;
  } | null>(null);
  const [box, setBox] = useState({ x: 70, y: 30, size: 300 });
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [source, setSource] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setSource(next);
    setImageError(false);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const imageBounds = () => {
    const image = imageRef.current;
    const stage = stageRef.current;
    if (!image || !stage) return null;
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const scale = Math.min(stageWidth / image.naturalWidth, stageHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    return {
      x: (stageWidth - width) / 2,
      y: (stageHeight - height) / 2,
      width,
      height,
      scale,
    };
  };
  const resetBox = () => {
    const bounds = imageBounds();
    if (!bounds) return;
    const size = Math.min(bounds.width, bounds.height) * 0.78;
    setBox({
      x: bounds.x + (bounds.width - size) / 2,
      y: bounds.y + (bounds.height - size) / 2,
      size,
    });
  };
  const point = (event: ReactPointerEvent) => {
    const native = event.nativeEvent;
    const x = [event.clientX, event.pageX, native.clientX, native.pageX, native.screenX].find(Number.isFinite) ?? 0;
    const y = [event.clientY, event.pageY, native.clientY, native.pageY, native.screenY].find(Number.isFinite) ?? 0;
    return { x, y };
  };
  const beginDrag = (event: ReactPointerEvent, mode: "move" | "resize") => {
    event.preventDefault();
    event.stopPropagation();
    const current = point(event);
    stageRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { mode, lastX: current.x, lastY: current.y };
  };
  const moveDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    const bounds = imageBounds();
    if (!drag || !bounds) return;
    event.preventDefault();
    const current = point(event);
    const native = event.nativeEvent;
    const dx = current.x !== drag.lastX ? current.x - drag.lastX : Number.isFinite(native.movementX) ? native.movementX : 0;
    const dy = current.y !== drag.lastY ? current.y - drag.lastY : Number.isFinite(native.movementY) ? native.movementY : 0;
    drag.lastX = current.x;
    drag.lastY = current.y;
    if (!dx && !dy) return;
    setBox((previous) => {
      if (drag.mode === "move")
        return {
          ...previous,
          x: Math.min(bounds.x + bounds.width - previous.size, Math.max(bounds.x, previous.x + dx)),
          y: Math.min(bounds.y + bounds.height - previous.size, Math.max(bounds.y, previous.y + dy)),
        };
      const maxSize = Math.min(bounds.x + bounds.width - previous.x, bounds.y + bounds.height - previous.y);
      return {
        ...previous,
        size: Math.min(maxSize, Math.max(72, previous.size + Math.max(dx, dy))),
      };
    });
  };
  const endDrag = (event: ReactPointerEvent) => {
    dragRef.current = null;
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId);
  };
  const crop = () => {
    const image = imageRef.current;
    const bounds = imageBounds();
    if (!image || !bounds) return;
    setBusy(true);
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    const sourceX = (box.x - bounds.x) / bounds.scale;
    const sourceY = (box.y - bounds.y) / bounds.scale;
    const sourceSize = box.size / bounds.scale;
    ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) return;
        onDone(
          new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
            type: "image/webp",
          }),
        );
      },
      "image/webp",
      0.88,
    );
  };
  return (
    <div className="manage-modal market-crop-modal" role="dialog" aria-modal="true" aria-labelledby="market-crop-title">
      <div className="market-crop-dialog">
        <header>
          <div>
            <p className="eyebrow">PRODUCT IMAGE</p>
            <h2 id="market-crop-title">자를 영역을 선택하세요</h2>
            <span>
              네모를 움직이거나 모서리를 끌어 크기를 조절하세요.
              {remaining > 1 ? ` · ${remaining}장 남음` : ""}
            </span>
          </div>
          <button type="button" onClick={onCancel} aria-label="이미지 자르기 닫기">
            <X size={19} />
          </button>
        </header>
        <div ref={stageRef} className="market-crop-stage" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <img
            ref={imageRef}
            src={source}
            alt="자를 상품 이미지"
            onLoad={() => {
              setImageError(false);
              resetBox();
            }}
            onError={() => setImageError(true)}
            draggable={false}
          />
          {imageError && (
            <p className="market-crop-error">
              이미지를 불러오지 못했습니다.
              <small>JPG, PNG 또는 WebP 파일을 다시 선택해 주세요.</small>
            </p>
          )}
          <div className="market-crop-mask top" style={{ height: box.y }} />
          <div className="market-crop-mask left" style={{ top: box.y, width: box.x, height: box.size }} />
          <div
            className="market-crop-mask right"
            style={{
              top: box.y,
              left: box.x + box.size,
              right: 0,
              height: box.size,
            }}
          />
          <div className="market-crop-mask bottom" style={{ top: box.y + box.size }} />
          <div
            className="market-crop-selection"
            style={{
              left: box.x,
              top: box.y,
              width: box.size,
              height: box.size,
            }}
            onPointerDown={(event) => beginDrag(event, "move")}
          >
            <span aria-hidden="true" />
            <button type="button" aria-label="자르기 영역 크기 조절" onPointerDown={(event) => beginDrag(event, "resize")} />
          </div>
        </div>
        <p className="market-crop-help">선택 영역을 드래그 · 모서리 핸들로 크기 조절</p>
        <footer>
          <button type="button" onClick={onCancel}>
            나머지 취소
          </button>
          <button type="button" disabled={busy || imageError} onClick={crop}>
            {busy ? "변환 중…" : remaining > 1 ? "적용 후 다음" : "적용하기"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Manage({ path, go, user, onLogin, onUserChange, onWithdraw }: { path: string; go: (to: string) => void; user: User | null; onLogin: () => void; onUserChange: (user: User) => void; onWithdraw: () => void }) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    request<Blog>("/blogs/me")
      .then(setBlog)
      .catch((e) => setError(e.message));
  }, []);
  if (!user)
    return (
      <Shell go={go} user={user} onLogin={onLogin}>
        <main className="manage-auth">
          <Empty text="로그인이 필요합니다." detail="관리 콘솔은 블로그 소유자만 사용할 수 있습니다." />
          <button className="manage-primary" onClick={onLogin}>
            로그인
          </button>
        </main>
      </Shell>
    );
  const section = path.split("/")[4] || "overview";
  const nav = [
    ["overview", "운영 요약", LayoutDashboard],
    ["settings", "블로그 설정", Settings],
    ["interests", "관심분야", Sparkles],
    ["categories", "카테고리", Tags],
    ["posts", "글 관리", FileText],
    ["market", "마켓 관리", Package],
    ["trash", "휴지통", Trash2],
  ] as const;
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="manage-console">
        <aside className="manage-sidebar">
          <p>MANAGEMENT</p>
          <nav>
            {nav.map(([key, label, Icon]) => (
              <button className={`font-jua ${section === key ? "active" : ""}`} key={key} onClick={() => go(key === "overview" ? "/blog/me/manage" : `/blog/me/manage/${key}`)}>
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="manage-workspace">
          <header className="manage-console-head">
            <div>
              <p className="eyebrow">MY JUNGLETORY</p>
              <h1 className="font-jua">{nav.find(([key]) => key === section)?.[1] ?? "블로그 관리"}</h1>
              <span>{blog?.name ?? "블로그 정보를 불러오는 중입니다."}</span>
            </div>
            <div>
              <button onClick={() => go("/write")}>
                <PenLine size={15} /> 새 글
              </button>
              <button onClick={() => go("/market/new")}>
                <Package size={15} /> 상품 등록
              </button>
              <button onClick={() => blog && go(`/blog/${blog.slug}`)}>
                내 블로그 <ArrowRight size={15} />
              </button>
            </div>
          </header>
          {error && <p className="manage-error">{error}</p>}
          {section === "overview" && <ManageOverview go={go} />}
          {section === "settings" && blog && <ManageSettings blog={blog} setBlog={setBlog} user={user} onUserChange={onUserChange} onWithdraw={onWithdraw} />}
          {section === "interests" && <ManageInterests user={user} onUserChange={onUserChange} />}
          {section === "categories" && <ManageCategories go={go} />}
          {section === "posts" && <ManagePosts go={go} />}
          {section === "market" && <ManageMarket go={go} />}
          {section === "trash" && <ManageTrash />}
        </section>
      </main>
    </Shell>
  );
}

function ManageOverview({ go }: { go: (to: string) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    request<Dashboard>("/blogs/me/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <Empty text={error} detail="잠시 후 다시 시도해 주세요." />;
  if (!data) return <div className="manage-loading">운영 현황을 불러오는 중…</div>;
  const stats = [
    ["전체 글", data.counts.posts.total],
    ["발행", data.counts.posts.published],
    ["임시저장", data.counts.posts.draft],
    ["구독자", data.counts.subscribers],
    ["전체 상품", data.counts.market.total],
    ["판매 중", data.counts.market.selling],
    ["예약", data.counts.market.reserved],
    ["판매 완료", data.counts.market.sold],
    ["휴지통", data.counts.posts.trash + data.counts.market.trash],
  ];
  return (
    <div className="manage-overview">
      <div className="manage-stat-grid">
        {stats.map(([label, value]) => (
          <div key={label}>
            <span className="font-jua">{label}</span>
            <strong className="font-jua">{value}</strong>
          </div>
        ))}
      </div>
      <div className="manage-overview-grid">
        <section>
          <header>
            <h2 className="font-jua">최근 수정 글</h2>
            <button onClick={() => go("/blog/me/manage/posts")}>전체 보기</button>
          </header>
          {data.recentPosts.length ? (
            data.recentPosts.map((post) => (
              <button className="manage-recent-row" key={post.id} onClick={() => go(`/post/${post.id}/edit`)}>
                <span>
                  <b>{post.title}</b>
                  <small>
                    {post.category?.name ?? "미분류"} · {post.status === "PUBLISHED" ? "발행" : "임시저장"}
                  </small>
                </span>
                <time>{new Date(post.updatedAt ?? "").toLocaleDateString("ko-KR")}</time>
              </button>
            ))
          ) : (
            <p className="manage-empty-copy">최근 글이 없습니다.</p>
          )}
        </section>
        <section>
          <header>
            <h2>최근 등록 상품</h2>
            <button onClick={() => go("/blog/me/manage/market")}>전체 보기</button>
          </header>
          {data.recentMarketItems.length ? (
            data.recentMarketItems.map((item) => (
              <button className="manage-recent-row" key={item.id} onClick={() => go(`/market/${item.id}/edit`)}>
                <span>
                  <b>{item.title}</b>
                  <small>
                    {item.category} · {item.status}
                  </small>
                </span>
                <strong>{item.pricePoints.toLocaleString()} P</strong>
              </button>
            ))
          ) : (
            <p className="manage-empty-copy">등록 상품이 없습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ManageSettings({ blog, setBlog, user, onUserChange, onWithdraw }: { blog: Blog; setBlog: (blog: Blog) => void; user: User; onUserChange: (user: User) => void; onWithdraw: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(blog.name);
  const [description, setDescription] = useState(blog.description);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [preview, setPreview] = useState(blog.profileImageUrl ?? "");
  const [shopName, setShopName] = useState(blog.shopName ?? "취향을 나누는 상점");
  const [shopDescription, setShopDescription] = useState(blog.shopDescription ?? "직접 모으고 아껴온 물건을 다음 주인에게 건넵니다.");
  const [nickname, setNickname] = useState(user.nickname);
  const [nicknameBusy, setNicknameBusy] = useState(false);
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);
  const [savedInterests, setSavedInterests] = useState<string[]>(user.interests ?? []);
  const [interestBusy, setInterestBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawConfirmation, setWithdrawConfirmation] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const nicknameDirty = nickname.trim() !== user.nickname;
  const interestDirty = interests.join("|") !== savedInterests.join("|");
  const toggleInterest = (interest: string) => setInterests((current) => (current.includes(interest) ? current.filter((item) => item !== interest) : current.length < 8 ? [...current, interest] : current));
  const saveInterests = async () => {
    if (!interests.length) return;
    setInterestBusy(true);
    setMessage("");
    try {
      const result = await request<{ interests: string[] }>("/auth/interests", {
        method: "PATCH",
        body: JSON.stringify({ interests }),
      });
      setInterests(result.interests);
      setSavedInterests(result.interests);
      onUserChange({ ...user, interests: result.interests });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["home"] }), queryClient.invalidateQueries({ queryKey: ["search"] })]);
      setMessage("관심분야를 저장했습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setInterestBusy(false);
    }
  };
  const saveNickname = async () => {
    const nextNickname = nickname.trim();
    if (nextNickname.length < 2 || nextNickname.length > 30) return setMessage("댓글 표시 이름은 2~30자로 입력해 주세요.");
    setNicknameBusy(true);
    setMessage("");
    try {
      const result = await request<{ user: User }>("/auth/profile", { method: "PATCH", body: JSON.stringify({ nickname: nextNickname }) });
      onUserChange({ ...user, ...result.user });
      setNickname(result.user.nickname);
      setMessage("댓글 표시 이름을 저장했습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setNicknameBusy(false);
    }
  };
  const dirty = name.trim() !== blog.name || description.trim() !== blog.description || shopName.trim() !== (blog.shopName ?? "취향을 나누는 상점") || shopDescription.trim() !== (blog.shopDescription ?? "직접 모으고 아껴온 물건을 다음 주인에게 건넵니다.");
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const refreshBlogCaches = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["blog", blog.slug] }), queryClient.invalidateQueries({ queryKey: ["home"] }), queryClient.invalidateQueries({ queryKey: ["search"] })]);
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const next = await request<Blog>("/blogs/me", {
        method: "PATCH",
        body: JSON.stringify({ name, description, shopName, shopDescription }),
      });
      setBlog(next);
      setName(next.name);
      setDescription(next.description);
      setShopName(next.shopName ?? "취향을 나누는 상점");
      setShopDescription(next.shopDescription ?? "");
      await refreshBlogCaches();
      setMessage("블로그 정보를 저장했습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choose = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) return setMessage("JPEG·PNG·WebP 파일을 10MB 이하로 선택해 주세요.");
    setCropSource(URL.createObjectURL(file));
  };
  const upload = async (file: File, localPreview: string) => {
    setCropSource("");
    setBusy(true);
    setPreview(localPreview);
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await request<{ profileImageUrl: string }>("/blogs/me/profile-image", { method: "POST", body: form });
      setPreview(result.profileImageUrl);
      setBlog({ ...blog, profileImageUrl: result.profileImageUrl });
      window.dispatchEvent(
        new CustomEvent("blog-profile-updated", {
          detail: result.profileImageUrl,
        }),
      );
      await refreshBlogCaches();
      setMessage("프로필 이미지를 저장했습니다.");
    } catch (e) {
      setPreview(blog.profileImageUrl ?? "");
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await request("/blogs/me/profile-image", { method: "DELETE" });
      setPreview("");
      setBlog({ ...blog, profileImageUrl: null });
      window.dispatchEvent(new CustomEvent("blog-profile-updated", { detail: null }));
      await refreshBlogCaches();
      setMessage("기본 이미지로 되돌렸습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async (event: FormEvent) => {
    event.preventDefault();
    if (!withdrawPassword || withdrawConfirmation !== "회원탈퇴") return;
    setWithdrawBusy(true);
    setWithdrawError("");
    try {
      await request("/me", { method: "DELETE", body: JSON.stringify({ password: withdrawPassword, confirmation: withdrawConfirmation }) });
      queryClient.clear();
      clearClientAuthState();
      onWithdraw();
    } catch (e) {
      setWithdrawError((e as Error).message);
      setWithdrawBusy(false);
    }
  };
  return (
    <div className="manage-settings">
      <section className="manage-form-section">
        <header>
          <h2 className="font-jua">프로필 이미지</h2>
          <p>공개 블로그 좌측 프로필에 표시됩니다.</p>
        </header>
        <div className="profile-upload">
          <div className={preview ? "profile-upload-preview has-image" : "profile-upload-preview"} style={preview ? { backgroundImage: `url(${preview})` } : undefined}>
            <Image size={26} />
          </div>
          <div>
            <label className="manage-secondary font-jua">
              <Upload size={15} /> 이미지 선택
              <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => choose(e.target.files?.[0])} />
            </label>
            {preview && <button className="font-jua" onClick={remove}>기본 이미지로 되돌리기</button>}
            <small>10MB 이하 JPG, PNG, WebP · 저장 시 512×512 WebP 변환</small>
          </div>
        </div>
      </section>
      <section className="manage-form-section">
        <header>
          <h2 className="font-jua">기본 정보</h2>
          <p>댓글에 표시되는 이름과 블로그 정보를 수정합니다.</p>
        </header>
        <label className="font-jua">
          댓글 표시 이름
          <input minLength={2} maxLength={30} value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <small>{nickname.length}/30 · 댓글 작성자 이름으로 표시됩니다.</small>
        </label>
        <button className="manage-primary" disabled={!nicknameDirty || nicknameBusy || nickname.trim().length < 2} onClick={saveNickname}>
          {nicknameBusy ? "저장 중…" : "댓글 표시 이름 저장"}
        </button>
        <label className="font-jua">
          블로그 주소
          <div className="manage-readonly">
            <span>/blog/{blog.slug}</span>
            <button className="font-jua" onClick={() => navigator.clipboard.writeText(`${location.origin}/blog/${blog.slug}`)}>
              <Clipboard size={14} /> 복사
            </button>
          </div>
        </label>
        <label className="font-jua">
          블로그 이름
          <input minLength={2} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          <small>{name.length}/30</small>
        </label>
        <label className="font-jua">
          블로그 설명
          <textarea maxLength={160} value={description} onChange={(e) => setDescription(e.target.value)} />
          <small>{description.length}/160</small>
        </label>
      </section>
      <section className="manage-form-section manage-interest-section">
        <header>
          <h2 className="font-jua">관심분야</h2>
          <p>
            글 분류와 콘텐츠 추천에 사용합니다.
            <br />
            1개 이상, 최대 8개까지 선택할 수 있습니다.
          </p>
        </header>
        <div>
          <div className="manage-interest-head">
            <span>
              <b>{interests.length}</b>개 선택
            </span>
            <small>최대 8개</small>
          </div>
          <div className="manage-interest-options">
            {interestCatalog.map((interest) => {
              const active = interests.includes(interest);
              return (
                <button type="button" aria-pressed={active} className={active ? "active font-jua" : "font-jua"} onClick={() => toggleInterest(interest)} key={interest}>
                  {active && <Check size={12} />}
                  {interest}
                </button>
              );
            })}
          </div>
          <button className="manage-primary font-jua" disabled={!interestDirty || !interests.length || interestBusy} onClick={saveInterests}>
            {interestBusy ? "저장 중…" : "관심분야 저장"}
          </button>
        </div>
      </section>
      <section className="manage-form-section">
        <header>
          <h2 className="font-jua">상점 정보</h2>
          <p>공개 블로그의 상점 제목과 설명을 수정합니다.</p>
        </header>
        <label className="font-jua">
          상점 이름
          <input maxLength={40} value={shopName} onChange={(e) => setShopName(e.target.value)} />
          <small>{shopName.length}/40</small>
        </label>
        <label className="font-jua">
          상점 설명
          <textarea maxLength={120} value={shopDescription} onChange={(e) => setShopDescription(e.target.value)} />
          <small>{shopDescription.length}/120</small>
        </label>
        {message && <p className="manage-message">{message}</p>}
        <button className="manage-primary" disabled={!dirty || busy || name.trim().length < 2 || !shopName.trim()} onClick={save}>
          {busy ? "저장 중…" : "변경사항 저장"}
        </button>
      </section>
      <section className="manage-withdraw-section" aria-labelledby="withdraw-heading">
        <div>
          <h2 className="font-jua" id="withdraw-heading">회원 탈퇴</h2>
          <p>계정과 개인정보는 익명화되며 작성한 글과 상품은 공개 화면에서 숨겨집니다. 콘텐츠는 운영 확인을 위해 관리자 휴지통에 보관됩니다.</p>
        </div>
        <button className="manage-withdraw-button font-jua" type="button" onClick={() => { setWithdrawError(""); setWithdrawOpen(true); }}>회원 탈퇴</button>
      </section>
      {cropSource && <CropModal source={cropSource} onClose={() => setCropSource("")} onDone={upload} />}
      {withdrawOpen && <div className="manage-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !withdrawBusy) setWithdrawOpen(false); }}>
        <form className="withdraw-dialog" role="dialog" aria-modal="true" aria-labelledby="withdraw-dialog-title" onSubmit={withdraw}>
          <header>
            <div><p>ACCOUNT WITHDRAWAL</p><h2 className="font-jua" id="withdraw-dialog-title">정말 탈퇴하시겠습니까?</h2></div>
            <button type="button" disabled={withdrawBusy} onClick={() => setWithdrawOpen(false)} aria-label="회원 탈퇴 창 닫기"><X size={18} /></button>
          </header>
          <div className="withdraw-warning"><strong>탈퇴 후에는 다시 로그인할 수 없습니다.</strong><span>작성 글과 마켓 상품은 즉시 비공개 처리되며 관리자 휴지통에 보관됩니다.</span></div>
          <label className="font-jua">현재 비밀번호<input autoFocus type="password" autoComplete="current-password" value={withdrawPassword} onChange={(event) => setWithdrawPassword(event.target.value)} placeholder="현재 비밀번호" /></label>
          <label className="font-jua">확인 문구<input value={withdrawConfirmation} onChange={(event) => setWithdrawConfirmation(event.target.value)} placeholder="회원탈퇴 입력" /><small>계속하려면 <b>회원탈퇴</b>를 정확히 입력하세요.</small></label>
          {withdrawError && <p className="form-error" role="alert">{withdrawError}</p>}
          <footer><button type="button" disabled={withdrawBusy} onClick={() => setWithdrawOpen(false)}>취소</button><button type="submit" disabled={withdrawBusy || !withdrawPassword || withdrawConfirmation !== "회원탈퇴"}>{withdrawBusy ? "탈퇴 처리 중…" : "계정 영구 탈퇴"}</button></footer>
        </form>
      </div>}
    </div>
  );
}

function ManageInterests({ user, onUserChange }: { user: User; onUserChange: (user: User) => void }) {
  const queryClient = useQueryClient();
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);
  const [saved, setSaved] = useState<string[]>(user.interests ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const toggle = (interest: string) => setInterests((current) => (current.includes(interest) ? current.filter((item) => item !== interest) : current.length < 8 ? [...current, interest] : current));
  const dirty = interests.join("|") !== saved.join("|");
  const save = async () => {
    if (!interests.length) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await request<{ interests: string[] }>("/auth/interests", {
        method: "PATCH",
        body: JSON.stringify({ interests }),
      });
      setInterests(result.interests);
      setSaved(result.interests);
      onUserChange({ ...user, interests: result.interests });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["home"] }), queryClient.invalidateQueries({ queryKey: ["search"] })]);
      setMessage("관심분야를 저장했습니다.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="manage-interests-page">
      <div className="manage-interest-summary">
        <div>
          <h2>내 관심분야</h2>
          <p>선택한 관심분야는 글 분류와 콘텐츠 추천에 반영됩니다.</p>
        </div>
        <span>
          <b>{interests.length}</b> / 8
        </span>
      </div>
      {interestGroups.map((group, index) => (
        <section className="manage-interest-group" key={group.title}>
          <header>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
          </header>
          <div>
            {group.items.map((interest) => {
              const active = interests.includes(interest);
              return (
                <button type="button" aria-pressed={active} disabled={!active && interests.length >= 8} className={active ? "active" : ""} onClick={() => toggle(interest)} key={interest}>
                  {active && <Check size={12} />}
                  {interest}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {message && <p className="manage-message">{message}</p>}
      <div className="manage-interest-save">
        <p>{interests.length ? "전체 그룹에서 최대 8개까지 선택할 수 있습니다." : "관심분야를 하나 이상 선택해주세요."}</p>
        <button className="manage-primary" disabled={!dirty || !interests.length || busy} onClick={save}>
          {busy ? "저장 중…" : "관심분야 저장"}
        </button>
      </div>
    </div>
  );
}

function ManageCategories({ go }: { go: (to: string) => void }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BlogCategory[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["blog"] }), queryClient.invalidateQueries({ queryKey: ["posts"] })]);
  const load = () =>
    request<BlogCategory[]>("/blogs/me/categories")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await request("/blogs/me/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      await load();
      await invalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const rename = async (item: BlogCategory) => {
    const next = prompt("새 카테고리 이름", item.name)?.trim();
    if (!next || next === item.name) return;
    try {
      await request(`/blogs/me/categories/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: next }),
      });
      await load();
      await invalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async (item: BlogCategory) => {
    if (!confirm(`‘${item.name}’ 카테고리를 삭제할까요?`)) return;
    try {
      await request(`/blogs/me/categories/${item.id}`, { method: "DELETE" });
      await load();
      await invalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const reorder = async (next: BlogCategory[]) => {
    const before = items;
    setItems(next);
    try {
      await request("/blogs/me/categories/order", {
        method: "PATCH",
        body: JSON.stringify({ categoryIds: next.map((item) => item.id) }),
      });
      await invalidate();
    } catch (e) {
      setItems(before);
      setError((e as Error).message);
    }
  };
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next);
  };
  const drop = (targetId: number) => {
    if (drag === null || drag === targetId) return;
    const next = [...items];
    const from = next.findIndex((x) => x.id === drag);
    const to = next.findIndex((x) => x.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDrag(null);
    reorder(next);
  };
  return (
    <div className="manage-list-section">
      <div className="manage-list-intro">
        <div>
          <h2 className="font-jua">글 카테고리</h2>
          <p>공개 블로그와 글 작성 화면에 같은 순서로 반영됩니다.</p>
        </div>
        <span>{items.length}/30</span>
      </div>
      <form className="category-add" onSubmit={add}>
        <input maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="새 카테고리 이름" />
        <button className="manage-primary font-jua">추가</button>
      </form>
      {error && <p className="manage-error">{error}</p>}
      <div className="category-manage-list">
        {items.map((item, index) => (
          <div key={item.id} draggable onDragStart={() => setDrag(item.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(item.id)}>
            <span className="drag-handle">⋮⋮</span>
            <b className="font-jua">{item.name}</b>
            <small>
              글 {item.activePostCount + item.trashPostCount}개{item.trashPostCount ? ` · 휴지통 ${item.trashPostCount}` : ""}
            </small>
            <button aria-label="위로 이동" disabled={!index} onClick={() => move(index, -1)}>
              <ArrowUp size={14} />
            </button>
            <button aria-label="아래로 이동" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown size={14} />
            </button>
            <button onClick={() => rename(item)}>수정</button>
            <button onClick={() => remove(item)}>삭제</button>
          </div>
        ))}
      </div>
      {!items.length && <Empty text="카테고리가 없습니다." detail="첫 카테고리를 추가해보세요." />}
      {items.some((item) => item.activePostCount + item.trashPostCount > 0) && (
        <button className="manage-link" onClick={() => go("/blog/me/manage/posts")}>
          카테고리를 사용하는 글 확인하기 <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function ManagePager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  if (total <= 1) return null;
  return (
    <nav className="manage-pager" aria-label="페이지">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        이전
      </button>
      <span>
        {page} / {total}
      </span>
      <button disabled={page >= total} onClick={() => onPage(page + 1)}>
        다음
      </button>
    </nav>
  );
}

function ManagePosts({ go }: { go: (to: string) => void }) {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "ALL";
  const categoryId = params.get("categoryId") ?? "";
  const page = Number(params.get("page") ?? 1);
  const [query, setQuery] = useState(q);
  const [items, setItems] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Page>({
    page,
    size: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [error, setError] = useState("");
  const navigate = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([key, value]) => (value === "" ? next.delete(key) : next.set(key, String(value))));
    go(`/blog/me/manage/posts?${next}`);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query !== q) navigate({ q: query.trim(), page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    requestList<Post>(`/posts?scope=mine&size=20&page=${page}&status=${status}&categoryId=${encodeURIComponent(categoryId)}&q=${encodeURIComponent(q)}`)
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
      })
      .catch((e) => setError(e.message));
  }, [q, status, categoryId, page]);
  useEffect(() => {
    request<BlogCategory[]>("/blogs/me/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);
  const remove = async (item: Post) => {
    if (!confirm(`‘${item.title}’ 글을 휴지통으로 이동할까요?`)) return;
    try {
      await request(`/posts/${item.id}`, { method: "DELETE" });
      setItems(items.filter((x) => x.id !== item.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="manage-list-section">
      <div className="manage-filters">
        <label>
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목 또는 본문 검색" />
        </label>
        <select value={status} onChange={(e) => navigate({ status: e.target.value, page: 1 })}>
          <option value="ALL">전체 상태</option>
          <option value="PUBLISHED">발행</option>
          <option value="DRAFT">임시저장</option>
        </select>
        <select value={categoryId} onChange={(e) => navigate({ categoryId: e.target.value, page: 1 })}>
          <option value="">전체 카테고리</option>
          <option value="uncategorized">미분류</option>
          {categories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="manage-error">{error}</p>}
      <div className="manage-table">
        <div className="manage-table-head">
          <span>글</span>
          <span>상태</span>
          <span>카테고리</span>
          <span>수정일</span>
          <span>조회</span>
          <span />
        </div>
        {items.map((item) => (
          <div className="manage-table-row" key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.status === "PUBLISHED" ? "발행" : "임시저장"}</span>
            <span>{item.category?.name ?? "미분류"}</span>
            <time>{new Date(item.updatedAt ?? "").toLocaleDateString("ko-KR")}</time>
            <span>{item.viewCount}</span>
            <div>
              {item.status === "PUBLISHED" && <button onClick={() => go(`/post/${item.id}`)}>보기</button>}
              <button onClick={() => go(`/post/${item.id}/edit`)}>수정</button>
              <button onClick={() => remove(item)}>삭제</button>
            </div>
          </div>
        ))}
      </div>
      {!items.length && <Empty text="조건에 맞는 글이 없습니다." />}
      <ManagePager page={pagination.page} total={pagination.totalPages} onPage={(next) => navigate({ page: next })} />
    </div>
  );
}

function ManageMarket({ go }: { go: (to: string) => void }) {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "ALL";
  const page = Number(params.get("page") ?? 1);
  const [query, setQuery] = useState(q);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [pagination, setPagination] = useState<Page>({
    page,
    size: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [error, setError] = useState("");
  const navigate = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([key, value]) => (value === "" ? next.delete(key) : next.set(key, String(value))));
    go(`/blog/me/manage/market?${next}`);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query !== q) navigate({ q: query.trim(), page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    requestList<MarketItem>(`/market/items?scope=mine&size=20&page=${page}&status=${status}&q=${encodeURIComponent(q)}`)
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
      })
      .catch((e) => setError(e.message));
  }, [q, status, page]);
  const remove = async (item: MarketItem) => {
    if (!confirm(`‘${item.title}’ 상품을 휴지통으로 이동할까요?`)) return;
    try {
      await request(`/market/items/${item.id}`, { method: "DELETE" });
      setItems(items.filter((x) => x.id !== item.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="manage-list-section">
      <div className="manage-filters">
        <label>
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="상품명 검색" />
        </label>
        <select value={status} onChange={(e) => navigate({ status: e.target.value, page: 1 })}>
          <option value="ALL">전체 상태</option>
          <option value="SELLING">판매 중</option>
          <option value="RESERVED">예약</option>
          <option value="SOLD">판매 완료</option>
        </select>
      </div>
      {error && <p className="manage-error">{error}</p>}
      <div className="manage-table market-manage-table">
        <div className="manage-table-head">
          <span>상품</span>
          <span>가격</span>
          <span>상품 상태</span>
          <span>판매 상태</span>
          <span>등록일</span>
          <span />
        </div>
        {items.map((item) => (
          <div className="manage-table-row" key={item.id}>
            <strong>
              {item.title}
              <small>{item.category}</small>
            </strong>
            <span>{item.pricePoints.toLocaleString()} P</span>
            <span>{conditionLabel[item.condition]}</span>
            <span>{item.status}</span>
            <time>{new Date(item.createdAt ?? "").toLocaleDateString("ko-KR")}</time>
            <div>
              <button onClick={() => go(`/market/${item.id}`)}>보기</button>
              {item.status !== "SOLD" && <button onClick={() => go(`/market/${item.id}/edit`)}>수정</button>}
              <button onClick={() => remove(item)}>삭제</button>
            </div>
          </div>
        ))}
      </div>
      {!items.length && <Empty text="조건에 맞는 상품이 없습니다." />}
      <ManagePager page={pagination.page} total={pagination.totalPages} onPage={(next) => navigate({ page: next })} />
    </div>
  );
}

function ManageTrash() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") ?? "ALL";
  const [posts, setPosts] = useState<Post[]>([]);
  const [market, setMarket] = useState<MarketItem[]>([]);
  const [error, setError] = useState("");
  const load = () =>
    Promise.all([requestList<Post>("/posts?scope=mine&deleted=only&status=ALL&page=1&size=50"), requestList<MarketItem>("/market/items?scope=mine&deleted=only&status=ALL&page=1&size=50")])
      .then(([postResult, marketResult]) => {
        setPosts(postResult.data);
        setMarket(marketResult.data);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const restore = async (kind: "post" | "market", id: number | string) => {
    try {
      await request(kind === "post" ? `/posts/${id}/restore` : `/market/items/${id}/restore`, { method: "POST" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const purge = async (kind: "post" | "market", item: Post | MarketItem) => {
    const typed = prompt(`영구 삭제하려면 ‘${item.title}’을 입력하세요.`);
    if (typed !== item.title) return;
    try {
      await request(kind === "post" ? `/posts/${item.id}/permanent` : `/market/items/${item.id}/permanent`, { method: "DELETE" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const rows = [...(type !== "MARKET" ? posts.map((item) => ({ kind: "post" as const, item })) : []), ...(type !== "POSTS" ? market.map((item) => ({ kind: "market" as const, item })) : [])].sort((a, b) => String(b.item.deletedAt).localeCompare(String(a.item.deletedAt)));
  return (
    <div className="manage-list-section">
      <div className="manage-trash-head">
        <div>
          <h2>휴지통</h2>
          <p>30일 후 자동으로 정리됩니다. 카테고리를 사용하는 글은 복원 기간 동안 연결을 유지합니다.</p>
        </div>
        <select
          value={type}
          onChange={(e) => {
            const next = new URLSearchParams(window.location.search);
            next.set("type", e.target.value);
            history.pushState({}, "", `/blog/me/manage/trash?${next}`);
            location.reload();
          }}
        >
          <option value="ALL">전체</option>
          <option value="POSTS">글</option>
          <option value="MARKET">상품</option>
        </select>
      </div>
      {error && <p className="manage-error">{error}</p>}
      <div className="trash-list">
        {rows.map(({ kind, item }) => (
          <div key={`${kind}-${item.id}`}>
            <span className="trash-type">{kind === "post" ? "글" : "상품"}</span>
            <strong>{item.title}</strong>
            <small>
              삭제 {new Date(item.deletedAt ?? "").toLocaleDateString("ko-KR")} · 자동 정리 {item.purgeAfter ? new Date(item.purgeAfter).toLocaleDateString("ko-KR") : "복원 불가"}
            </small>
            <div>
              {item.purgeAfter && <button onClick={() => restore(kind, item.id)}>복원</button>}
              <button onClick={() => purge(kind, item)}>영구 삭제</button>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <Empty text="휴지통이 비어 있습니다." />}
    </div>
  );
}

const conditionLabel: Record<MarketItem["condition"], string> = {
  NEW: "새 상품",
  LIKE_NEW: "거의 새 상품",
  USED: "사용감 있음",
};

function MarketRow({ item, go }: { item: MarketItem; go: (to: string) => void }) {
  return (
    <article className="feed-row market-row">
      <button className={`market-row-thumbnail${item.thumbnailUrl ? " has-image" : ""}`} style={item.thumbnailUrl ? { backgroundImage: `url(${item.thumbnailUrl})` } : undefined} onClick={() => go(`/market/${item.id}`)} aria-label={`${item.title} 이미지`} />
      <div className="market-row-content">
        <p className="post-blog">
          {item.category} · {conditionLabel[item.condition]}
        </p>
        <h2>
          <button onClick={() => go(`/market/${item.id}`)}>{item.title}</button>
        </h2>
        <p className="excerpt">{item.description}</p>
        <p className="market-tags">
          {item.tags.map((tag) => (
            <button key={tag} onClick={() => go(`/search?tab=market&q=${encodeURIComponent(`#${tag}`)}`)}>
              #{tag}
            </button>
          ))}
        </p>
        <small>
          {item.seller.nickname} · {item.status === "SELLING" ? "판매 중" : item.status}
        </small>
      </div>
      <div className="row-stat market-row-price">
        <strong>{item.pricePoints.toLocaleString()} P</strong>
      </div>
    </article>
  );
}

function MarketSavedList({ kind, go, user, onLogin }: { kind: "recent" | "wishlist"; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const recent = kind === "recent";
  const [items, setItems] = useState<MarketItem[]>(() => (recent ? readRecentMarketItems() : []));
  const [loading, setLoading] = useState(!recent);
  const [error, setError] = useState("");
  useEffect(() => {
    if (recent || !user) {
      setLoading(false);
      return;
    }
    request<MarketItem[]>("/market/items?scope=liked&sort=latest&page=1&size=50")
      .then((data) => setItems(data ?? []))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [recent, user]);
  if (!recent && !user)
    return (
      <Shell go={go} user={user} onLogin={onLogin}>
        <main id="main" className="page-main">
          <div className="section-inner">
            <Empty text="로그인 후 찜한 상품을 확인할 수 있습니다." />
            <button className="primary-button compact saved-login" onClick={onLogin}>
              로그인
            </button>
          </div>
        </main>
      </Shell>
    );
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="page-main market-saved-page">
        <div className="section-inner">
          <div className="page-intro saved-intro">
            <p className="eyebrow">{recent ? "RECENTLY VIEWED" : "MY WISHLIST"}</p>
            <h1 className="font-jua">{recent ? "최근 본 상품" : "마음에 담아둔 상품"}</h1>
            <p>{recent ? "최근 확인한 상품을 최신순으로 최대 20개까지 보관합니다." : "좋아요를 누른 상품을 한곳에서 다시 확인하세요."}</p>
          </div>
          {error ? (
            <Empty text="상품을 불러오지 못했습니다." detail={error} />
          ) : loading ? (
            <Empty text="상품을 불러오는 중입니다." />
          ) : items.length ? (
            <div className="feed-list">
              {items.map((item) => (
                <MarketRow key={item.id} item={item} go={go} />
              ))}
            </div>
          ) : (
            <Empty text={recent ? "최근 본 상품이 없습니다." : "아직 찜한 상품이 없습니다."} detail="마켓에서 마음에 드는 상품을 둘러보세요." />
          )}
        </div>
      </main>
    </Shell>
  );
}

const preparedMarketPages = {
  cart: ["CART", "장바구니", "마음에 드는 상품을 한 번에 거래할 수 있도록 준비하고 있습니다."],
  "price-guide": ["PRICE GUIDE", "중고 최근 시세", "최근 거래 데이터를 바탕으로 시세를 비교하는 기능을 준비하고 있습니다."],
  coupons: ["COUPONS", "쿠폰", "팬덤 마켓에서 사용할 수 있는 새로운 혜택을 준비하고 있습니다."],
} as const;

function MarketPrepared({ kind, go, user, onLogin }: { kind: keyof typeof preparedMarketPages; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [eyebrow, title, description] = preparedMarketPages[kind];
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="page-main market-prepared-page">
        <div className="section-inner">
          <div className="market-prepared-symbol">
            <Package size={30} />
          </div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="font-jua">{title}</h1>
          <p>{description}</p>
          <button className="primary-button compact" onClick={() => go("/market")}>
            마켓 둘러보기 <ArrowRight size={15} />
          </button>
        </div>
      </main>
    </Shell>
  );
}

function Market({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [query, setQuery] = useState(new URLSearchParams(window.location.search).get("q") ?? "");
  const [sort, setSort] = useState<"latest" | "price_asc">("latest");
  const marketQuery = useQuery({
    queryKey: ["market", query, sort, user?.id ?? "anonymous"],
    queryFn: () => request<MarketItem[]>(`/market/items?q=${encodeURIComponent(query)}&sort=${sort}&page=1&size=12`),
    refetchInterval: 30_000,
  });
  const items = marketQuery.data ?? [];
  const error = marketQuery.error instanceof Error ? marketQuery.error.message : "";
  const shown = items.length ? items : sampleMarketItems.filter((item) => !query || `${item.title} ${item.description} ${item.category} ${item.tags.join(" ")}`.toLowerCase().includes(query.replace(/^#/, "").toLowerCase()));
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="page-main">
        <div className="section-inner">
          <div className="page-intro">
            <p className="eyebrow">FANDOM GOODS MARKET</p>
            <h1>
              좋아하는 작품의 굿즈를
              <br />
              팬들과 안전하게 거래해보세요.
            </h1>
            <p className="muted">블로그 글과 분리된 1:1 팬덤 굿즈 마켓입니다. MVP에서는 포인트로 거래합니다.</p>
            <form
              className="feed-search"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(query.trim());
              }}
            >
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작품, 캐릭터, 상품명 또는 #키워드 검색" />
            </form>
          </div>
          <div className="feed-toolbar">
            <strong>
              판매 중인 상품 <em>{shown.length}</em>
            </strong>
            <div>
              <button className={sort === "latest" ? "active" : ""} onClick={() => setSort("latest")}>
                최신순
              </button>
              <button className={sort === "price_asc" ? "active" : ""} onClick={() => setSort("price_asc")}>
                낮은 가격순
              </button>
              {user && <button onClick={() => go("/market/wallet")}>내 지갑·거래</button>}
              <button onClick={() => (user ? go("/market/new") : onLogin())}>상품 등록</button>
            </div>
          </div>
          {error && <p className="form-error">API 연결 전이라 샘플 상품을 표시하고 있습니다. {error}</p>}
          <div className="feed-list">
            {shown.map((item) => (
              <MarketRow key={item.id} item={item} go={go} />
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}

function MarketEditor({ go, id }: { go: (to: string) => void; id?: string }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    condition: "NEW" as MarketItem["condition"],
    pricePoints: "",
    tags: "",
    status: "SELLING" as MarketItem["status"],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<{ source: string; file?: File }[]>([]);
  const [imagesChanged, setImagesChanged] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<number | null>(null);
  const [progress, setProgress] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const imagePreviews = images.map((image) => image.source);
  useEffect(() => {
    if (id)
      request<MarketItem>(`/market/items/${id}`)
        .then((item) => {
          if (item.status === "SOLD") {
            go("/blog/me/manage/market");
            return;
          }
          setForm({
            title: item.title,
            description: item.description,
            category: item.category,
            condition: item.condition,
            pricePoints: String(item.pricePoints),
            tags: item.tags.map((tag) => `#${tag}`).join(" "),
            status: item.status,
          });
          setImages((item.images ?? []).map((image) => ({ source: image.url })));
        })
        .catch((e) => setError(e.message));
  }, [id]);
  const uploadImages = async (itemId: number) => {
    const data = new FormData();
    for (let index = 0; index < images.length; index++) {
      setProgress(`이미지 준비 중 (${index + 1}/${images.length})`);
      const image = images[index];
      if (image.file) data.append("images", image.file);
      else {
        const blob = await fetch(image.source).then((response) => {
          if (!response.ok) throw new Error("기존 이미지를 불러오지 못했습니다.");
          return response.blob();
        });
        data.append("images", new File([blob], `image-${index + 1}.webp`, { type: "image/webp" }));
      }
    }
    setProgress(`이미지 업로드 중 (${images.length}장)`);
    await request<MarketImage[]>(`/market/items/${itemId}/images`, {
      method: "PUT",
      body: data,
    });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!images.length) return setError("상품 이미지를 한 장 이상 등록해 주세요.");
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        pricePoints: Number(form.pricePoints),
        tags: form.tags
          .split(/\s+/)
          .map((tag) => tag.replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 5),
      };
      setProgress("상품 정보 저장 중");
      const targetId = Number(id ?? createdItemId);
      const item = await request<MarketItem>(targetId ? `/market/items/${targetId}` : "/market/items", { method: targetId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      const itemId = Number(item.id);
      if (!targetId) setCreatedItemId(itemId);
      if (!id || imagesChanged) await uploadImages(itemId);
      go(`/market/${itemId}`);
    } catch (e) {
      setError(createdItemId ? `상품 정보는 저장되었습니다. ${(e as Error).message} 다시 등록하면 이미지 업로드를 재시도합니다.` : (e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const chooseImages = (files?: FileList | null) => {
    const selected = Array.from(files ?? []);
    const available = Math.max(0, 5 - images.length);
    const next = selected.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024).slice(0, available);
    if (next.length) {
      setCropQueue(next);
      setError("");
    }
    if (selected.length !== next.length) setError("JPG·PNG·WebP 이미지를 장당 10MB 이하, 전체 5장까지 선택해 주세요.");
  };
  const finishCrop = (file: File) => {
    const source = URL.createObjectURL(file);
    setImages((items) => {
      const next = [...items, { source, file }].slice(0, 5);
      setActiveImage(next.length - 1);
      return next;
    });
    setImagesChanged(true);
    setCropQueue((items) => items.slice(1));
  };
  const removeImage = (index: number) => {
    setImages((items) => {
      const removed = items[index];
      if (removed?.file) URL.revokeObjectURL(removed.source);
      return items.filter((_, itemIndex) => itemIndex !== index);
    });
    setImagesChanged(true);
    setActiveImage((current) => (current > index ? current - 1 : current === index ? Math.max(0, index - 1) : current));
  };
  return (
    <main id="main" className="market-editor-page">
      <div className="section-inner">
        <header className="market-editor-head">
          <button className="back-button" type="button" onClick={() => go("/blog/me/manage/market")}>
            <ArrowLeft size={16} /> 마켓 관리로
          </button>
          <div>
            <p className="eyebrow">{id ? "EDIT PRODUCT" : "NEW PRODUCT"}</p>
            <h1>{id ? "상품 정보 수정" : "상품 등록"}</h1>
            <span>구매자가 보게 될 상품 페이지와 같은 순서로 작성합니다.</span>
          </div>
        </header>
        <form className="market-editor-form" onSubmit={submit}>
          <section className="market-editor-gallery" aria-label="상품 이미지">
            <label className={`market-editor-image${imagePreviews[activeImage] ? " has-image" : ""}`} style={imagePreviews[activeImage] ? { backgroundImage: `url(${imagePreviews[activeImage]})` } : undefined}>
              <input
                hidden
                type="file"
                name="images"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  chooseImages(e.target.files);
                  e.target.value = "";
                }}
              />
              {imagePreviews[activeImage] ? (
                <span>
                  <Upload size={16} /> 이미지 추가
                </span>
              ) : (
                <>
                  <Image size={31} />
                  <strong>상품 이미지 추가</strong>
                  <small>선택 후 한 장씩 정사각형으로 맞춥니다.</small>
                </>
              )}
            </label>
            <div className="market-editor-thumbs">
              {imagePreviews.map((source, index) => (
                <div className="market-editor-thumb" key={source}>
                  <button type="button" className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)} style={{ backgroundImage: `url(${source})` }} aria-label={`상품 이미지 ${index + 1}`} />
                  <button type="button" className="market-editor-thumb-remove" onClick={() => removeImage(index)} aria-label={`상품 이미지 ${index + 1} 삭제`}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {imagePreviews.length < 5 && (
                <label>
                  <Upload size={14} />
                  <input
                    hidden
                    type="file"
                    name="images"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      chooseImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <p>적용된 이미지는 1024×1024 WebP로 준비됩니다.</p>
          </section>
          <section className="market-editor-info">
            <label className="market-editor-category">
              카테고리
              <input required name="category" maxLength={50} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="예: 애니메이션 굿즈" />
            </label>
            <label className="market-editor-title">
              상품명
              <input required name="title" maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="상품명을 입력하세요" />
              <small>{form.title.length}/100</small>
            </label>
            <label className="market-editor-price">
              가격
              <input required name="pricePoints" min={1} max={1000000000} type="number" value={form.pricePoints} onChange={(e) => setForm({ ...form, pricePoints: e.target.value })} placeholder="0" />
              <span>P</span>
            </label>
            <label className="market-editor-tags">
              검색 키워드
              <input name="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="#작품명 #캐릭터명" />
              <small>띄어쓰기로 구분 · 최대 5개</small>
            </label>
            <div className="market-editor-status">
              <label>
                상품 상태
                <select
                  name="condition"
                  value={form.condition}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      condition: e.target.value as MarketItem["condition"],
                    })
                  }
                >
                  <option value="NEW">새 상품</option>
                  <option value="LIKE_NEW">거의 새 상품</option>
                  <option value="USED">사용감 있음</option>
                </select>
              </label>
              <label>
                판매 상태
                <select
                  name="status"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as MarketItem["status"],
                    })
                  }
                >
                  <option value="SELLING">판매 중</option>
                  <option value="RESERVED">예약</option>
                  <option value="SOLD">판매 완료</option>
                </select>
              </label>
            </div>
            <label className="market-editor-description">
              상품 설명
              <textarea required name="description" maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="구성품, 보관 상태, 하자 여부 등 구매자에게 필요한 내용을 적어주세요." />
              <small>{form.description.length.toLocaleString()}/5,000</small>
            </label>
            <div className="market-editor-seller">
              <span>
                <Package size={17} />
              </span>
              <div>
                <strong>판매자 정보 자동 연결</strong>
                <small>현재 로그인한 계정의 닉네임과 프로필이 상품 페이지에 표시됩니다.</small>
              </div>
            </div>
            <p className="market-safety">안전한 거래를 위해 설명에 개인정보나 외부 메신저 ID를 입력하지 마세요.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="market-editor-actions">
              <button type="button" onClick={() => go("/blog/me/manage/market")}>
                취소
              </button>
              <button disabled={busy}>
                {busy ? "저장 중…" : id ? "수정 완료" : "상품 등록"} <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </form>
      </div>
      {cropQueue[0] && <MarketImageCropModal key={`${cropQueue[0].name}-${cropQueue.length}`} file={cropQueue[0]} remaining={cropQueue.length} onCancel={() => setCropQueue([])} onDone={finishCrop} />}
    </main>
  );
}

function MarketDetail({ id, go, user, onLogin }: { id: string; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [item, setItem] = useState<MarketItem | null>(() => sampleMarketItems.find((entry) => String(entry.id) === id) ?? null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);
  useEffect(() => {
    if (!id.startsWith("sample-"))
      request<MarketItem>(`/market/items/${id}`)
        .then((nextItem) => {
          setItem(nextItem);
          emitAiActivity({ type: "market_detail_viewed", itemId: id });
        })
        .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (item) rememberMarketItem(item);
  }, [item?.id]);
  const toggleLike = async () => {
    if (!user) return onLogin();
    if (!item || likeBusy || item.status !== "SELLING") return;
    const wasLiked = item.isLiked;
    setLikeBusy(true);
    setError("");
    setItem({
      ...item,
      isLiked: !wasLiked,
      likeCount: Math.max(0, item.likeCount + (wasLiked ? -1 : 1)),
    });
    if (id.startsWith("sample-")) {
      setLikeBusy(false);
      return;
    }
    try {
      await request(`/market/items/${id}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });
    } catch (error) {
      setItem((current) =>
        current
          ? {
              ...current,
              isLiked: wasLiked,
              likeCount: Math.max(0, current.likeCount + (wasLiked ? 1 : -1)),
            }
          : current,
      );
      setError((error as Error).message);
    } finally {
      setLikeBusy(false);
    }
  };
  const startChat = async () => {
    if (!user) return onLogin();
    setChatOpen(true);
    setError("");
    if (id.startsWith("sample-")) return;
    try {
      const room = await request<Conversation>(`/market/items/${id}/conversations`, { method: "POST" });
      setConversation(room);
      setMessages((await request<ChatMessage[]>(`/market/conversations/${room.id}/messages`)) ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    if (!conversation) {
      setMessages([
        ...messages,
        {
          id: Date.now(),
          senderId: user?.id ?? 0,
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
      setMessage("");
      return;
    }
    try {
      const sent = await request<ChatMessage>(`/market/conversations/${conversation.id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      setMessages([...messages, sent]);
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const purchase = async () => {
    if (!user) return onLogin();
    if (id.startsWith("sample-")) return setError("샘플 상품은 실제로 구매할 수 없습니다. 상품을 직접 등록한 뒤 시험해 주세요.");
    if (!confirm(`${item?.pricePoints.toLocaleString()}P로 이 상품을 구매할까요?`)) return;
    setBuying(true);
    setError("");
    try {
      const result = await request<{ orderId: number; balance: number }>(`/market/items/${id}/purchase`, { method: "POST" });
      alert(`구매되었습니다. 남은 포인트는 ${result.balance.toLocaleString()}P입니다.`);
      go("/market/wallet");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuying(false);
    }
  };
  if (!item)
    return (
      <Shell go={go} user={user} onLogin={onLogin}>
        <main className="page-main">
          <div className="section-inner">
            <Empty text={error || "상품을 불러오는 중입니다."} />
          </div>
        </main>
      </Shell>
    );
  const shownMessages = messages.length
    ? messages
    : [
        {
          id: "welcome",
          senderId: item.seller.id,
          body: "안녕하세요! 상품에 대해 궁금한 점을 편하게 물어보세요.",
          createdAt: new Date().toISOString(),
        },
      ];
  const mine = String(item.seller.id) === String(user?.id);
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="market-detail-page">
        <div className="section-inner">
          <button className="back-button" onClick={() => go("/market")}>
            <ArrowLeft size={16} /> 마켓으로
          </button>
          <div className="market-product">
            <section className="market-product-gallery">
              {item.images?.length ? (
                <>
                  <ProgressiveImage eager className="market-detail-image" src={item.images[0].url} alt={item.title} />
                  <div className="market-image-dots">{item.images.map((image, index) => (index === 0 ? <b key={image.id} /> : <i key={image.id} />))}</div>
                </>
              ) : (
                <>
                  <div className="market-image-placeholder">
                    <span>FANDOM GOODS</span>
                    <strong>{item.category}</strong>
                  </div>
                  <div className="market-image-dots">
                    <b />
                  </div>
                </>
              )}
            </section>
            <section className="market-product-info">
              <p className="post-blog">
                {item.category} · {conditionLabel[item.condition]}
              </p>
              <h1>{item.title}</h1>
              <strong className="market-price">
                {item.pricePoints.toLocaleString()} <small>P</small>
              </strong>
              <div className="market-tags">
                {item.tags.map((tag) => (
                  <button key={tag} onClick={() => go(`/search?tab=market&q=${encodeURIComponent(`#${tag}`)}`)}>
                    #{tag}
                  </button>
                ))}
              </div>
              <p className="market-description">{item.description}</p>
              <div className="market-seller">
                <span className="market-seller-avatar">{item.seller.nickname[0]}</span>
                <div>
                  <strong>{item.seller.nickname}</strong>
                  <span>본인 인증 완료 · 판매 상품</span>
                </div>
              </div>
              <div className="market-actions">
                <button className={`market-like-button${item.isLiked ? " active" : ""}`} aria-pressed={item.isLiked} disabled={likeBusy || item.status !== "SELLING"} onClick={toggleLike}>
                  <Heart size={15} fill={item.isLiked ? "currentColor" : "none"} /> 좋아요 {item.likeCount ?? 0}
                </button>
                <button className="market-chat-button" disabled={mine || item.status !== "SELLING"} onClick={startChat}>
                  {mine ? "내 상품" : "채팅하기"}
                </button>
                <button className="market-buy-button" disabled={mine || item.status !== "SELLING" || buying} onClick={purchase}>
                  {item.status === "SOLD" ? "판매 완료" : mine ? "내 상품" : buying ? "구매 처리 중…" : "포인트로 구매"}
                </button>
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <p className="market-safety">구매 즉시 구매자의 포인트가 차감되고 판매자에게 정산됩니다. 실제 현금 가치가 없는 MVP 포인트입니다.</p>
            </section>
          </div>
        </div>
        {chatOpen && (
          <aside className="market-chat-panel" aria-label="판매자와 채팅">
            <div className="market-chat-head">
              <div>
                <strong>{item.seller.nickname}</strong>
                <span>{item.title}</span>
              </div>
              <button onClick={() => setChatOpen(false)} aria-label="채팅 닫기">
                ×
              </button>
            </div>
            <div className="market-chat-messages">
              {shownMessages.map((entry) => (
                <div className={`chat-message${String(entry.senderId) === String(user?.id) ? " mine" : ""}`} key={entry.id}>
                  <p>{entry.body}</p>
                  <time>
                    {new Date(entry.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              ))}
            </div>
            <form className="market-chat-form" onSubmit={send}>
              <input maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="메시지를 입력하세요" />
              <button>전송</button>
            </form>
          </aside>
        )}
      </main>
    </Shell>
  );
}

const transactionLabel: Record<WalletTransaction["type"], string> = {
  INITIAL_GRANT: "가입 축하 포인트",
  POINT_CHARGE: "MVP 테스트 충전",
  MARKET_PURCHASE: "상품 구매",
  MARKET_SALE: "상품 판매 정산",
  REFUND: "구매 취소 환불",
  MISSION_REWARD: "AI 미션 완료 보상",
};

function MarketWallet({ go, user, onLogin }: { go: (to: string) => void; user: User; onLogin: () => void }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [buyerOrders, setBuyerOrders] = useState<MarketOrder[]>([]);
  const [sellerOrders, setSellerOrders] = useState<MarketOrder[]>([]);
  const [tab, setTab] = useState<"buyer" | "seller">("buyer");
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    Promise.all([request<Wallet>("/market/wallet"), request<MarketOrder[]>("/market/orders?role=buyer"), request<MarketOrder[]>("/market/orders?role=seller")])
      .then(([nextWallet, bought, sold]) => {
        setWallet(nextWallet);
        setBuyerOrders(bought ?? []);
        setSellerOrders(sold ?? []);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  const complete = async (id: number) => {
    if (!confirm("상품을 잘 받으셨나요? 구매 완료 후에는 되돌릴 수 없습니다.")) return;
    try {
      await request(`/market/orders/${id}/complete`, { method: "POST" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const charge = async (amount: number) => {
    if (!confirm(`${amount.toLocaleString()}P를 MVP 테스트 포인트로 충전할까요?`)) return;
    try {
      await request("/market/wallet/charge", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const orders = tab === "buyer" ? buyerOrders : sellerOrders;
  const imageUrl = (order: MarketOrder) => order.item?.images?.[0]?.url ?? order.item?.imageUrls?.[0];
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="wallet-page">
        <div className="section-inner">
          <button className="back-button" onClick={() => go("/market")}>
            <ArrowLeft size={16} /> 마켓으로
          </button>
          <div className="wallet-hero">
            <div>
              <p className="eyebrow">POINT WALLET</p>
              <h1>내 포인트 지갑</h1>
              <p>팬덤 굿즈를 사고 판매 대금을 정산받는 MVP 지갑입니다.</p>
              <div className="wallet-charge">
                {[10000, 50000, 100000].map((amount) => (
                  <button key={amount} onClick={() => charge(amount)}>
                    + {amount.toLocaleString()}P
                  </button>
                ))}
              </div>
            </div>
            <strong>
              {wallet ? wallet.balance.toLocaleString() : "—"} <small>P</small>
            </strong>
          </div>
          {error && <p className="form-error">{error}</p>}
          <section className="wallet-section">
            <h2>포인트 내역</h2>
            <div className="wallet-history">
              {wallet?.transactions.length ? (
                wallet.transactions.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{transactionLabel[entry.type]}</strong>
                      <time>{new Date(entry.createdAt).toLocaleString("ko-KR")}</time>
                    </div>
                    <span className={entry.amount > 0 ? "positive" : ""}>
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount.toLocaleString()} P
                    </span>
                  </article>
                ))
              ) : (
                <Empty text="포인트 내역이 없습니다." />
              )}
            </div>
          </section>
          <section className="wallet-section">
            <div className="wallet-order-head">
              <h2>주문·판매 내역</h2>
              <div>
                <button className={tab === "buyer" ? "active" : ""} onClick={() => setTab("buyer")}>
                  구매 {buyerOrders.length}
                </button>
                <button className={tab === "seller" ? "active" : ""} onClick={() => setTab("seller")}>
                  판매 {sellerOrders.length}
                </button>
              </div>
            </div>
            <div className="order-list">
              {orders.length ? (
                orders.map((order) => (
                  <article key={order.id}>
                    {imageUrl(order) ? <img src={imageUrl(order)} alt="" /> : <span className="order-no-image">NO IMAGE</span>}
                    <div>
                      <small>주문 #{order.id}</small>
                      <button onClick={() => go(`/market/${order.itemId}`)}>
                        <strong>{order.item?.title ?? `상품 ${order.itemId}`}</strong>
                      </button>
                      <p>
                        {order.pricePoints.toLocaleString()}P · {order.status === "PAID" ? "결제 완료" : order.status === "COMPLETED" ? "구매 완료" : "취소됨"}
                      </p>
                    </div>
                    {tab === "buyer" && order.status === "PAID" && (
                      <button className="order-complete" onClick={() => complete(order.id)}>
                        <Check size={15} /> 구매 완료
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <Empty text={tab === "buyer" ? "구매한 상품이 없습니다." : "판매된 상품이 없습니다."} />
              )}
            </div>
          </section>
        </div>
      </main>
    </Shell>
  );
}

function SearchPage({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<"posts" | "market" | "blogs">((["posts", "market", "blogs"].includes(params.get("tab") ?? "") ? params.get("tab") : "posts") as "posts" | "market" | "blogs");
  const interestTerms = [
    ...new Set(
      params
        .getAll("interest")
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);
  const interestKey = interestTerms.join("\u001f");
  const [posts, setPosts] = useState<Post[]>([]);
  const [market, setMarket] = useState<MarketItem[]>([]);
  const [blogs, setBlogs] = useState<SearchBlog[]>([]);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const rankMerged = <T extends { id: number | string }>(groups: T[][]) => {
    const merged = new Map<string, { item: T; matches: number; order: number }>();
    let order = 0;
    groups.forEach((items) =>
      items.forEach((item) => {
        const key = String(item.id);
        const current = merged.get(key);
        if (current) current.matches += 1;
        else merged.set(key, { item, matches: 1, order: order++ });
      }),
    );
    return [...merged.values()].sort((a, b) => b.matches - a.matches || a.order - b.order).map(({ item }) => item);
  };
  useEffect(() => {
    let cancelled = false;
    const terms = interestTerms.length ? interestTerms : query.trim() ? [query.trim()] : [];
    const load = async () => {
      setError("");
      if (!terms.length) {
        setPosts([]);
        setMarket([]);
        setBlogs([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const endpoint = (term: string) => (tab === "posts" ? `/posts?scope=public&${interestTerms.length ? `interest=${encodeURIComponent(term)}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}` : `q=${encodeURIComponent(term)}`}&sort=latest&page=1&size=20` : tab === "market" ? `/market/items?q=${encodeURIComponent(interestTerms.length ? `#${term}` : term)}&sort=latest&page=1&size=20` : `/blogs?q=${encodeURIComponent(term)}&page=1&size=20`);
      const results = await Promise.allSettled(terms.map((term) => request<Post[] | MarketItem[] | SearchBlog[]>(endpoint(term))));
      if (cancelled) return;
      setSearching(false);
      const fulfilled = results.filter((result): result is PromiseFulfilledResult<Post[] | MarketItem[] | SearchBlog[]> => result.status === "fulfilled").map((result) => result.value ?? []);
      if (tab === "posts") setPosts(rankMerged(fulfilled as Post[][]));
      else if (tab === "market") setMarket(rankMerged(fulfilled as MarketItem[][]));
      else setBlogs(rankMerged(fulfilled as SearchBlog[][]));
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") setError(String(failed.reason?.message ?? failed.reason));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [query, tab, interestKey]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextParams = new URLSearchParams({ tab });
    interestTerms.forEach((term) => nextParams.append("interest", term));
    if (query.trim()) nextParams.set("q", query.trim());
    go(`/search?${nextParams.toString()}`);
  };
  const selectTab = (next: "posts" | "market" | "blogs") => {
    setTab(next);
    const nextParams = new URLSearchParams();
    nextParams.set("tab", next);
    interestTerms.forEach((term) => nextParams.append("interest", term));
    if (query.trim()) nextParams.set("q", query.trim());
    go(`/search?${nextParams.toString()}`);
  };
  const activeCount = tab === "posts" ? posts.length : tab === "market" ? market.length : blogs.length;
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="page-main">
        <div className="section-inner">
          <div className="page-intro">
            <p className="eyebrow">INTEGRATED SEARCH</p>
            <h1 className="font-jua">{interestTerms.length ? "내 관심사 검색 결과" : `‘${query}’ 검색 결과`}</h1>
            {interestTerms.length > 0 && (
              <div className="interest-search-terms" aria-label="검색에 사용된 관심사">
                {interestTerms.map((term) => (
                  <span key={term}>#{term}</span>
                ))}
              </div>
            )}
            <form className="feed-search" onSubmit={submit}>
              <Search size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="글, 마켓, 블로그 검색" />
            </form>
          </div>
          <div className="manage-tabs">
            <div>
              <button className={tab === "posts" ? "active" : ""} onClick={() => selectTab("posts")}>
                글 <em>{posts.length}</em>
              </button>
              <button className={tab === "market" ? "active" : ""} onClick={() => selectTab("market")}>
                마켓 <em>{market.length}</em>
              </button>
              <button className={tab === "blogs" ? "active" : ""} onClick={() => selectTab("blogs")}>
                블로그 <em>{blogs.length}</em>
              </button>
            </div>
          </div>
          {error && <p className="form-error">일부 검색 결과를 불러오지 못했습니다. {error}</p>}
          {searching ? (
            <ContentSkeleton rows={4} />
          ) : activeCount ? (
            <div className="feed-list">
              {tab === "posts"
                ? posts.map((post) => <PostRow key={post.id} post={post} go={go} />)
                : tab === "market"
                  ? market.map((item) => <MarketRow key={item.id} item={item} go={go} />)
                  : blogs.map((blog) => (
                      <article className="feed-row" key={blog.id}>
                        <div>
                          <p className="post-blog">BLOG</p>
                          <h2>
                            <button onClick={() => go(`/blog/${blog.slug}`)}>{blog.name}</button>
                          </h2>
                          <p className="excerpt">{blog.description || "블로그 소개가 없습니다."}</p>
                          <small>
                            {blog.owner?.nickname || "블로거"} · /blog/
                            {blog.slug}
                          </small>
                        </div>
                      </article>
                    ))}
            </div>
          ) : (
            <Empty text="관심사와 일치하는 결과가 없습니다." detail="다른 검색어를 입력하거나 관심분야를 변경해보세요." />
          )}
        </div>
      </main>
    </Shell>
  );
}

function StaticHub({ kind, go, user, onLogin }: { kind: "skin" | "ai"; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const skin = kind === "skin";
  return (
    <Shell go={go} user={user} onLogin={onLogin}>
      <main id="main" className="page-main">
        <div className="section-inner">
          <div className="page-intro">
            <p className="eyebrow">{skin ? "JUNGLETORY SKIN" : "JUNGLETORY AI"}</p>
            <h1>{skin ? "내 블로그에 어울리는 스킨을 만나보세요." : "AI 미션을 시작해보세요."}</h1>
            <p className="muted">{skin ? "다양한 레이아웃의 스킨을 둘러보고 블로그에 적용할 수 있습니다." : "AI 기능은 준비 중입니다."}</p>
          </div>
        </div>
      </main>
    </Shell>
  );
}

function InterestMockup({ go }: { go: (to: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (name: string) => setSelected((current) => (current.includes(name) ? current.filter((item) => item !== name) : current.length < 8 ? [...current, name] : current));
  return (
    <main id="main" className="auth-page interest-step-page">
      <section className="auth-panel interest-step-panel">
        <header className="interest-step-top">
          <button className="auth-brand" onClick={() => go("/")}>
            정글토리
          </button>
          <div>
            <span>01</span>
            <i />
            <b>02</b>
            <i />
            <span>03</span>
          </div>
        </header>
        <div className="interest-step-intro">
          <p className="eyebrow">CREATE YOUR SPACE · STEP 02</p>
          <h1>관심분야를 선택해주세요.</h1>
          <p className="interest-step-description">선택한 분야는 글 분류와 콘텐츠 추천에 활용됩니다.</p>
        </div>
        <div className="interest-step-heading">
          <strong>관심분야</strong>
          <span aria-live="polite">
            <b>{selected.length}</b>개 선택 <em>/ 최대 8개</em>
          </span>
        </div>
        <div className="interest-step-options" role="group" aria-label="관심분야 선택">
          {interestCatalog.map((interest) => {
            const active = selected.includes(interest);
            return (
              <button type="button" aria-pressed={active} className={active ? "active" : ""} onClick={() => toggle(interest)} key={interest}>
                {active && <Check size={13} />}
                <span>{interest}</span>
              </button>
            );
          })}
        </div>
        <p className={selected.length === 8 ? "interest-step-guide limit" : "interest-step-guide"}>{selected.length === 8 ? "최대 8개까지 선택할 수 있습니다." : "1개 이상, 최대 8개까지 선택해주세요."}</p>
        <footer className="interest-step-actions">
          <button className="interest-step-back" onClick={() => go("/signup")}>
            <ArrowLeft size={14} /> 이전
          </button>
          <button className="primary-button" disabled={!selected.length} onClick={() => go("/blog/new")}>
            다음 단계 <ArrowRight size={16} />
          </button>
        </footer>
      </section>
    </main>
  );
}

const CHAT_BALL_POSITION_KEY = 'jungletory.market-chat-ball.v1'
const CHAT_REACTIONS: { type: ChatReaction; emoji: string; label: string }[] = [
  { type: 'HEART', emoji: '❤️', label: '하트' },
  { type: 'CHECK', emoji: '✅', label: '확인' },
  { type: 'THUMBS_UP', emoji: '👍', label: '엄지척' },
  { type: 'SAD', emoji: '😢', label: '슬퍼요' },
  { type: 'COOL', emoji: '😎', label: '멋져요' },
  { type: 'LAUGH', emoji: '😂', label: '웃겨요' },
]
const reactionMeta = (type: ChatReaction) => CHAT_REACTIONS.find((item) => item.type === type) ?? CHAT_REACTIONS[0]
const clampChatBall = (position: { x: number; y: number }) => ({
  x: Math.max(12, Math.min(window.innerWidth - 72, position.x)),
  y: Math.max(72, Math.min(window.innerHeight - 72, position.y)),
})

function MarketChatDock({ user, onLogin }: { user: User | null; onLogin: () => void }) {
  const [open, setOpen] = useState(false)
  const [rooms, setRooms] = useState<Conversation[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [reactionPicker, setReactionPicker] = useState<number | string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [position, setPosition] = useState(() => {
    try { return clampChatBall(JSON.parse(localStorage.getItem(CHAT_BALL_POSITION_KEY) ?? 'null') ?? { x: window.innerWidth - 88, y: window.innerHeight - 104 }) }
    catch { return clampChatBall({ x: window.innerWidth - 88, y: window.innerHeight - 104 }) }
  })
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const messageList = useRef<HTMLDivElement | null>(null)
  const positionedRoom = useRef<string | null>(null)
  const unread = rooms.reduce((sum, room) => sum + (room.unreadCount ?? 0), 0)

  const loadRooms = async () => {
    if (!user) { setRooms([]); return }
    try { setRooms(await request<Conversation[]>('/market/conversations') ?? []); setError('') }
    catch (reason) { setError((reason as Error).message) }
  }
  const loadMessages = async (room: Conversation, markRead = true) => {
    try {
      const next = await request<ChatMessage[]>(`/market/conversations/${room.id}/messages`) ?? []
      setMessages((current) => {
        const pending = current.filter((entry) => entry.pending)
        return [...next, ...pending.filter((entry) => !next.some((saved) => saved.body === entry.body && saved.createdAt >= entry.createdAt))]
      })
      const hasUnreadReceivedMessage = next.some((entry) => String(entry.senderId) !== String(user?.id) && !entry.readAt)
      if (markRead && hasUnreadReceivedMessage) {
        await request(`/market/conversations/${room.id}/read`, { method: 'POST' })
        setRooms((current) => current.map((item) => String(item.id) === String(room.id) ? { ...item, unreadCount: 0 } : item))
      }
      setError('')
    } catch (reason) { setError((reason as Error).message) }
  }

  useEffect(() => { void loadRooms() }, [user?.id])
  useEffect(() => {
    if (!user) return
    return subscribeMarketChatChanges((conversationId) => {
      void loadRooms()
      if (open && active && (!conversationId || String(conversationId) === String(active.id))) void loadMessages(active)
    })
  }, [user?.id, open, active?.id])
  useEffect(() => { if (open && active) void loadMessages(active) }, [open, active?.id])
  useLayoutEffect(() => {
    if (!active || !messageList.current || !messages.length) return
    const roomId = String(active.id)
    const firstPosition = positionedRoom.current !== roomId
    messageList.current.scrollTo({ top: messageList.current.scrollHeight, behavior: firstPosition ? 'auto' : 'smooth' })
    positionedRoom.current = roomId
  }, [open, active?.id, messages[messages.length - 1]?.id])
  useEffect(() => {
    const resize = () => setPosition((current) => clampChatBall(current))
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, offsetX: event.clientX - position.x, offsetY: event.clientY - position.y, moved: false }
  }
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const next = clampChatBall({ x: event.clientX - drag.current.offsetX, y: event.clientY - drag.current.offsetY })
    if (Math.abs(next.x - position.x) > 3 || Math.abs(next.y - position.y) > 3) drag.current.moved = true
    setPosition(next)
  }
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    suppressClick.current = drag.current.moved
    const finalPosition = clampChatBall({ x: event.clientX - drag.current.offsetX, y: event.clientY - drag.current.offsetY })
    setPosition(finalPosition)
    drag.current = null
    localStorage.setItem(CHAT_BALL_POSITION_KEY, JSON.stringify(finalPosition))
  }
  const toggle = () => {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (!user) return onLogin()
    setOpen((value) => !value)
    void loadRooms()
  }
  const selectRoom = (room: Conversation) => { setActive(room); setReplyingTo(null); setReactionPicker(null); void loadMessages(room) }
  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!active || !body || !user) return
    const optimisticId = `pending-${crypto.randomUUID()}`
    const optimistic: ChatMessage = {
      id: optimisticId, conversationId: active.id, senderId: user.id, body,
      createdAt: new Date().toISOString(), pending: true,
      replyTo: replyingTo ? { id: replyingTo.id, body: replyingTo.body, senderId: replyingTo.senderId } : null,
      reactions: [],
    }
    setDraft(''); setReplyingTo(null); setSending(true); setMessages((current) => [...current, optimistic])
    try {
      const sent = await request<ChatMessage>(`/market/conversations/${active.id}/messages`, {
        method: 'POST', body: JSON.stringify({ body, replyToMessageId: optimistic.replyTo?.id ?? null }),
      })
      setMessages((current) => current.some((entry) => String(entry.id) === String(sent.id))
        ? current.filter((entry) => entry.id !== optimisticId)
        : current.map((entry) => entry.id === optimisticId ? { ...sent, replyTo: optimistic.replyTo } : entry))
      void loadRooms()
    } catch (reason) {
      setMessages((current) => current.filter((entry) => entry.id !== optimisticId)); setDraft(body); setError((reason as Error).message)
    } finally { setSending(false) }
  }

  const toggleReaction = async (message: ChatMessage, type: ChatReaction) => {
    if (!active || message.pending || message.deletedAt) return
    const previous = message.reactions ?? []
    const selected = previous.find((item) => item.type === type)
    const activeNext = !selected?.reactedByMe
    const next = selected
      ? previous.map((item) => item.type === type ? { ...item, count: Math.max(0, item.count + (activeNext ? 1 : -1)), reactedByMe: activeNext } : item).filter((item) => item.count > 0)
      : [...previous, { type, count: 1, reactedByMe: true }]
    setMessages((current) => current.map((entry) => String(entry.id) === String(message.id) ? { ...entry, reactions: next } : entry))
    setReactionPicker(null)
    try {
      await request(`/market/conversations/${active.id}/messages/${message.id}/reactions`, {
        method: activeNext ? 'PUT' : 'DELETE', body: JSON.stringify({ reaction: type }),
      })
    } catch (reason) {
      setMessages((current) => current.map((entry) => String(entry.id) === String(message.id) ? { ...entry, reactions: previous } : entry))
      setError((reason as Error).message)
    }
  }

  const deleteChatMessage = async (message: ChatMessage) => {
    if (!active || message.pending || !confirm('이 메시지를 삭제할까요?')) return
    const previous = messages
    setMessages((current) => current.map((entry) => String(entry.id) === String(message.id) ? { ...entry, body: '', deletedAt: new Date().toISOString(), reactions: [] } : entry))
    try { await request(`/market/conversations/${active.id}/messages/${message.id}`, { method: 'DELETE' }) }
    catch (reason) { setMessages(previous); setError((reason as Error).message) }
  }

  const leaveRoom = async () => {
    if (!active || !confirm('이 채팅방에서 나갈까요? 내 채팅 목록에서 숨겨집니다.')) return
    const leaving = active
    setActive(null); setMessages([]); setReplyingTo(null); setRooms((current) => current.filter((room) => String(room.id) !== String(leaving.id)))
    try { await request(`/market/conversations/${leaving.id}`, { method: 'DELETE' }) }
    catch (reason) { setRooms((current) => [leaving, ...current]); setError((reason as Error).message) }
  }

  return <>
    <button className={`market-chat-float${open ? ' active' : ''}`} style={{ left: position.x, top: position.y }} aria-label={user ? `다이렉트 메시지${unread ? `, 읽지 않은 메시지 ${unread}개` : ''}` : '로그인하고 다이렉트 메시지 열기'} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={toggle}>
      <Send size={24} fill="currentColor" />{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
    </button>
    {open && user && <aside className="market-chat-inbox" aria-label="마켓 다이렉트 메시지">
      <header><div><small>DIRECT MESSAGE</small><strong>{active ? active.peer?.nickname ?? '채팅' : '마켓 채팅'}</strong></div><span className="market-chat-head-actions">{active && <button onClick={leaveRoom} aria-label="채팅방 나가기" title="채팅방 나가기"><LogOut size={16} /></button>}<button onClick={() => setOpen(false)} aria-label="채팅함 닫기"><X size={18} /></button></span></header>
      {active ? <>
        <button className="market-chat-back" onClick={() => { setActive(null); setMessages([]) }}><ArrowLeft size={14} /> 모든 대화 <span>{active.item?.title}</span></button>
        <div className="market-chat-inbox-messages" ref={messageList}>{messages.length ? messages.map((entry) => {
          const mine = String(entry.senderId) === String(user.id)
          return <div className={`chat-message${mine ? ' mine' : ''}${entry.pending ? ' pending' : ''}${entry.deletedAt ? ' deleted' : ''}`} key={entry.id}>
            <div className="chat-message-bubble">
              {entry.replyTo && <button className="chat-reply-preview" onClick={() => document.getElementById(`chat-message-${entry.replyTo?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><strong>{String(entry.replyTo.senderId) === String(user.id) ? '내 메시지' : active.peer?.nickname ?? '상대방'}</strong><span>{entry.replyTo.body || '삭제된 메시지입니다.'}</span></button>}
              <p id={`chat-message-${entry.id}`}>{entry.deletedAt ? '삭제된 메시지입니다.' : entry.body}</p>
              {!entry.deletedAt && <div className="chat-message-actions">
                <button onClick={() => setReplyingTo(entry)} aria-label="답장"><MessageCircle size={12} /> 답장</button>
                <button onClick={() => setReactionPicker((current) => current === entry.id ? null : entry.id)} aria-label="반응 남기기">＋ 반응</button>
                {mine && <button onClick={() => deleteChatMessage(entry)} aria-label="메시지 삭제"><Trash2 size={11} /></button>}
              </div>}
              {reactionPicker === entry.id && <div className="chat-reaction-picker">{CHAT_REACTIONS.map((reaction) => <button key={reaction.type} title={reaction.label} aria-label={reaction.label} onClick={() => toggleReaction(entry, reaction.type)}>{reaction.emoji}</button>)}</div>}
              {!entry.deletedAt && !!entry.reactions?.length && <div className="chat-reaction-summary">{entry.reactions.map((reaction) => <button className={reaction.reactedByMe ? 'active' : ''} key={reaction.type} title={reactionMeta(reaction.type).label} onClick={() => toggleReaction(entry, reaction.type)}><span>{reactionMeta(reaction.type).emoji}</span>{reaction.count}</button>)}</div>}
            </div>
            <time>{entry.pending ? '전송 중…' : new Date(entry.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        }) : <p className="market-chat-empty">아직 메시지가 없습니다.</p>}</div>
        {replyingTo && <div className="market-chat-replying"><span><strong>{String(replyingTo.senderId) === String(user.id) ? '내 메시지' : active.peer?.nickname ?? '상대방'}에게 답장</strong>{replyingTo.body}</span><button onClick={() => setReplyingTo(null)} aria-label="답장 취소"><X size={14} /></button></div>}
        <form onSubmit={sendMessage}><input maxLength={1000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={replyingTo ? '답장을 입력하세요' : '메시지를 입력하세요'} /><button disabled={!draft.trim() || sending} aria-label="메시지 전송"><Send size={17} /></button></form>
      </> : <div className="market-chat-room-list">{rooms.length ? rooms.map((room) => <button key={room.id} onClick={() => selectRoom(room)}><span className={`market-chat-peer${room.peer?.profileImageUrl ? ' has-photo' : ''}`} style={room.peer?.profileImageUrl ? { backgroundImage: `url(${room.peer.profileImageUrl})` } : undefined} aria-label={`${room.peer?.nickname ?? '상대방'} 프로필 이미지`}>{room.peer?.profileImageUrl ? '' : room.peer?.nickname?.[0] ?? '?'}</span><span><strong>{room.peer?.nickname ?? '상대방'}</strong><small>{room.item?.title ?? '마켓 상품'}</small><p>{room.lastMessage?.body ?? '대화를 시작해 보세요.'}</p></span>{(room.unreadCount ?? 0) > 0 && <b>{room.unreadCount}</b>}</button>) : <p className="market-chat-empty">아직 시작한 마켓 대화가 없습니다.<br />상품에서 채팅하기를 눌러 시작해 보세요.</p>}</div>}
      {error && <p className="market-chat-error">{error}</p>}
    </aside>}
  </>
}

function App() {
  const { path, go } = useRoute();
  const [cachedUser, setCachedUser] = useState<User | null>(() => readAuthSnapshot());
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "anonymous" | "degraded">("loading");
  const [requiresConsent, setRequiresConsent] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const aiMission = useAiMission(user?.id ?? null, request);
  const [aiVisitedUserId, setAiVisitedUserId] = useState<number | null>(() => cachedUser && readAiDockEnabled(cachedUser.id) ? cachedUser.id : null);
  useEffect(() => {
    if (path !== "/ai" || !user?.id) return;
    writeAiDockEnabled(user.id, true);
    setAiVisitedUserId(user.id);
    aiMission.setDock("open");
  }, [path, user?.id, aiMission.setDock]);
  useEffect(() => {
    if (authState === "anonymous") setAiVisitedUserId(null);
  }, [authState]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const data = await request<{
            user: User;
            blog: Blog | null;
            requiresThirdPartyConsent: boolean;
          }>("/me");
          if (cancelled) return;
          let blog = data.blog;
          if (blog) {
            try {
              const publicBlog = await request<{ blog: Blog }>(`/blogs/${blog.slug}?page=1&size=1`);
              blog = {
                ...blog,
                profileImageUrl: publicBlog.blog.profileImageUrl,
                subscriberCount: publicBlog.blog.subscriberCount,
              };
            } catch {
              /* Keep authentication usable when public blog enrichment is temporarily unavailable. */
            }
          }
          if (cancelled) return;
          setUser({ ...data.user, blog });
          setRequiresConsent(data.requiresThirdPartyConsent);
          setAuthState("authenticated");
          return;
        } catch (error) {
          if (cancelled) return;
          if (error instanceof ApiRequestError && error.status === 401) {
            if (cachedUser && attempt < 2) {
              await new Promise((resolve) => window.setTimeout(resolve, [250, 750][attempt]));
              continue;
            }
            setUser(null);
            setCachedUser(null);
            clearClientAuthState();
            setAuthState("anonymous");
            return;
          }
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, [250, 1_000][attempt]));
        }
      }
      if (!cancelled) setAuthState(cachedUser ? "authenticated" : "anonymous");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    if (cachedUser && cachedUser.id !== user.id) clearUserQueryState();
    writeAuthSnapshot(user);
    setCachedUser(user);
    setAuthState("authenticated");
  }, [user]);
  useEffect(() => {
    if (user?.passwordChangeRequired && path !== "/change-password") go("/change-password");
  }, [user?.passwordChangeRequired, path]);
  useEffect(() => {
    const updateProfile = (event: Event) => {
      const profileImageUrl = (event as CustomEvent<string | null>).detail;
      setUser((current) => (current?.blog ? { ...current, blog: { ...current.blog, profileImageUrl } } : current));
    };
    window.addEventListener("blog-profile-updated", updateProfile);
    return () => window.removeEventListener("blog-profile-updated", updateProfile);
  }, []);
  const onLogin = () => setLoginOpen(true);
  const authPending = authState === "loading" || authState === "degraded";
  const visibleUser = user ?? (authPending ? cachedUser : null);
  const publicWhileAuthLoads = path.startsWith("/adminpage") || path === "/" || path === "/login" || path === "/signup" || path === "/interests/mockup" || /^\/notice\/\d+$/.test(path) || path === "/feed" || path === "/search" || path === "/skin" || path === "/market" || path === "/market/recent" || path === "/market/cart" || path === "/market/price-guide" || path === "/market/coupons" || /^\/market\/\d+$/.test(path) || /^\/post\/\d+$/.test(path) || (/^\/blog\/[^/]+$/.test(path) && path !== "/blog/new");
  let content: React.ReactNode;
  if (path.startsWith("/adminpage")) content = <AdminPage />;
  else if ((authState === "loading" || authState === "degraded") && !publicWhileAuthLoads)
    content = (
      <Shell go={go} user={null} onLogin={onLogin}>
        <main id="main" className="page-main">
          <div className="section-inner auth-route-loading">
            <ContentSkeleton rows={5} />
          </div>
        </main>
      </Shell>
    );
  else if (path === "/interests/mockup") content = <InterestMockup go={go} />;
  else if (path === "/login")
    content = (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser, needsConsent) => {
          setUser(nextUser);
          setRequiresConsent(needsConsent);
          go(needsConsent ? "/agreement/third-party-consent" : "/");
        }}
      />
    );
  else if (path === "/signup")
    content = (
      <Auth
        mode="signup"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go("/blog/new");
        }}
      />
    );
  else if (path === "/change-password")
    content = user?.passwordChangeRequired ? <PasswordChange go={go} onDone={() => setUser((current) => current ? { ...current, passwordChangeRequired: false } : current)} /> : <Home go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/agreement/third-party-consent")
    content =
      user && requiresConsent ? (
        <Agreement go={go} onDecided={() => setRequiresConsent(false)} />
      ) : user ? (
        <Home go={go} user={user} onLogin={onLogin} />
      ) : (
        <Auth
          mode="login"
          go={go}
          onSuccess={(nextUser, needsConsent) => {
            setUser(nextUser);
            setRequiresConsent(needsConsent);
            go(needsConsent ? "/agreement/third-party-consent" : "/");
          }}
        />
      );
  else if (path === "/notice/2702") content = <NoticeArticle go={go} />;
  else if (/^\/notice\/\d+$/.test(path)) content = <PostDetail id={path.split("/").pop()!} go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/blog/new")
    content = (
      <BlogSetup
        go={go}
        onDone={(blog) => {
          setUser((current) => (current ? { ...current, blog } : current));
          go(blog.url ?? "/blog/" + blog.slug);
        }}
      />
    );
  else if (path === "/feed") content = <Feed go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/bookmarks") content = <BookmarkedPosts go={go} user={user} onLogin={onLogin} />;
  else if (path === "/notifications")
    content = user ? (
      <NotificationsPage go={go} user={user} onLogin={onLogin} />
    ) : (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go("/notifications");
        }}
      />
    );
  else if (path === "/search") content = <SearchPage go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/market/new")
    content = user ? (
      <MarketEditor go={go} />
    ) : (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go("/market/new");
        }}
      />
    );
  else if (/^\/market\/\d+\/edit$/.test(path))
    content = user ? (
      <MarketEditor id={path.split("/")[2]} go={go} />
    ) : (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go(path);
        }}
      />
    );
  else if (path === "/market/recent") content = <MarketSavedList kind="recent" go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/market/wishlist") content = <MarketSavedList kind="wishlist" go={go} user={user} onLogin={onLogin} />;
  else if (path === "/market/wallet")
    content = user ? (
      <MarketWallet go={go} user={user} onLogin={onLogin} />
    ) : (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go("/market/wallet");
        }}
      />
    );
  else if (path === "/market/cart") content = <MarketPrepared kind="cart" go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/market/price-guide") content = <MarketPrepared kind="price-guide" go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/market/coupons") content = <MarketPrepared kind="coupons" go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/market") content = <Market go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path.startsWith("/market/")) content = <MarketDetail id={path.split("/")[2]} go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/skin") content = <Market go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path === "/ai")
    content = user ? (
      <Shell go={go} user={user} onLogin={onLogin}>
        <AiMissionPage controller={aiMission} nickname={user.nickname} go={go} />
      </Shell>
    ) : (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go("/ai");
        }}
      />
    );
  else if (path === "/write")
    content = user ? (
      <Editor go={go} user={user} />
    ) : (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go("/write");
        }}
      />
    );
  else if (path === "/blog/me/manage" || path.startsWith("/blog/me/manage/")) content = <Manage path={path} go={go} user={user} onLogin={onLogin} onUserChange={setUser} onWithdraw={() => { setUser(null); setCachedUser(null); setAuthState("anonymous"); go("/"); }} />;
  else if (path.startsWith("/post/") && path.endsWith("/edit"))
    content = user ? (
      <Editor id={path.split("/")[2]} go={go} user={user} />
    ) : (
      <Auth
        mode="login"
        go={go}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          go(path);
        }}
      />
    );
  else if (path.startsWith("/post/")) content = <PostDetail id={path.split("/")[2]} go={go} user={visibleUser} onLogin={onLogin} />;
  else if (path.startsWith("/blog/")) content = <BlogPage slug={path.split("/")[2]} go={go} user={visibleUser} onLogin={onLogin} />;
  else content = <Home go={go} user={visibleUser} onLogin={onLogin} />;

  return (
    <AuthBootstrapContext.Provider value={{ pending: authPending, cachedUser }}>
      <div className={authPending ? "auth-verifying" : undefined} aria-busy={authPending}>
        {content}
        {!path.startsWith("/adminpage") && <AiCompanionDock
          controller={aiMission}
          path={path}
          go={go}
          enabled={Boolean(user?.id && aiVisitedUserId === user.id)}
          onDismiss={() => {
            if (user?.id) writeAiDockEnabled(user.id, false);
            setAiVisitedUserId(null);
          }}
        />}
        {!path.startsWith("/adminpage") && <MarketChatDock user={visibleUser} onLogin={onLogin} />}
      </div>
      {loginOpen && (
        <div className="modal-backdrop jungletory-login-backdrop" role="dialog" aria-modal="true" aria-label="정글토리 로그인" onMouseDown={() => setLoginOpen(false)}>
          <div className="login-modal jungletory-login-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setLoginOpen(false)} aria-label="닫기">
              <X size={20} />
            </button>
            <strong className="login-wordmark">JUNGLETORY</strong>
            <p className="login-description">회원가입한 이메일과 비밀번호로 로그인하세요.</p>
            <ProgressiveImage eager className="login-visual" src={assetUrl("jungletory/login.png")} alt="" />
            <button
              className="kakao-login-button"
              onClick={() => {
                setLoginOpen(false);
                go("/login");
              }}
            >
              <span>✉</span> 이메일로 로그인
            </button>
            <button
              className="login-help"
              onClick={() => {
                setLoginOpen(false);
                go("/signup");
              }}
            >
              처음이라면 회원가입
            </button>
          </div>
        </div>
      )}
    </AuthBootstrapContext.Provider>
  );
}
export default App;
