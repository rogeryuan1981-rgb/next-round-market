import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Page = "market" | "sell" | "account" | "guide" | "admin";
type AuctionType = "timed" | "dutch" | "fixed";

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "member" | "admin";
  contact_info: string | Record<string, unknown> | null;
  bio: string | null;
  first_listing_approved_at: string | null;
  suspended_at: string | null;
};

type Listing = {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_avatar_url: string | null;
  title: string;
  description: string;
  auction_type: AuctionType;
  status: string;
  condition_code: string;
  condition_label: string;
  sealed_status: string;
  completeness: string;
  missing_parts_notes: string | null;
  mold_level: string;
  mold_notes: string | null;
  box_condition: string;
  manual_condition: string;
  component_condition: string;
  language: string;
  start_price: number;
  current_price: number;
  bid_increment: number;
  buy_now_price: number | null;
  dutch_floor_price: number | null;
  dutch_drop_amount: number | null;
  dutch_drop_interval_minutes: number | null;
  starts_at: string | null;
  ends_at: string | null;
  extension_enabled: boolean;
  extension_trigger_minutes: number;
  extension_minutes: number;
  second_chance_enabled: boolean;
  fulfillment_methods: string[];
  external_link_timing: string;
  public_external_link: string | null;
  meetup_location: string | null;
  shipping_notes: string | null;
  created_at: string;
  first_listing_submission: boolean;
  cover_image_path: string | null;
  bid_count: number;
  seller_rating: number | null;
  seller_review_count: number;
};

type TransactionMessage = {
  id: string;
  transaction_id: string;
  sender_id: string;
  sender_name: string;
  message_text: string;
  created_at: string;
};

type TransactionLinkHistory = {
  id: string;
  previous_link: string | null;
  new_link: string;
  changed_by: string;
  changed_by_name: string;
  created_at: string;
};

type PublicReview = {
  id: string;
  author_name: string;
  overall_rating: number;
  description_rating: number | null;
  communication_rating: number;
  review_text: string;
  created_at: string;
  photos: Array<{ storage_path: string; sort_order: number }>;
};

type ListingPhoto = {
  url: string;
  storage_path: string;
  created_at: string;
};

type DescriptionHistory = {
  id: string;
  changed_by_name: string;
  previous_description: string | null;
  new_description: string;
  created_at: string;
};

type DashboardData = {
  profile: Profile | null;
  listings: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  second_chance_offers: Array<Record<string, unknown>>;
};

type AdminData = {
  pending_listings: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
};

type MemberStatus = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "member" | "admin";
  account_status: "active" | "suspended" | "profile_pending";
  suspended_at: string | null;
  first_listing_approved_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  listing_count: number;
  active_listing_count: number;
  transaction_count: number;
  report_count: number;
  open_report_count: number;
  average_rating: number | null;
  review_count: number;
};

const auctionLabels: Record<AuctionType, string> = {
  timed: "定時競標",
  dutch: "荷蘭式競標",
  fixed: "直接購買"
};

const statusLabels: Record<string, string> = {
  draft: "草稿",
  pending_review: "等待管理員審核",
  active: "進行中",
  sold: "已成交",
  ended: "已結束",
  removed: "管理員下架",
  rejected: "未通過審核",
  pending: "等待回覆",
  accepted: "已接受",
  declined: "已婉拒",
  expired: "已逾期"
};

const conditionLabels: Record<string, string> = {
  new_sealed: "全新未拆：原廠封膜或封條完整",
  opened_unplayed: "已拆未玩：僅拆封檢查，未實際遊玩",
  opened_excellent: "近新：少量使用痕跡，功能完整",
  opened_good: "良好：正常使用痕跡，不影響遊玩",
  well_used: "明顯使用：磨損明顯但仍可遊玩",
  parts_copy: "補件用：缺件或損壞，供補件使用"
};

const itemConditionLabels: Record<string, string> = {
  excellent: "近新",
  good: "良好",
  worn: "明顯磨損",
  damaged: "破損",
  missing: "缺少",
  not_included: "官方未提供",
  mixed: "各零件狀況不一（於商品說明處說明）"
};

const sealedStatusLabels: Record<string, string> = {
  factory_sealed: "原廠封膜／封條完整",
  opened: "已拆封",
  resealed: "重新包膜或重新封裝",
  unknown: "官方未封裝"
};

const completenessLabels: Record<string, string> = {
  complete: "依說明書確認完整",
  minor_missing: "少量缺件，仍可遊玩",
  major_missing: "重大缺件或僅供補件",
  unknown: "未清點／無法確認"
};

function partConditionLabel(
  value: string,
  part: "box" | "manual" | "component"
) {
  if (value === "missing") {
    return part === "box" ? "外盒遺失" : "說明書遺失";
  }
  if (value === "not_included") return "官方未提供";
  return itemConditionLabels[value] ?? value;
}

const moldLabels: Record<string, string> = {
  none: "無霉味、無可見霉斑",
  odor_only: "有霉味，但未見霉斑",
  light: "輕微：少量局部霉點",
  moderate: "中度：多處可見霉斑",
  heavy: "重度：大面積霉斑或明顯受潮"
};

function money(value: unknown) {
  return `NT$ ${Number(value ?? 0).toLocaleString("zh-TW")}`;
}

function dateTime(value: unknown) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(String(value)));
}

function contactInfoText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(contactInfoText).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = contactInfoText(item).trim();
        if (!text) return "";
        const labels: Record<string, string> = {
          text: "",
          value: "",
          email: "Email",
          line: "LINE",
          line_id: "LINE",
          phone: "電話",
          facebook: "Facebook",
          note: "備註"
        };
        const label = labels[key] ?? key;
        return label ? `${label}：${text}` : text;
      })
      .filter(Boolean);
    return entries.join("\n");
  }
  return "";
}

function remainingTime(value: string | null) {
  if (!value) return "無結標期限";
  const difference = new Date(value).getTime() - Date.now();
  if (difference <= 0) return "已結標";
  const days = Math.floor(difference / 86400000);
  const hours = Math.floor((difference % 86400000) / 3600000);
  const minutes = Math.floor((difference % 3600000) / 60000);
  if (days > 0) return `${days} 天 ${hours} 小時`;
  return `${hours} 小時 ${minutes} 分`;
}

function publicPhoto(path: unknown) {
  if (!path || typeof path !== "string") return "";
  return supabase.storage.from("listing-photos").getPublicUrl(path).data
    .publicUrl;
}

function publicReviewPhoto(path: unknown) {
  if (!path || typeof path !== "string") return "";
  return supabase.storage.from("review-photos").getPublicUrl(path).data
    .publicUrl;
}

function currentDutchPrice(listing: Listing) {
  if (
    listing.auction_type !== "dutch" ||
    !listing.starts_at ||
    !listing.dutch_drop_amount ||
    !listing.dutch_drop_interval_minutes ||
    listing.dutch_floor_price === null
  ) {
    return Number(listing.current_price);
  }

  const elapsed = Math.max(
    0,
    Date.now() - new Date(listing.starts_at).getTime()
  );
  const steps = Math.floor(
    elapsed / (listing.dutch_drop_interval_minutes * 60000)
  );
  return Math.max(
    Number(listing.dutch_floor_price),
    Number(listing.start_price) - steps * Number(listing.dutch_drop_amount)
  );
}

function errorText(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error ?? "發生未知錯誤");

  const translations: Record<string, string> = {
    LOGIN_REQUIRED: "請先登入。",
    CONTACT_INFO_REQUIRED: "請先在會員中心填寫成交聯絡資訊。",
    FIRST_LISTING_VERIFICATION_PHOTO_REQUIRED:
      "第一件商品必須包含手寫驗證紙條照片。",
    MAXIMUM_MUST_FOLLOW_BID_INCREMENT: "自動出價上限不符合每標加價規則。",
    USE_BUY_NOW_INSTEAD: "此金額已達直購價，請直接使用直購。",
    SECOND_CHANCE_NOT_ACCEPTED_AT_LISTING_TIME:
      "刊登時沒有啟用承接制，因此不能邀請第二順位。",
    BUYER_DEFAULT_MUST_BE_CONFIRMED_BY_ADMIN:
      "必須先檢舉買家未付款，並由管理員確認後才能提出承接。",
    TRANSACTION_PARTICIPANT_REQUIRED: "只有這筆交易的買賣雙方可以使用此功能。",
    MESSAGE_LENGTH_INVALID: "訊息必須是 1 至 2,000 個字。",
    REVIEW_ALREADY_SUBMITTED: "你已經送出這筆交易的評價，不能重複評價。",
    REVIEW_TEXT_LENGTH_INVALID: "評價內容必須是 10 至 2,000 個字。",
    INVALID_REVIEW_PHOTOS: "評價最多可附 5 張照片。",
    DESCRIPTION_TOO_SHORT: "商品說明至少需要 20 個字。",
    DESCRIPTION_UNCHANGED: "商品說明沒有變更。",
    LISTING_PHOTO_BATCH_LIMIT: "每次只能新增 1 至 10 張商品照片。",
    LISTING_PHOTO_TOTAL_LIMIT: "每件商品最多保留 30 張照片。",
    LISTING_DOES_NOT_ACCEPT_NEW_PHOTOS: "已下架或未通過審核的商品不能新增照片。",
    LISTING_PHOTOS_ARE_IMMUTABLE: "商品照片送出後不能修改或刪除。"
  };

  const matched = Object.keys(translations).find((key) =>
    message.includes(key)
  );
  return matched ? translations[matched] : message;
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Notice({
  tone = "info",
  children
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`} role="status">
      {children}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPage] = useState<Page>("market");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState("");

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,display_name,avatar_url,role,contact_info,bio,first_listing_approved_at,suspended_at"
      )
      .eq("id", userId)
      .single();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void loadProfile(data.session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) {
          void loadProfile(nextSession.user.id);
        } else {
          setProfile(null);
          setPage("market");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  async function signIn() {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) setMessage(errorText(error));
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function requireLogin(destination?: Page) {
    if (!session) {
      setMessage("請先使用 Google 帳號登入。");
      void signIn();
      return false;
    }
    if (destination) setPage(destination);
    return true;
  }

  function openListing(id: string) {
    setSelectedListingId(id);
    setPage("market");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button
          className="brand"
          type="button"
          onClick={() => {
            setSelectedListingId(null);
            setPage("market");
          }}
          aria-label="Next Round Market 首頁"
        >
          <span className="brand-mark" aria-hidden="true">
            ↻
          </span>
          <span>
            <strong>Next Round Market</strong>
            <small>讓每一盒桌遊，都有下一局。</small>
          </span>
        </button>

        <nav aria-label="主要選單">
          <button
            type="button"
            onClick={() => {
              setSelectedListingId(null);
              setPage("market");
            }}
          >
            瀏覽商品
          </button>
          <button type="button" onClick={() => setPage("guide")}>
            使用說明
          </button>
          <button type="button" onClick={() => requireLogin("sell")}>
            刊登商品
          </button>
          {session && (
            <button type="button" onClick={() => setPage("account")}>
              會員中心
            </button>
          )}
          {profile?.role === "admin" && (
            <button type="button" onClick={() => setPage("admin")}>
              管理後台
            </button>
          )}
          {session ? (
            <button className="account-button" type="button" onClick={signOut}>
              登出
            </button>
          ) : (
            <button className="account-button" type="button" onClick={signIn}>
              使用 Google 登入
            </button>
          )}
        </nav>
      </header>

      {message && (
        <div className="global-message">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>
            關閉
          </button>
        </div>
      )}

      <main>
        {page === "market" && selectedListingId && (
          <ListingDetail
            listingId={selectedListingId}
            session={session}
            profile={profile}
            onBack={() => setSelectedListingId(null)}
            onRequireLogin={() => requireLogin()}
            onMessage={setMessage}
          />
        )}

        {page === "market" && !selectedListingId && (
          <MarketPage onOpen={openListing} />
        )}

        {page === "sell" && session && profile && (
          <SellPage
            session={session}
            profile={profile}
            onFinished={(text) => {
              setMessage(text);
              setPage("account");
              void loadProfile(session.user.id);
            }}
          />
        )}

        {page === "account" && session && (
          <AccountPage
            session={session}
            onOpen={openListing}
            onProfileChanged={() => loadProfile(session.user.id)}
            onMessage={setMessage}
          />
        )}

        {page === "guide" && <GuidePage />}

        {page === "admin" && profile?.role === "admin" && (
          <AdminPage onMessage={setMessage} />
        )}
      </main>

      <footer>
        <div>
          <strong>Next Round Market</strong>
          <span>讓每一盒桌遊，都有下一局。</span>
        </div>
        <p>
          本站僅提供資訊刊登、競價與聯絡媒合，不經手款項，也不驗證商品或交易。
        </p>
      </footer>
    </div>
  );
}

function MarketPage({ onOpen }: { onOpen: (id: string) => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [auctionType, setAuctionType] = useState("all");
  const [, tick] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("market_listings_public")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (loadError) setError(errorText(loadError));
      else setListings((data ?? []) as Listing[]);
      setLoading(false);
    }
    void load();
    const timer = window.setInterval(() => tick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-TW");
    return listings.filter(
      (listing) =>
        (!keyword ||
          listing.title.toLocaleLowerCase("zh-TW").includes(keyword) ||
          listing.description.toLocaleLowerCase("zh-TW").includes(keyword)) &&
        (auctionType === "all" || listing.auction_type === auctionType)
    );
  }, [auctionType, listings, search]);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">二手桌遊拍賣市集</span>
          <h1>把收藏交給下一位玩家，展開新的回合。</h1>
          <p>
            定時競標、荷蘭式競標與直購均由資料庫正式執行；每件商品都必須使用實物照片並依統一標準揭露狀況。
          </p>
          <a className="primary-button" href="#market">
            查看進行中的拍賣
          </a>
        </div>
        <div className="hero-art" aria-label="桌遊盒與棋子的品牌插圖">
          <div className="board-box">NEXT ROUND</div>
          <span className="meeple meeple-one">♟</span>
          <span className="meeple meeple-two">◆</span>
          <span className="meeple meeple-three">●</span>
        </div>
      </section>

      <section className="trust-strip" aria-label="平台重點">
        <span>📷 全部使用實拍照片</span>
        <span>🧾 第一件商品人工審核</span>
        <span>🕒 出價紀錄不可撤回</span>
        <span>🤝 成交後自行聯絡交易</span>
      </section>

      <section className="market-section" id="market">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MARKETPLACE</span>
            <h2>進行中的拍賣</h2>
          </div>
          <div className="filters">
            <Field label="搜尋商品">
              <input
                type="search"
                value={search}
                placeholder="輸入桌遊名稱或說明"
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            <Field label="拍賣方式">
              <select
                value={auctionType}
                onChange={(event) => setAuctionType(event.target.value)}
              >
                <option value="all">全部方式</option>
                <option value="timed">定時競標</option>
                <option value="dutch">荷蘭式競標</option>
                <option value="fixed">直接購買</option>
              </select>
            </Field>
          </div>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}
        {loading ? (
          <div className="empty-state">商品載入中…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <strong>目前沒有符合條件的公開商品</strong>
            <span>第一批桌遊上架後，就會出現在這裡。</span>
          </div>
        ) : (
          <div className="listing-grid">
            {filtered.map((listing) => {
              const displayPrice =
                listing.auction_type === "dutch"
                  ? currentDutchPrice(listing)
                  : listing.current_price;
              return (
                <article className="listing-card" key={listing.id}>
                  <button
                    className="card-click-area"
                    type="button"
                    onClick={() => onOpen(listing.id)}
                  >
                    <div className="listing-image">
                      {listing.cover_image_path ? (
                        <img
                          src={publicPhoto(listing.cover_image_path)}
                          alt={`${listing.title} 商品實拍`}
                          loading="lazy"
                        />
                      ) : (
                        <span>尚無商品照片</span>
                      )}
                      <strong className="auction-badge">
                        {auctionLabels[listing.auction_type]}
                      </strong>
                    </div>
                    <div className="listing-content">
                      <div className="condition-row">
                        <span>{listing.condition_label}</span>
                        {listing.mold_level !== "none" && (
                          <span className="warning-badge">發霉狀況已揭露</span>
                        )}
                      </div>
                      <h3>{listing.title}</h3>
                      <div className="price-row">
                        <span>
                          {listing.auction_type === "fixed"
                            ? "售價"
                            : listing.auction_type === "dutch"
                              ? "目前可接受價"
                              : "目前出價"}
                        </span>
                        <strong>{money(displayPrice)}</strong>
                      </div>
                      {listing.buy_now_price !== null &&
                        listing.auction_type === "timed" && (
                          <p className="buy-now">
                            可直購 {money(listing.buy_now_price)}
                          </p>
                        )}
                      <div className="card-footer">
                        <span>{remainingTime(listing.ends_at)}</span>
                        <span>{listing.bid_count} 次出價</span>
                      </div>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rules-preview">
        <span className="eyebrow">ZERO TOLERANCE</span>
        <h2>遊戲規則先說清楚，違規零容忍。</h2>
        <div className="rule-grid">
          <article>
            <strong>只能使用本人實拍</strong>
            <p>禁止官方圖、網拍圖或其他網路圖片；每件商品至少一張照片。</p>
          </article>
          <article>
            <strong>瑕疵必須完整揭露</strong>
            <p>缺件、霉味與可見霉斑均可刊登，但不得隱瞞，並應提供近照。</p>
          </article>
          <article>
            <strong>出價及直購不能取消</strong>
            <p>使用者與管理員都不能任意刪除合法出價或取消已成立交易。</p>
          </article>
        </div>
      </section>
    </>
  );
}

function ListingDetail({
  listingId,
  session,
  profile,
  onBack,
  onRequireLogin,
  onMessage
}: {
  listingId: string;
  session: Session | null;
  profile: Profile | null;
  onBack: () => void;
  onRequireLogin: () => boolean;
  onMessage: (value: string) => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [descriptionHistory, setDescriptionHistory] = useState<DescriptionHistory[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [maximumBid, setMaximumBid] = useState("");
  const [acceptablePrice, setAcceptablePrice] = useState("");
  const [working, setWorking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("listing_violation");
  const [reportDescription, setReportDescription] = useState("");
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const [listingResult, photoResult, reviewResult, historyResult] = await Promise.all([
      supabase
        .from("market_listings_public")
        .select("*")
        .eq("id", listingId)
        .single(),
      supabase
        .from("market_listing_photos_public")
        .select("storage_path,sort_order,created_at")
        .eq("listing_id", listingId)
        .order("sort_order"),
      supabase
        .from("market_listing_reviews_public")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false }),
      supabase
        .from("market_listing_description_history_public")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: true })
    ]);
    if (listingResult.error) {
      onMessage(errorText(listingResult.error));
      return;
    }
    setListing(listingResult.data as Listing);
    setPhotos(
      (photoResult.data ?? []).map((photo) => ({
        url: publicPhoto(photo.storage_path),
        storage_path: photo.storage_path,
        created_at: photo.created_at
      }))
    );
    setReviews((reviewResult.data ?? []) as PublicReview[]);
    setDescriptionHistory((historyResult.data ?? []) as DescriptionHistory[]);
  }, [listingId, onMessage]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => tick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function execute(
    action: () => PromiseLike<{ error: unknown }>,
    success: string
  ) {
    if (!onRequireLogin()) return;
    if (!profile?.contact_info) {
      onMessage("請先到會員中心填寫成交聯絡資訊，再進行出價或購買。");
      return;
    }
    setWorking(true);
    const result = await action();
    setWorking(false);
    if (result.error) onMessage(errorText(result.error));
    else {
      onMessage(success);
      await load();
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!onRequireLogin() || !listing) return;
    setWorking(true);
    const { error } = await supabase.rpc("submit_market_report", {
      requested_listing_id: listing.id,
      requested_transaction_id: null,
      requested_reported_user_id: listing.seller_id,
      requested_category: reportCategory,
      requested_description: reportDescription
    });
    setWorking(false);
    if (error) onMessage(errorText(error));
    else {
      setReportOpen(false);
      setReportDescription("");
      onMessage("檢舉已送出，管理員將保留紀錄並進行審查。");
    }
  }

  if (!listing) return <div className="page-loading">商品資料載入中…</div>;

  const isSeller = session?.user.id === listing.seller_id;
  const dutchPrice = currentDutchPrice(listing);
  const active = listing.status === "active";

  return (
    <section className="detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        ← 返回市集
      </button>

      <div className="detail-layout">
        <div className="photo-gallery">
          <div className="main-photo">
            {photos[activePhoto] ? (
              <>
                <img src={photos[activePhoto].url} alt={`${listing.title} 實拍照片`} />
                <span className="photo-timestamp">
                  照片新增時間：{dateTime(photos[activePhoto].created_at)}
                </span>
              </>
            ) : (
              <span>尚無照片</span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="thumbnail-row">
              {photos.map((photo, index) => (
                <button
                  type="button"
                  className={index === activePhoto ? "active" : ""}
                  onClick={() => setActivePhoto(index)}
                  key={photo.storage_path}
                >
                  <img src={photo.url} alt={`第 ${index + 1} 張商品照片`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-summary">
          <div className="badge-row">
            <span className="auction-badge static">
              {auctionLabels[listing.auction_type]}
            </span>
            <span className={`status-badge status-${listing.status}`}>
              {statusLabels[listing.status] ?? listing.status}
            </span>
          </div>
          <h1>{listing.title}</h1>
          <p className="seller-line">
            賣家：{listing.seller_name} · {listing.seller_review_count > 0
              ? `★ ${Number(listing.seller_rating).toFixed(1)}（${listing.seller_review_count} 則評價）`
              : "尚無評價"}
          </p>

          <div className="price-panel">
            <span>
              {listing.auction_type === "fixed"
                ? "直購價"
                : listing.auction_type === "dutch"
                  ? "當下價格"
                  : "目前出價"}
            </span>
            <strong>
              {money(
                listing.auction_type === "dutch"
                  ? dutchPrice
                  : listing.current_price
              )}
            </strong>
            {listing.ends_at && <b>{remainingTime(listing.ends_at)}</b>}
          </div>

          {active && !isSeller && listing.auction_type === "timed" && (
            <div className="action-panel">
              <h2>設定自動出價上限</h2>
              <p>
                系統只會依每標 {money(listing.bid_increment)} 自動加價；你的最高上限不會公開。修改上限會保留軌跡，也不會降低目前公開出價。
              </p>
              <div className="inline-action">
                <input
                  type="number"
                  min={listing.start_price}
                  step={listing.bid_increment}
                  value={maximumBid}
                  onChange={(event) => setMaximumBid(event.target.value)}
                  placeholder={`最低 ${listing.start_price}`}
                />
                <button
                  className="primary-button"
                  type="button"
                  disabled={working || !maximumBid}
                  onClick={() =>
                    execute(
                      () =>
                        supabase.rpc("place_proxy_bid", {
                          requested_listing_id: listing.id,
                          requested_maximum: Number(maximumBid)
                        }),
                      "自動出價上限已設定。出價不可自行取消。"
                    )
                  }
                >
                  確認出價
                </button>
              </div>
              {listing.buy_now_price !== null && (
                <button
                  className="buy-button"
                  type="button"
                  disabled={working}
                  onClick={() => {
                    if (
                      window.confirm(
                        `確定以 ${money(listing.buy_now_price)} 直接購買？成立後不能取消。`
                      )
                    ) {
                      void execute(
                        () =>
                          supabase.rpc("buy_listing_now", {
                            requested_listing_id: listing.id
                          }),
                        "直購成立，請到會員中心查看交易聯絡資訊。"
                      );
                    }
                  }}
                >
                  以 {money(listing.buy_now_price)} 直接購買
                </button>
              )}
            </div>
          )}

          {active && !isSeller && listing.auction_type === "dutch" && (
            <div className="action-panel">
              <h2>荷蘭式競標</h2>
              <p>
                每 {listing.dutch_drop_interval_minutes} 分鐘降價 {money(listing.dutch_drop_amount)}，最低降至 {money(listing.dutch_floor_price)}。第一位接受當下價格的人得標。
              </p>
              <button
                className="buy-button"
                type="button"
                disabled={working}
                onClick={() => {
                  if (
                    window.confirm(
                      `確定接受目前價格 ${money(dutchPrice)}？成立後不能取消。`
                    )
                  ) {
                    void execute(
                      () =>
                        supabase.rpc("accept_dutch_price", {
                          requested_listing_id: listing.id
                        }),
                      "你已接受當下價格並得標，請到會員中心查看交易資訊。"
                    );
                  }
                }}
              >
                接受目前價格 {money(dutchPrice)}
              </button>
              <div className="inline-action secondary-action">
                <input
                  type="number"
                  value={acceptablePrice}
                  min={listing.dutch_floor_price ?? 0}
                  max={listing.start_price}
                  step={listing.dutch_drop_amount ?? 1}
                  onChange={(event) => setAcceptablePrice(event.target.value)}
                  placeholder="可接受價格"
                />
                <button
                  type="button"
                  disabled={working || !acceptablePrice}
                  onClick={() =>
                    execute(
                      () =>
                        supabase.rpc("set_dutch_limit", {
                          requested_listing_id: listing.id,
                          requested_acceptable_price: Number(acceptablePrice)
                        }),
                      "可接受價格已設定；到價時系統會依規則處理。"
                    )
                  }
                >
                  設定到價接受
                </button>
              </div>
            </div>
          )}

          {active && !isSeller && listing.auction_type === "fixed" && (
            <div className="action-panel">
              <button
                className="buy-button"
                type="button"
                disabled={working}
                onClick={() => {
                  if (
                    window.confirm(
                      `確定以 ${money(listing.buy_now_price)} 購買？成立後不能取消。`
                    )
                  ) {
                    void execute(
                      () =>
                        supabase.rpc("buy_listing_now", {
                          requested_listing_id: listing.id
                        }),
                      "購買成立，請到會員中心查看交易資訊。"
                    );
                  }
                }}
              >
                直接購買 {money(listing.buy_now_price)}
              </button>
            </div>
          )}

          {isSeller && (
            <Notice tone="info">
              這是你的商品。已有出價或交易成立後，刊登者與管理員都不能任意取消。
            </Notice>
          )}
        </div>
      </div>

      <div className="detail-sections">
        <section>
          <h2>商品說明</h2>
          <p className="preserve-lines">{listing.description}</p>
          {descriptionHistory.length > 0 && (
            <details className="description-history">
              <summary>查看商品說明完整版本紀錄（{descriptionHistory.length} 版）</summary>
              <ol>
                {descriptionHistory.map((history, index) => (
                  <li key={history.id}>
                    <div>
                      <strong>第 {index + 1} 版 · {history.changed_by_name}</strong>
                      <time>{dateTime(history.created_at)}</time>
                    </div>
                    <p className="preserve-lines">{history.new_description}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
        <section>
          <h2>站方統一狀況定義</h2>
          <dl className="condition-list">
            <div>
              <dt>整體狀況</dt>
              <dd>{conditionLabels[listing.condition_code]}</dd>
            </div>
            <div>
              <dt>封裝狀態</dt>
              <dd>
                {sealedStatusLabels[listing.sealed_status] ?? listing.sealed_status}
              </dd>
            </div>
            <div>
              <dt>完整程度</dt>
              <dd>
                {completenessLabels[listing.completeness] ?? listing.completeness}
              </dd>
            </div>
            <div>
              <dt>缺件說明</dt>
              <dd>{listing.missing_parts_notes || "賣家表示無缺件"}</dd>
            </div>
            <div>
              <dt>發霉程度</dt>
              <dd>{moldLabels[listing.mold_level]}</dd>
            </div>
            <div>
              <dt>發霉補充</dt>
              <dd>{listing.mold_notes || "無"}</dd>
            </div>
            <div>
              <dt>外盒／說明書／配件</dt>
              <dd>
                {partConditionLabel(listing.box_condition, "box")}／
                {partConditionLabel(listing.manual_condition, "manual")}／
                {partConditionLabel(listing.component_condition, "component")}
              </dd>
            </div>
            <div>
              <dt>語言</dt>
              <dd>{listing.language}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h2>拍賣與交付規則</h2>
          <ul className="fact-list">
            <li>開始：{dateTime(listing.starts_at)}</li>
            <li>結束：{dateTime(listing.ends_at)}</li>
            {listing.auction_type === "timed" && (
              <li>每標加價：{money(listing.bid_increment)}</li>
            )}
            <li>
              自動延長：
              {listing.extension_enabled
                ? `最後 ${listing.extension_trigger_minutes} 分鐘有新出價，就延長 ${listing.extension_minutes} 分鐘`
                : "未啟用"}
            </li>
            <li>
              第二順位承接：{listing.second_chance_enabled ? "刊登時已同意" : "不適用"}
            </li>
            <li>
              交付方式：
              {listing.fulfillment_methods
                .map((method) =>
                  method === "meetup"
                    ? "面交"
                    : method === "shipping"
                      ? "寄送"
                      : "外部拍賣／交易連結"
                )
                .join("、")}
            </li>
          </ul>
          {listing.public_external_link && (
            <a
              className="external-link"
              href={listing.public_external_link}
              target="_blank"
              rel="noreferrer"
            >
              開啟賣家預先提供的交易連結 ↗
            </a>
          )}
        </section>
      </div>

      <section className="reviews-section">
        <div className="section-heading compact-heading">
          <div>
            <span className="eyebrow">VERIFIED TRANSACTIONS</span>
            <h2>成交買家評價</h2>
          </div>
          <p>只有本站成交買家能留下商品與賣家評價，送出後不可修改或刪除。</p>
        </div>
        {reviews.length === 0 ? (
          <div className="empty-state">這件商品目前尚無成交評價。</div>
        ) : (
          <div className="review-grid">
            {reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-heading">
                  <div>
                    <strong>{review.author_name}</strong>
                    <span>{dateTime(review.created_at)}</span>
                  </div>
                  <span className="stars" aria-label={`${review.overall_rating} 顆星`}>
                    {"★".repeat(review.overall_rating)}{"☆".repeat(5 - review.overall_rating)}
                  </span>
                </div>
                <p className="preserve-lines">{review.review_text}</p>
                <div className="review-scores">
                  {review.description_rating !== null && (
                    <span>描述相符 {review.description_rating}/5</span>
                  )}
                  <span>溝通體驗 {review.communication_rating}/5</span>
                </div>
                {review.photos.length > 0 && (
                  <div className="review-photo-row">
                    {review.photos.map((photo) => (
                      <a
                        href={publicReviewPhoto(photo.storage_path)}
                        target="_blank"
                        rel="noreferrer"
                        key={photo.storage_path}
                      >
                        <img src={publicReviewPhoto(photo.storage_path)} alt="成交評價實拍" />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <Notice tone="warning">
        Next Round Market 僅提供刊登、競價與聯絡媒合，不經手款項，不驗證商品真偽、品質、付款或交付。請交易雙方自行核對商品與交易條件。
      </Notice>

      <div className="report-area">
        <button type="button" onClick={() => setReportOpen((value) => !value)}>
          檢舉這件商品
        </button>
        {reportOpen && (
          <form className="report-form" onSubmit={submitReport}>
            <Field label="檢舉原因">
              <select
                value={reportCategory}
                onChange={(event) => setReportCategory(event.target.value)}
              >
                <option value="non_actual_photo">疑似使用網路或非本人照片</option>
                <option value="listing_violation">刊登內容違規</option>
                <option value="description_mismatch">商品描述可能不符</option>
                <option value="other">其他</option>
              </select>
            </Field>
            <Field label="具體說明" hint="至少 10 個字，請提供可供管理員判斷的事實。">
              <textarea
                required
                minLength={10}
                value={reportDescription}
                onChange={(event) => setReportDescription(event.target.value)}
              />
            </Field>
            <button className="danger-button" type="submit" disabled={working}>
              送出檢舉
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function SellPage({
  session,
  profile,
  onFinished
}: {
  session: Session;
  profile: Profile;
  onFinished: (message: string) => void;
}) {
  const isFirst = !profile.first_listing_approved_at;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  const localValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    title: "",
    description: "",
    auction_type: "timed" as AuctionType,
    condition_code: "opened_good",
    sealed_status: "opened",
    completeness: "complete",
    missing_parts_notes: "",
    mold_level: "none",
    mold_notes: "",
    box_condition: "good",
    manual_condition: "good",
    component_condition: "good",
    language: "繁體中文",
    start_price: "100",
    bid_increment: "50",
    buy_now_enabled: false,
    buy_now_price: "",
    dutch_floor_price: "",
    dutch_drop_amount: "50",
    dutch_drop_interval_minutes: "60",
    starts_at: localValue(tomorrow),
    ends_at: localValue(nextWeek),
    extension_enabled: true,
    extension_trigger_minutes: "5",
    extension_minutes: "5",
    second_chance_enabled: false,
    meetup: true,
    shipping: false,
    external_link: false,
    external_link_timing: "after_sale",
    external_link_url: "",
    meetup_location: "",
    shipping_notes: "",
    actual_photos_confirmed: false,
    rules_accepted: false
  });
  const [files, setFiles] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!profile.contact_info) {
      setError("請先到會員中心填寫成交聯絡資訊，再刊登商品。");
      return;
    }
    if (files.length < 1) {
      setError("每件商品至少需要一張本人實際拍攝的照片。");
      return;
    }
    if (files.length > 10) {
      setError("每件商品最多上傳 10 張照片。");
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("只能上傳照片檔案。");
      return;
    }
    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("單張照片不能超過 8 MB。");
      return;
    }

    setWorking(true);
    const listingId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${session.user.id}/${listingId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
      }

      const methods = [
        form.meetup ? "meetup" : null,
        form.shipping ? "shipping" : null,
        form.external_link ? "external_link" : null
      ].filter(Boolean);

      const payload = {
        ...form,
        fulfillment_methods: methods,
        starts_at:
          form.auction_type === "fixed"
            ? new Date().toISOString()
            : new Date(form.starts_at).toISOString(),
        ends_at:
          form.auction_type === "fixed"
            ? null
            : new Date(form.ends_at).toISOString(),
        buy_now_price:
          form.auction_type === "fixed"
            ? form.start_price
            : form.buy_now_enabled
              ? form.buy_now_price
              : null,
        external_link_timing: form.external_link
          ? form.external_link_timing
          : "none"
      };

      const photoRows = uploadedPaths.map((path, index) => ({
        storage_path: path,
        sort_order: index,
        is_verification_photo: isFirst && index === 0
      }));

      const { data, error: createError } = await supabase.rpc(
        "create_market_listing",
        {
          requested_listing_id: listingId,
          requested_payload: payload,
          requested_photos: photoRows
        }
      );

      if (createError) throw createError;

      const result = data as { requires_review?: boolean } | null;
      onFinished(
        result?.requires_review
          ? "第一件商品已送交管理員審核；通過後才會公開，之後即可自行刊登。"
          : "商品已正式刊登。"
      );
    } catch (submitError) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("listing-photos").remove(uploadedPaths);
      }
      setError(errorText(submitError));
      setWorking(false);
    }
  }

  return (
    <section className="form-page">
      <div className="page-heading">
        <span className="eyebrow">SELL A GAME</span>
        <h1>刊登二手桌遊</h1>
        <p>送出前請逐項確認；有出價或直購成立後不能自行取消。</p>
      </div>

      {isFirst && (
        <Notice tone="warning">
          這是此帳號第一件商品，送出後需由管理員審核。第一張照片必須同時拍到商品與手寫紙條；紙條請寫「Next Round Market」、你的顯示名稱及拍攝日期。
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}

      <form className="listing-form" onSubmit={submit}>
        <fieldset>
          <legend>1. 商品基本資料</legend>
          <div className="form-grid two-columns">
            <Field label="桌遊名稱">
              <input
                required
                minLength={2}
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </Field>
            <Field label="語言版本">
              <input
                required
                value={form.language}
                onChange={(event) => update("language", event.target.value)}
              />
            </Field>
          </div>
          <Field
            label="商品說明"
            hint="至少 20 個字；請寫清楚版本、配件、使用狀況及任何買家應注意的事項。"
          >
            <textarea
              required
              minLength={20}
              rows={6}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>
        </fieldset>

        <fieldset>
          <legend>2. 統一商品狀況</legend>
          <div className="form-grid three-columns">
            <Field label="整體新舊程度">
              <select
                value={form.condition_code}
                onChange={(event) => update("condition_code", event.target.value)}
              >
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="封裝狀態">
              <select
                value={form.sealed_status}
                onChange={(event) => update("sealed_status", event.target.value)}
              >
                <option value="factory_sealed">原廠封膜／封條完整</option>
                <option value="opened">已拆封</option>
                <option value="resealed">重新包膜或重新封裝</option>
                <option value="unknown">官方未封裝</option>
              </select>
            </Field>
            <Field label="完整程度">
              <select
                value={form.completeness}
                onChange={(event) => update("completeness", event.target.value)}
              >
                <option value="complete">依說明書確認完整</option>
                <option value="minor_missing">少量缺件，仍可遊玩</option>
                <option value="major_missing">重大缺件或僅供補件</option>
                <option value="unknown">未清點／無法確認</option>
              </select>
            </Field>
            <Field label="外盒狀況">
              <select
                value={form.box_condition}
                onChange={(event) => update("box_condition", event.target.value)}
              >
                <ConditionOptions
                  includeMissing
                  missingLabel="外盒遺失"
                />
              </select>
            </Field>
            <Field label="說明書狀況">
              <select
                value={form.manual_condition}
                onChange={(event) => update("manual_condition", event.target.value)}
              >
                <ConditionOptions
                  includeMissing
                  includeNotIncluded
                  missingLabel="說明書遺失"
                  notIncludedLabel="官方未提供"
                />
              </select>
            </Field>
            <Field label="配件狀況">
              <select
                value={form.component_condition}
                onChange={(event) => update("component_condition", event.target.value)}
              >
                <ConditionOptions includeMixed />
              </select>
            </Field>
          </div>
          <Field label="缺件／未清點說明">
            <textarea
              required={form.completeness !== "complete"}
              value={form.missing_parts_notes}
              onChange={(event) =>
                update("missing_parts_notes", event.target.value)
              }
              placeholder="若有缺件或未清點，必須具體說明"
            />
          </Field>
          <div className="form-grid two-columns">
            <Field label="發霉程度">
              <select
                value={form.mold_level}
                onChange={(event) => update("mold_level", event.target.value)}
              >
                {Object.entries(moldLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="發霉補充說明"
              hint="有霉味或霉斑時必填，並請上傳清楚近照。"
            >
              <input
                required={form.mold_level !== "none"}
                value={form.mold_notes}
                onChange={(event) => update("mold_notes", event.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend>3. 實物照片</legend>
          <Notice tone="info">
            只能上傳你親自拍攝的實物照片，不得使用官方圖、網拍圖、搜尋結果或他人照片。發霉、破損及缺件必須拍清楚。
          </Notice>
          <Field label="選擇照片" hint="1–10 張，每張最多 8 MB。">
            <input
              type="file"
              accept="image/*"
              multiple
              required
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </Field>
          {files.length > 0 && (
            <div className="selected-files">
              {files.map((file, index) => (
                <span key={`${file.name}-${index}`}>
                  {index + 1}. {file.name}
                  {isFirst && index === 0 ? "（手寫驗證照）" : ""}
                </span>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>4. 銷售模式與價格</legend>
          <div className="auction-choice-grid">
            {(["timed", "dutch", "fixed"] as AuctionType[]).map((type) => (
              <label
                className={form.auction_type === type ? "selected" : ""}
                key={type}
              >
                <input
                  type="radio"
                  name="auction-type"
                  checked={form.auction_type === type}
                  onChange={() => update("auction_type", type)}
                />
                <strong>{auctionLabels[type]}</strong>
                <span>
                  {type === "timed"
                    ? "依每標金額競價，可選直購與自動延長"
                    : type === "dutch"
                      ? "價格按時間下降，第一位接受者得標"
                      : "不經拍賣，第一位確認購買者成交"}
                </span>
              </label>
            ))}
          </div>

          <div className="form-grid three-columns">
            <Field
              label={form.auction_type === "fixed" ? "售價" : "起始價"}
            >
              <input
                type="number"
                min="0"
                required
                value={form.start_price}
                onChange={(event) => update("start_price", event.target.value)}
              />
            </Field>
            {form.auction_type === "timed" && (
              <Field label="每標加價金額">
                <input
                  type="number"
                  min="1"
                  required
                  value={form.bid_increment}
                  onChange={(event) => update("bid_increment", event.target.value)}
                />
              </Field>
            )}
            {form.auction_type === "dutch" && (
              <>
                <Field label="最低價">
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.dutch_floor_price}
                    onChange={(event) =>
                      update("dutch_floor_price", event.target.value)
                    }
                  />
                </Field>
                <Field label="每次降價金額">
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.dutch_drop_amount}
                    onChange={(event) =>
                      update("dutch_drop_amount", event.target.value)
                    }
                  />
                </Field>
                <Field label="降價間隔（分鐘）">
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.dutch_drop_interval_minutes}
                    onChange={(event) =>
                      update("dutch_drop_interval_minutes", event.target.value)
                    }
                  />
                </Field>
              </>
            )}
          </div>

          {form.auction_type === "timed" && (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.buy_now_enabled}
                  onChange={(event) =>
                    update("buy_now_enabled", event.target.checked)
                  }
                />
                <span>提供直購價，買家可直接跳過拍賣</span>
              </label>
              {form.buy_now_enabled && (
                <Field label="直購價">
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.buy_now_price}
                    onChange={(event) =>
                      update("buy_now_price", event.target.value)
                    }
                  />
                </Field>
              )}
            </>
          )}

          {form.auction_type !== "fixed" && (
            <div className="form-grid two-columns">
              <Field label="開始時間">
                <input
                  type="datetime-local"
                  required
                  value={form.starts_at}
                  onChange={(event) => update("starts_at", event.target.value)}
                />
              </Field>
              <Field label="結束時間">
                <input
                  type="datetime-local"
                  required
                  value={form.ends_at}
                  onChange={(event) => update("ends_at", event.target.value)}
                />
              </Field>
            </div>
          )}

          {form.auction_type === "timed" && (
            <div className="option-box">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.extension_enabled}
                  onChange={(event) =>
                    update("extension_enabled", event.target.checked)
                  }
                />
                <span>啟用自動延長結標</span>
              </label>
              {form.extension_enabled && (
                <div className="form-grid two-columns">
                  <Field label="結標前幾分鐘有出價就延長">
                    <input
                      type="number"
                      min="1"
                      value={form.extension_trigger_minutes}
                      onChange={(event) =>
                        update("extension_trigger_minutes", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="每次延長幾分鐘">
                    <input
                      type="number"
                      min="1"
                      value={form.extension_minutes}
                      onChange={(event) =>
                        update("extension_minutes", event.target.value)
                      }
                    />
                  </Field>
                </div>
              )}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.second_chance_enabled}
                  onChange={(event) =>
                    update("second_chance_enabled", event.target.checked)
                  }
                />
                <span>
                  同意棄標成立並經管理員確認後，可詢問第二順位是否依其最後公開有效價格承接；未勾選就沒有承接制
                </span>
              </label>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>5. 成交後的交易方式</legend>
          <div className="check-grid">
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.meetup}
                onChange={(event) => update("meetup", event.target.checked)}
              />
              <span>面交</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.shipping}
                onChange={(event) => update("shipping", event.target.checked)}
              />
              <span>寄送</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.external_link}
                onChange={(event) => update("external_link", event.target.checked)}
              />
              <span>外部拍賣／交易連結</span>
            </label>
          </div>
          {form.meetup && (
            <Field label="可面交地區">
              <input
                value={form.meetup_location}
                onChange={(event) => update("meetup_location", event.target.value)}
                placeholder="例如：台北捷運藍線各站"
              />
            </Field>
          )}
          {form.shipping && (
            <Field label="寄送說明">
              <input
                value={form.shipping_notes}
                onChange={(event) => update("shipping_notes", event.target.value)}
                placeholder="例如：超商店到店，運費由買家負擔"
              />
            </Field>
          )}
          {form.external_link && (
            <>
              <Field label="何時提供連結">
                <select
                  value={form.external_link_timing}
                  onChange={(event) =>
                    update("external_link_timing", event.target.value)
                  }
                >
                  <option value="before_sale">刊登時先提供</option>
                  <option value="after_sale">成交後由賣家提供</option>
                </select>
              </Field>
              {form.external_link_timing === "before_sale" && (
                <Field label="外部交易連結">
                  <input
                    type="url"
                    required
                    value={form.external_link_url}
                    onChange={(event) =>
                      update("external_link_url", event.target.value)
                    }
                  />
                </Field>
              )}
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>6. 最後確認</legend>
          <label className="check-row important-check">
            <input
              type="checkbox"
              required
              checked={form.actual_photos_confirmed}
              onChange={(event) =>
                update("actual_photos_confirmed", event.target.checked)
              }
            />
            <span>我確認全部照片都是本人實際拍攝，沒有使用任何網路商品圖。</span>
          </label>
          <label className="check-row important-check">
            <input
              type="checkbox"
              required
              checked={form.rules_accepted}
              onChange={(event) =>
                update("rules_accepted", event.target.checked)
              }
            />
            <span>
              我已完整揭露商品狀況，並同意出價、直購及成交後不得自行取消；平台不驗證商品與交易，也不經手款項。
            </span>
          </label>
        </fieldset>

        <button className="submit-button" type="submit" disabled={working}>
          {working
            ? "正在上傳照片與建立刊登…"
            : isFirst
              ? "送出第一件商品審核"
              : "正式刊登商品"}
        </button>
      </form>
    </section>
  );
}

function ConditionOptions({
  includeMissing = false,
  includeNotIncluded = false,
  includeMixed = false,
  missingLabel = "缺少",
  notIncludedLabel = "官方未提供"
}: {
  includeMissing?: boolean;
  includeNotIncluded?: boolean;
  includeMixed?: boolean;
  missingLabel?: string;
  notIncludedLabel?: string;
}) {
  return (
    <>
      <option value="excellent">近新，幾乎無痕跡</option>
      <option value="good">良好，有正常使用痕跡</option>
      <option value="worn">明顯磨損</option>
      <option value="damaged">破損</option>
      {includeMissing && <option value="missing">{missingLabel}</option>}
      {includeNotIncluded && (
        <option value="not_included">{notIncludedLabel}</option>
      )}
      {includeMixed && (
        <option value="mixed">
          各零件狀況不一（於商品說明處說明）
        </option>
      )}
    </>
  );
}

function AccountPage({
  session,
  onOpen,
  onProfileChanged,
  onMessage
}: {
  session: Session;
  onOpen: (id: string) => void;
  onProfileChanged: () => void;
  onMessage: (value: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [bio, setBio] = useState("");
  const [working, setWorking] = useState(false);
  const [reviewedTransactions, setReviewedTransactions] = useState<Set<string>>(
    new Set()
  );
  const [activeThread, setActiveThread] = useState<Record<string, unknown> | null>(
    null
  );
  const [activeReview, setActiveReview] = useState<Record<string, unknown> | null>(
    null
  );
  const [photoListing, setPhotoListing] = useState<Record<string, unknown> | null>(
    null
  );
  const [descriptionListing, setDescriptionListing] = useState<Record<string, unknown> | null>(
    null
  );

  const load = useCallback(async () => {
    const [{ data: result, error }, reviewResult] = await Promise.all([
      supabase.rpc("get_my_market_dashboard"),
      supabase
        .from("transaction_reviews")
        .select("transaction_id")
        .eq("author_id", session.user.id)
    ]);
    if (error) {
      onMessage(errorText(error));
      return;
    }
    const dashboard = result as DashboardData;
    setData(dashboard);
    setDisplayName(dashboard.profile?.display_name ?? "");
    setContactInfo(contactInfoText(dashboard.profile?.contact_info));
    setBio(dashboard.profile?.bio ?? "");
    setReviewedTransactions(
      new Set((reviewResult.data ?? []).map((row) => String(row.transaction_id)))
    );
  }, [onMessage, session.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    const { error } = await supabase.rpc("update_my_market_profile", {
      requested_display_name: displayName,
      requested_contact_info: contactInfo,
      requested_bio: bio
    });
    setWorking(false);
    if (error) onMessage(errorText(error));
    else {
      onMessage("會員資料已更新。聯絡資訊只會在成交後提供給交易對方。 ");
      onProfileChanged();
      await load();
    }
  }

  async function transactionReport(transaction: Record<string, unknown>) {
    const category = window.prompt(
      "輸入檢舉代碼：buyer_no_payment（買家不付款）、seller_no_shipment（賣家不出貨）、description_mismatch（描述不符）、missing_transaction_method（未提供交易方式）"
    );
    if (!category) return;
    const description = window.prompt("請具體說明事件經過（至少 10 個字）：");
    if (!description) return;
    const reportedUser =
      transaction.my_role === "seller"
        ? transaction.buyer_id
        : transaction.seller_id;
    const { error } = await supabase.rpc("submit_market_report", {
      requested_listing_id: transaction.listing_id,
      requested_transaction_id: transaction.id,
      requested_reported_user_id: reportedUser,
      requested_category: category,
      requested_description: description
    });
    onMessage(error ? errorText(error) : "交易檢舉已送出。");
  }

  async function provideLink(transactionId: unknown) {
    const link = window.prompt("請貼上完整的外部交易連結（必須含 https://）：");
    if (!link) return;
    const { error } = await supabase.rpc("set_transaction_link", {
      requested_transaction_id: transactionId,
      requested_link: link
    });
    if (error) onMessage(errorText(error));
    else {
      onMessage("交易連結已更新；舊連結與伺服器時間已保留供交易雙方查閱。");
      await load();
    }
  }

  async function requestSecondChance(transactionId: unknown) {
    const { error } = await supabase.rpc("request_second_chance_offer", {
      requested_transaction_id: transactionId
    });
    if (error) onMessage(errorText(error));
    else {
      onMessage("已向第二順位發出 48 小時承接邀請。");
      await load();
    }
  }

  async function respondOffer(offerId: unknown, accept: boolean) {
    if (
      accept &&
      !window.confirm("接受後將依顯示價格成立交易，不能自行取消。確定接受？")
    ) {
      return;
    }
    const { error } = await supabase.rpc("respond_second_chance_offer", {
      requested_offer_id: offerId,
      requested_accept: accept
    });
    if (error) onMessage(errorText(error));
    else {
      onMessage(accept ? "承接成立。" : "已婉拒承接，不會留下違約紀錄。");
      await load();
    }
  }

  if (!data) return <div className="page-loading">會員資料載入中…</div>;

  return (
    <section className="account-page">
      <div className="page-heading">
        <span className="eyebrow">MY NEXT ROUND</span>
        <h1>會員中心</h1>
        <p>{session.user.email}</p>
      </div>

      <div className="account-grid">
        <form className="profile-card" onSubmit={saveProfile}>
          <h2>公開名稱與成交聯絡方式</h2>
          <Field label="顯示名稱">
            <input
              required
              minLength={2}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
          <Field
            label="成交聯絡資訊"
            hint="例如 Email、LINE ID 或其他聯絡方式；僅成交雙方可見。"
          >
            <textarea
              required
              minLength={3}
              value={contactInfo}
              onChange={(event) => setContactInfo(event.target.value)}
            />
          </Field>
          <Field label="自我介紹（選填）">
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} />
          </Field>
          <button className="primary-button" type="submit" disabled={working}>
            儲存會員資料
          </button>
        </form>

        <div className="account-status-card">
          <h2>帳號狀態</h2>
          <p>
            第一件商品：
            <strong>
              {data.profile?.first_listing_approved_at
                ? "已通過審核，可自行刊登"
                : "尚未通過第一件商品審核"}
            </strong>
          </p>
          <p>
            帳號權限：
            <strong>{data.profile?.role === "admin" ? "管理員" : "一般會員"}</strong>
          </p>
          <p>平台不代收款、不驗貨，也不保證交易履約。</p>
        </div>
      </div>

      <section className="dashboard-section">
        <h2>我的刊登</h2>
        {data.listings.length === 0 ? (
          <div className="empty-state">尚未刊登商品。</div>
        ) : (
          <div className="dashboard-list">
            {data.listings.map((listing) => (
              <article key={String(listing.id)}>
                {listing.cover_image_path ? (
                  <img
                    src={publicPhoto(listing.cover_image_path)}
                    alt={String(listing.title)}
                  />
                ) : (
                  <div className="small-placeholder">無照片</div>
                )}
                <div>
                  <h3>{String(listing.title)}</h3>
                  <p>
                    {auctionLabels[listing.auction_type as AuctionType]} · {statusLabels[String(listing.status)] ?? String(listing.status)}
                  </p>
                  {Boolean(listing.removed_reason) && (
                    <p className="danger-text">原因：{String(listing.removed_reason)}</p>
                  )}
                </div>
                <div className="button-row listing-actions">
                  {listing.status === "active" && (
                    <button type="button" onClick={() => onOpen(String(listing.id))}>
                      查看
                    </button>
                  )}
                  <button type="button" onClick={() => setDescriptionListing(listing)}>
                    修正商品說明
                  </button>
                  {!['removed', 'rejected'].includes(String(listing.status)) && (
                    <button type="button" onClick={() => setPhotoListing(listing)}>
                      新增照片
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2>成交與聯絡資訊</h2>
        {data.transactions.length === 0 ? (
          <div className="empty-state">目前沒有成交紀錄。</div>
        ) : (
          <div className="transaction-list">
            {data.transactions.map((transaction) => {
              const counterpart =
                transaction.my_role === "seller"
                  ? transaction.buyer_contact_snapshot
                  : transaction.seller_contact_snapshot;
              const link =
                transaction.seller_provided_link ||
                transaction.external_transaction_link;
              return (
                <article key={String(transaction.id)}>
                  <div className="transaction-heading">
                    <div>
                      <span>
                        {transaction.my_role === "seller" ? "我是賣家" : "我是買家"}
                      </span>
                      <h3>{String(transaction.title)}</h3>
                    </div>
                    <strong>{money(transaction.amount)}</strong>
                  </div>
                  <p>成交時間：{dateTime(transaction.created_at)}</p>
                  <div className="contact-box">
                    <b>交易對方提供的聯絡方式</b>
                    <p className="preserve-lines">
                      {contactInfoText(counterpart) || "對方尚未填寫"}
                    </p>
                  </div>
                  {Boolean(link) && (
                    <a href={String(link)} target="_blank" rel="noreferrer">
                      開啟交易連結 ↗
                    </a>
                  )}
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => setActiveThread(transaction)}
                    >
                      交易訊息（保留紀錄）
                    </button>
                    {reviewedTransactions.has(String(transaction.id)) ? (
                      <span className="completed-label">已完成評價</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveReview(transaction)}
                      >
                        填寫成交評價
                      </button>
                    )}
                    {transaction.my_role === "seller" && (
                      <button
                        type="button"
                        onClick={() => provideLink(transaction.id)}
                      >
                        {link ? "更新交易連結（保留紀錄）" : "提供交易連結"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => transactionReport(transaction)}
                    >
                      檢舉交易問題
                    </button>
                    {transaction.my_role === "seller" &&
                      transaction.issue_status === "buyer_no_payment" && (
                        <button
                          type="button"
                          onClick={() => requestSecondChance(transaction.id)}
                        >
                          詢問第二順位承接
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2>第二順位承接邀請</h2>
        {data.second_chance_offers.length === 0 ? (
          <div className="empty-state">目前沒有承接邀請。</div>
        ) : (
          <div className="offer-list">
            {data.second_chance_offers.map((offer) => (
              <article key={String(offer.id)}>
                <div>
                  <h3>{String(offer.title)}</h3>
                  <p>
                    承接價格 {money(offer.offered_price)} · 到期 {dateTime(offer.expires_at)}
                  </p>
                </div>
                <span>{statusLabels[String(offer.status)] ?? String(offer.status)}</span>
                {offer.offered_to === session.user.id && offer.status === "pending" && (
                  <div className="button-row">
                    <button type="button" onClick={() => respondOffer(offer.id, true)}>
                      接受承接
                    </button>
                    <button type="button" onClick={() => respondOffer(offer.id, false)}>
                      婉拒
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {activeThread && (
        <TransactionChat
          transaction={activeThread}
          currentUserId={session.user.id}
          onClose={() => setActiveThread(null)}
          onMessage={onMessage}
        />
      )}

      {activeReview && (
        <ReviewForm
          transaction={activeReview}
          session={session}
          onClose={() => setActiveReview(null)}
          onSubmitted={async () => {
            setActiveReview(null);
            await load();
          }}
          onMessage={onMessage}
        />
      )}

      {photoListing && (
        <AdditionalPhotoForm
          listing={photoListing}
          session={session}
          onClose={() => setPhotoListing(null)}
          onFinished={() => {
            setPhotoListing(null);
            onMessage("照片已追加，新增時間已記錄；追加後不能修改或刪除。");
          }}
          onMessage={onMessage}
        />
      )}

      {descriptionListing && (
        <DescriptionEditForm
          listing={descriptionListing}
          onClose={() => setDescriptionListing(null)}
          onFinished={() => {
            setDescriptionListing(null);
            onMessage("商品說明已更新；所有版本與伺服器時間都已永久保留並公開。 ");
          }}
          onMessage={onMessage}
        />
      )}
    </section>
  );
}

function DescriptionEditForm({
  listing,
  onClose,
  onFinished,
  onMessage
}: {
  listing: Record<string, unknown>;
  onClose: () => void;
  onFinished: () => void;
  onMessage: (value: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase
      .rpc("get_my_listing_description", { requested_listing_id: listing.id })
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error) onMessage(errorText(error));
        else setDescription(String(data ?? ""));
      });
    return () => {
      active = false;
    };
  }, [listing.id, onMessage]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.rpc("update_market_listing_description", {
      requested_listing_id: listing.id,
      requested_description: description
    });
    setSubmitting(false);
    if (error) onMessage(errorText(error));
    else onFinished();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-label="修正商品說明"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">EDIT WITH HISTORY</span>
            <h2>修正「{String(listing.title)}」說明</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉">×</button>
        </div>
        <Notice tone="info">
          最新內容會成為商品目前說明；所有舊版本、修改者與伺服器時間仍會公開保留。
        </Notice>
        <Field label="完整商品說明" hint="至少 20 個字。請直接修正完整內容，不要只填補充片段。">
          <textarea
            required
            minLength={20}
            value={description}
            disabled={loading}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <button className="primary-button" type="submit" disabled={loading || submitting || description.trim().length < 20}>
          {loading ? "載入中…" : submitting ? "儲存中…" : "儲存新版本"}
        </button>
      </form>
    </div>
  );
}

function AdditionalPhotoForm({
  listing,
  session,
  onClose,
  onFinished,
  onMessage
}: {
  listing: Record<string, unknown>;
  session: Session;
  onClose: () => void;
  onFinished: () => void;
  onMessage: (value: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (files.length < 1 || files.length > 10) {
      onMessage("每次請選擇 1 至 10 張照片。");
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) {
      onMessage("只能上傳圖片，且單張不得超過 8 MB。");
      return;
    }

    setSubmitting(true);
    try {
      const paths: string[] = [];
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${session.user.id}/${listing.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage
          .from("listing-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        paths.push(path);
      }

      const { error } = await supabase.rpc("add_listing_photos", {
        requested_listing_id: listing.id,
        requested_photos: paths.map((storage_path) => ({ storage_path }))
      });
      if (error) throw error;
      onFinished();
    } catch (error) {
      onMessage(errorText(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-label="新增商品照片"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">ADD PHOTOS</span>
            <h2>新增「{String(listing.title)}」照片</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉">×</button>
        </div>
        <Notice tone="warning">
          只能追加本人實拍。照片送出後會押伺服器時間，不能修改或刪除。
        </Notice>
        <Field label="選擇照片" hint="每次 1 至 10 張、單張最多 8 MB；每件商品總計最多 30 張。">
          <input
            type="file"
            accept="image/*"
            multiple
            required
            onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 10))}
          />
        </Field>
        {files.length > 0 && <p className="selected-files">已選擇 {files.length} 張照片</p>}
        <button className="primary-button" type="submit" disabled={submitting || files.length === 0}>
          {submitting ? "上傳中…" : "確認追加照片"}
        </button>
      </form>
    </div>
  );
}

function TransactionChat({
  transaction,
  currentUserId,
  onClose,
  onMessage
}: {
  transaction: Record<string, unknown>;
  currentUserId: string;
  onClose: () => void;
  onMessage: (value: string) => void;
}) {
  const [messages, setMessages] = useState<TransactionMessage[]>([]);
  const [linkHistory, setLinkHistory] = useState<TransactionLinkHistory[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    const [messageResult, linkResult] = await Promise.all([
      supabase.rpc("get_transaction_messages", {
        requested_transaction_id: transaction.id
      }),
      supabase.rpc("get_transaction_link_history", {
        requested_transaction_id: transaction.id
      })
    ]);
    if (messageResult.error) onMessage(errorText(messageResult.error));
    else setMessages((messageResult.data ?? []) as TransactionMessage[]);
    if (linkResult.error) onMessage(errorText(linkResult.error));
    else setLinkHistory((linkResult.data ?? []) as TransactionLinkHistory[]);
  }, [onMessage, transaction.id]);

  useEffect(() => {
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 8000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!messageText.trim()) return;
    setSending(true);
    const { error } = await supabase.rpc("send_transaction_message", {
      requested_transaction_id: transaction.id,
      requested_message_text: messageText
    });
    setSending(false);
    if (error) onMessage(errorText(error));
    else {
      setMessageText("");
      await loadMessages();
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog-panel chat-panel"
        role="dialog"
        aria-modal="true"
        aria-label="交易訊息"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">TRANSACTION CHAT</span>
            <h2>{String(transaction.title)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉">×</button>
        </div>
        <Notice tone="info">
          此處只供本筆交易的買賣雙方溝通。所有訊息會保留發言者與時間，不能修改或刪除。
        </Notice>
        {linkHistory.length > 0 && (
          <details className="link-history">
            <summary>查看交易連結完整歷程（{linkHistory.length} 筆）</summary>
            <ol>
              {linkHistory.map((history) => (
                <li key={history.id}>
                  <div>
                    <strong>{history.changed_by_name}</strong>
                    <time>{dateTime(history.created_at)}</time>
                  </div>
                  {history.previous_link && (
                    <p>
                      舊連結：
                      <a href={history.previous_link} target="_blank" rel="noreferrer">
                        {history.previous_link}
                      </a>
                    </p>
                  )}
                  <p>
                    新連結：
                    <a href={history.new_link} target="_blank" rel="noreferrer">
                      {history.new_link}
                    </a>
                  </p>
                </li>
              ))}
            </ol>
          </details>
        )}
        <div className="chat-history" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">尚無訊息，請直接說明付款、交付或商品確認事項。</div>
          ) : (
            messages.map((message) => (
              <article
                className={`chat-message ${message.sender_id === currentUserId ? "own" : ""}`}
                key={message.id}
              >
                <div className="message-meta">
                  <strong>{message.sender_name}</strong>
                  <time>{dateTime(message.created_at)}</time>
                </div>
                <p className="preserve-lines">{message.message_text}</p>
              </article>
            ))
          )}
        </div>
        <form className="chat-compose" onSubmit={sendMessage}>
          <textarea
            required
            maxLength={2000}
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="輸入交易訊息（送出後不能修改或刪除）"
          />
          <button className="primary-button" type="submit" disabled={sending || !messageText.trim()}>
            {sending ? "傳送中…" : "送出訊息"}
          </button>
        </form>
      </section>
    </div>
  );
}

function StarRating({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="star-input">
      <span>{label}</span>
      <div role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === score}
            className={score <= value ? "active" : ""}
            onClick={() => onChange(score)}
            key={score}
            aria-label={`${score} 顆星`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewForm({
  transaction,
  session,
  onClose,
  onSubmitted,
  onMessage
}: {
  transaction: Record<string, unknown>;
  session: Session;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
  onMessage: (value: string) => void;
}) {
  const isBuyer = transaction.my_role === "buyer";
  const [overall, setOverall] = useState(5);
  const [description, setDescription] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (files.length > 5) {
      onMessage("評價最多可附 5 張照片。");
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) {
      onMessage("評價照片必須是圖片，且單張不得超過 8 MB。");
      return;
    }

    setSubmitting(true);
    const uploadedPaths: string[] = [];
    try {
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${session.user.id}/${transaction.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage
          .from("review-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
      }

      const { error } = await supabase.rpc("submit_transaction_review", {
        requested_transaction_id: transaction.id,
        requested_overall_rating: overall,
        requested_description_rating: isBuyer ? description : null,
        requested_communication_rating: communication,
        requested_review_text: reviewText,
        requested_photos: uploadedPaths.map((storage_path, sort_order) => ({
          storage_path,
          sort_order
        }))
      });
      if (error) throw error;
      onMessage("評價已送出並永久保留。感謝你留下真實交易經驗。");
      await onSubmitted();
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("review-photos").remove(uploadedPaths);
      }
      onMessage(errorText(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="dialog-panel review-form"
        role="dialog"
        aria-modal="true"
        aria-label="填寫成交評價"
        onSubmit={submitReview}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">PURCHASE REVIEW</span>
            <h2>評價「{String(transaction.title)}」</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉">×</button>
        </div>
        <p>{isBuyer ? "請評價商品描述與賣家溝通。" : "請評價買家的交易與溝通。"}</p>
        <div className="rating-grid">
          <StarRating label="整體評價" value={overall} onChange={setOverall} />
          {isBuyer && (
            <StarRating label="商品描述相符" value={description} onChange={setDescription} />
          )}
          <StarRating label="溝通體驗" value={communication} onChange={setCommunication} />
        </div>
        <Field label="評價內容" hint="10 至 2,000 個字；請陳述實際交易經驗。">
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
          />
        </Field>
        {isBuyer && (
          <Field label="評價照片（選填，最多 5 張）" hint="可上傳收到商品後的實拍；單張上限 8 MB。">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))}
            />
          </Field>
        )}
        {isBuyer && files.length > 0 && (
          <p className="selected-files">已選擇 {files.length} 張照片</p>
        )}
        <Notice tone="warning">
          評價送出後不能修改或刪除；買家評價會公開顯示在商品頁，賣家對買家的評價只計入會員交易評分。
        </Notice>
        <button className="primary-button" type="submit" disabled={submitting || reviewText.trim().length < 10}>
          {submitting ? "送出中…" : "確認送出永久評價"}
        </button>
      </form>
    </div>
  );
}

function AdminPage({ onMessage }: { onMessage: (value: string) => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [dashboardResult, memberResult] = await Promise.all([
      supabase.rpc("get_admin_market_dashboard"),
      supabase.rpc("get_admin_member_statuses")
    ]);
    if (dashboardResult.error) onMessage(errorText(dashboardResult.error));
    else setData(dashboardResult.data as AdminData);
    if (memberResult.error) onMessage(errorText(memberResult.error));
    else setMembers((memberResult.data ?? []) as MemberStatus[]);
  }, [onMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLocaleLowerCase("zh-TW");
    return members.filter((member) => {
      const matchesStatus =
        memberFilter === "all" ||
        member.account_status === memberFilter ||
        member.role === memberFilter;
      const matchesKeyword =
        !keyword ||
        (member.display_name ?? "").toLocaleLowerCase("zh-TW").includes(keyword) ||
        (member.email ?? "").toLocaleLowerCase("zh-TW").includes(keyword) ||
        member.id.toLocaleLowerCase().includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  }, [memberFilter, memberSearch, members]);

  async function review(id: unknown, approved: boolean) {
    const note = approved
      ? window.prompt("審核備註（可以留空）：") ?? ""
      : window.prompt("請輸入未通過原因：");
    if (!approved && !note) return;
    setWorking(true);
    const { error } = await supabase.rpc("admin_review_first_listing", {
      requested_listing_id: id,
      requested_approved: approved,
      requested_note: note
    });
    setWorking(false);
    if (error) onMessage(errorText(error));
    else {
      onMessage(approved ? "第一件商品已核准上架。" : "商品未通過審核。");
      await load();
    }
  }

  async function resolveReport(id: unknown, remove: boolean) {
    const resolution = window.prompt(
      remove ? "請輸入成立與處置原因：" : "請輸入不成立原因："
    );
    if (!resolution) return;
    setWorking(true);
    const { error } = await supabase.rpc("admin_resolve_market_report", {
      requested_report_id: id,
      requested_resolution: resolution,
      requested_remove_listing: remove
    });
    setWorking(false);
    if (error) onMessage(errorText(error));
    else {
      onMessage(remove ? "檢舉成立並完成處置。" : "檢舉已判定不成立。");
      await load();
    }
  }

  if (!data) return <div className="page-loading">管理資料載入中…</div>;

  return (
    <section className="admin-page">
      <div className="page-heading">
        <span className="eyebrow">ADMIN</span>
        <h1>管理後台</h1>
        <p>管理員可以審核第一件商品、處理檢舉與下架，但不能取消或改寫合法出價。</p>
      </div>

      <section className="dashboard-section member-status-section">
        <div className="section-heading compact-heading">
          <div>
            <span className="eyebrow">MEMBER STATUS</span>
            <h2>全部會員狀態（{members.length}）</h2>
          </div>
          <p>本區僅供確認會員狀態，不提供刪除會員或改寫交易紀錄。</p>
        </div>
        <div className="member-filters">
          <label>
            <span>搜尋會員</span>
            <input
              type="search"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="名稱、Email 或會員 ID"
            />
          </label>
          <label>
            <span>狀態篩選</span>
            <select
              value={memberFilter}
              onChange={(event) => setMemberFilter(event.target.value)}
            >
              <option value="all">全部狀態</option>
              <option value="active">啟用中</option>
              <option value="suspended">已停權</option>
              <option value="profile_pending">資料尚未建立</option>
              <option value="admin">管理員</option>
              <option value="member">一般會員</option>
            </select>
          </label>
        </div>
        {filteredMembers.length === 0 ? (
          <div className="empty-state">沒有符合條件的會員。</div>
        ) : (
          <div className="member-admin-grid">
            {filteredMembers.map((member) => (
              <article
                className={`member-status-card ${expandedMemberId === member.id ? "expanded" : ""}`}
                key={member.id}
              >
                <button
                  className="member-card-toggle"
                  type="button"
                  aria-expanded={expandedMemberId === member.id}
                  onClick={() =>
                    setExpandedMemberId((current) =>
                      current === member.id ? null : member.id
                    )
                  }
                >
                  <div>
                    <h3>{member.display_name || "尚未設定顯示名稱"}</h3>
                    <p>{member.email || "未提供 Email"}</p>
                  </div>
                  <div className="member-badges">
                    <span className={`member-status status-${member.account_status}`}>
                      {member.account_status === "active"
                        ? "啟用中"
                        : member.account_status === "suspended"
                          ? "已停權"
                          : "資料尚未建立"}
                    </span>
                    <span>{member.role === "admin" ? "管理員" : "一般會員"}</span>
                    <b className="expand-indicator">
                      {expandedMemberId === member.id ? "收合資料 ⌃" : "詳細資料 ⌄"}
                    </b>
                  </div>
                </button>
                {expandedMemberId === member.id && (
                  <div className="member-expanded-content">
                    <dl className="member-facts">
                      <div>
                        <dt>第一件商品</dt>
                        <dd>{member.first_listing_approved_at ? "已通過審核" : "尚未通過"}</dd>
                      </div>
                      <div>
                        <dt>刊登</dt>
                        <dd>{member.listing_count} 件（進行中 {member.active_listing_count}）</dd>
                      </div>
                      <div>
                        <dt>成交參與</dt>
                        <dd>{member.transaction_count} 筆</dd>
                      </div>
                      <div>
                        <dt>被檢舉</dt>
                        <dd>{member.report_count} 件（待處理 {member.open_report_count}）</dd>
                      </div>
                      <div>
                        <dt>交易評價</dt>
                        <dd>
                          {member.review_count > 0
                            ? `★ ${Number(member.average_rating).toFixed(1)}（${member.review_count} 則）`
                            : "尚無評價"}
                        </dd>
                      </div>
                      <div>
                        <dt>加入時間</dt>
                        <dd>{dateTime(member.created_at)}</dd>
                      </div>
                      <div>
                        <dt>最近登入</dt>
                        <dd>{dateTime(member.last_sign_in_at)}</dd>
                      </div>
                      {member.suspended_at && (
                        <div>
                          <dt>停權時間</dt>
                          <dd>{dateTime(member.suspended_at)}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="member-id">
                      <b>會員 ID</b>
                      <code>{member.id}</code>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2>第一件商品待審核（{data.pending_listings.length}）</h2>
        {data.pending_listings.length === 0 ? (
          <div className="empty-state">目前沒有待審商品。</div>
        ) : (
          <div className="admin-list">
            {data.pending_listings.map((listing) => (
              <article key={String(listing.id)}>
                <div>
                  <span>賣家：{String(listing.seller_name)}</span>
                  <h3>{String(listing.title)}</h3>
                  <p className="preserve-lines">{String(listing.description)}</p>
                  <p>
                    發霉：{String(listing.mold_level)} · 缺件說明：
                    {String(listing.missing_parts_notes || "無")}
                  </p>
                </div>
                <div className="admin-photo-grid">
                  {Array.isArray(listing.photos) &&
                    listing.photos.map((photo, index) => {
                      const row = photo as Record<string, unknown>;
                      return (
                        <figure key={String(row.storage_path)}>
                          <img
                            src={publicPhoto(row.storage_path)}
                            alt={`審核照片 ${index + 1}`}
                          />
                          <figcaption>
                            {row.is_verification_photo ? "手寫驗證照" : "商品實拍"}
                          </figcaption>
                        </figure>
                      );
                    })}
                </div>
                <div className="button-row">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={working}
                    onClick={() => review(listing.id, true)}
                  >
                    核准上架
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={working}
                    onClick={() => review(listing.id, false)}
                  >
                    不通過
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2>待處理檢舉（{data.reports.length}）</h2>
        {data.reports.length === 0 ? (
          <div className="empty-state">目前沒有待處理檢舉。</div>
        ) : (
          <div className="admin-list reports-list">
            {data.reports.map((report) => (
              <article key={String(report.id)}>
                <div>
                  <span>
                    {String(report.category)} · {dateTime(report.created_at)}
                  </span>
                  <h3>{String(report.listing_title || "交易檢舉")}</h3>
                  <p className="preserve-lines">{String(report.description)}</p>
                  <small>檢舉人：{String(report.reporter_name || report.reporter_id)}</small>
                </div>
                <div className="button-row">
                  <button
                    className="danger-button"
                    type="button"
                    disabled={working}
                    onClick={() => resolveReport(report.id, true)}
                  >
                    檢舉成立並處置
                  </button>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => resolveReport(report.id, false)}
                  >
                    判定不成立
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function GuidePage() {
  return (
    <section className="guide-page">
      <div className="page-heading">
        <span className="eyebrow">HOW IT WORKS</span>
        <h1>網站使用說明與完整規則</h1>
        <p>刊登、出價或購買前，請先讀完這一頁。</p>
      </div>

      <div className="guide-flow" aria-label="從登入到交易的流程圖">
        <GuideVisual icon="G" title="Google 登入" caption="建立會員資料" />
        <span className="flow-arrow">→</span>
        <GuideVisual icon="📷" title="實拍與揭露" caption="依統一標準填寫" />
        <span className="flow-arrow">→</span>
        <GuideVisual icon="⚖" title="競標或直購" caption="操作保留紀錄" />
        <span className="flow-arrow">→</span>
        <GuideVisual icon="🤝" title="自行完成交易" caption="平台不經手款項" />
      </div>

      <div className="guide-grid">
        <GuideCard number="01" title="登入與聯絡資料">
          使用 Google 登入後，先到會員中心設定顯示名稱與成交聯絡方式。聯絡資訊不會公開在商品頁，只會在成交後提供給該筆交易雙方。
        </GuideCard>
        <GuideCard number="02" title="第一件商品人工審核">
          每個帳號的第一件商品都必須經管理員審核。第一張照片要同時拍到商品與手寫紙條，紙條包含網站名稱、顯示名稱及拍攝日期。通過後，該帳號往後可以自行刊登。
        </GuideCard>
        <GuideCard number="03" title="照片規則：只准本人實拍">
          每件商品至少一張照片。不得使用官方圖、網路商店圖、搜尋結果、他人照片或 AI 生成的商品替代圖。發霉、破損與缺件處必須提供清楚近照。
        </GuideCard>
        <GuideCard number="04" title="新舊程度由站方統一定義">
          「全新未拆」只限原廠封膜或封條完整；已重新包膜必須標為重新封裝。「近新」、「良好」、「明顯使用」及「補件用」都依刊登表單顯示的固定定義選擇。
        </GuideCard>
        <GuideCard number="05" title="發霉商品可以刊登，但不得隱瞞">
          依無霉、僅霉味、輕微、中度、重度五級揭露。有霉味或霉斑就必須填補充說明與照片；刻意隱瞞屬零容忍違規。
        </GuideCard>
        <GuideCard number="06" title="定時競標與自動出價">
          買家設定可接受的最高上限，系統依賣家設定的每標金額逐步出價。上限不公開；修改會保留軌跡，也不會讓目前公開出價倒退。出價不能取消。
        </GuideCard>
        <GuideCard number="07" title="自動延長與直購">
          賣家可在刊登時啟用自動延長，規則會在出價前公開。直購價為選用；有人直購時會直接跳過剩餘拍賣並成立交易。
        </GuideCard>
        <GuideCard number="08" title="荷蘭式競標">
          賣家設定起始價、最低價、每次降價金額及間隔。價格由系統依時間下降，第一位接受當下價格者得標；買家也可以先設定可接受價格。
        </GuideCard>
        <GuideCard number="09" title="不取消與第二順位承接">
          使用者和管理員都不能任意取消合法出價或成交。若買家未付款，須先檢舉並由管理員確認；只有刊登時已同意承接制的商品，才可邀請第二順位在 48 小時內依其最後公開有效價格承接。拒絕或不回覆不算違約。
        </GuideCard>
        <GuideCard number="10" title="成交、檢舉與平台界線">
          成交後雙方取得聯絡資訊，自行安排面交、寄送或外部交易連結。可檢舉不付款、不出貨、描述不符及未提供交易方式。平台只保存紀錄與進行管理，不驗貨、不代收款，也不保證履約。
        </GuideCard>
      </div>

      <Notice tone="danger">
        零容忍項目：盜用或使用網路商品圖、刻意隱瞞發霉或缺件、虛假描述、惡意棄標、得標後不付款、成交後不出貨。管理員可依紀錄下架商品、處理檢舉或停權，但不會竄改合法出價。
      </Notice>
    </section>
  );
}

function GuideVisual({
  icon,
  title,
  caption
}: {
  icon: string;
  title: string;
  caption: string;
}) {
  return (
    <div className="guide-visual">
      <span>{icon}</span>
      <strong>{title}</strong>
      <small>{caption}</small>
    </div>
  );
}

function GuideCard({
  number,
  title,
  children
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="guide-card">
      <span>{number}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </article>
  );
}
