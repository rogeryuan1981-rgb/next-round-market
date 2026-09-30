import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabase
} from "./lib/supabase";

type Listing = {
  id: string;
  title: string;
  auction_type: "timed" | "dutch" | "fixed";
  current_price: number;
  buy_now_price: number | null;
  ends_at: string | null;
  condition_label: string;
  mold_level: string;
  cover_image_path: string | null;
};

const auctionLabels: Record<Listing["auction_type"], string> = {
  timed: "定時競標",
  dutch: "荷蘭式競標",
  fixed: "直接購買"
};

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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [auctionType, setAuctionType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [, refreshClock] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setMessage("網站資料庫尚未完成設定。");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });

    const loadListings = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("listings_public")
        .select(
          "id,title,auction_type,current_price,buy_now_price,ends_at,condition_label,mold_level,cover_image_path"
        )
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) {
        setMessage("目前無法載入商品，請稍後再試。");
      } else {
        setListings((data ?? []) as Listing[]);
        setMessage("");
      }

      setLoading(false);
    };

    void loadListings();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshClock((value) => value + 1);
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredListings = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-TW");

    return listings.filter((listing) => {
      const matchesSearch =
        !keyword ||
        listing.title.toLocaleLowerCase("zh-TW").includes(keyword);

      const matchesType =
        auctionType === "all" ||
        listing.auction_type === auctionType;

      return matchesSearch && matchesType;
    });
  }, [auctionType, listings, search]);

  async function signIn() {
    const redirectTo =
      window.location.origin + window.location.pathname;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error) setMessage("Google 登入目前無法使用。");
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Next Round Market 首頁">
          <span className="brand-mark" aria-hidden="true">↻</span>

          <span>
            <strong>Next Round Market</strong>
            <small>讓每一盒桌遊，都有下一局。</small>
          </span>
        </a>

        <nav aria-label="主要選單">
          <a href="#market">瀏覽商品</a>
          <a href="#rules">拍賣規則</a>

          {session ? (
            <>
              <button className="text-button" type="button">
                刊登商品
              </button>

              <button
                className="account-button"
                type="button"
                onClick={signOut}
              >
                登出
              </button>
            </>
          ) : (
            <button
              className="account-button"
              type="button"
              onClick={signIn}
              disabled={!isSupabaseConfigured}
            >
              使用 Google 登入
            </button>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">二手桌遊拍賣市集</span>
            <h1>把收藏交給下一位玩家，展開新的回合。</h1>

            <p>
              支援定時競標、荷蘭式競標與直購。
              商品狀況、缺件及發霉程度均須依平台標準揭露。
            </p>

            <a className="primary-button" href="#market">
              查看進行中的拍賣
            </a>
          </div>

          <div className="hero-art" aria-hidden="true">
            <span className="piece piece-one">●</span>
            <span className="piece piece-two">◆</span>
            <span className="piece piece-three">▲</span>
            <strong>NEXT<br />ROUND</strong>
          </div>
        </section>

        <section className="market-section" id="market">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MARKETPLACE</span>
              <h2>進行中的拍賣</h2>
            </div>

            <div className="filters">
              <label>
                <span>搜尋商品</span>
                <input
                  type="search"
                  value={search}
                  placeholder="輸入桌遊名稱"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <label>
                <span>拍賣方式</span>
                <select
                  value={auctionType}
                  onChange={(event) =>
                    setAuctionType(event.target.value)
                  }
                >
                  <option value="all">全部方式</option>
                  <option value="timed">定時競標</option>
                  <option value="dutch">荷蘭式競標</option>
                  <option value="fixed">直接購買</option>
                </select>
              </label>
            </div>
          </div>

          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}

          {loading ? (
            <div className="empty-state">商品載入中…</div>
          ) : filteredListings.length === 0 ? (
            <div className="empty-state">
              目前沒有符合條件的公開商品。
            </div>
          ) : (
            <div className="listing-grid">
              {filteredListings.map((listing) => (
                <article className="listing-card" key={listing.id}>
                  <div className="listing-image">
                    {listing.cover_image_path ? (
                      <img
                        src={
                              supabase.storage
                                .from("listing-photos")
                                .getPublicUrl(listing.cover_image_path).data.publicUrl
                            }
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
                        <span className="warning-badge">
                          發霉狀況已揭露
                        </span>
                      )}
                    </div>

                    <h3>{listing.title}</h3>

                    <div className="price-row">
                      <span>
                        {listing.auction_type === "fixed"
                          ? "售價"
                          : "目前價格"}
                      </span>

                      <strong>
                        NT$ {listing.current_price.toLocaleString()}
                      </strong>
                    </div>

                    {listing.buy_now_price !== null && (
                      <p className="buy-now">
                        直購價 NT${" "}
                        {listing.buy_now_price.toLocaleString()}
                      </p>
                    )}

                    <div className="card-footer">
                      <span>{remainingTime(listing.ends_at)}</span>
                      <button type="button">查看商品</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rules-section" id="rules">
          <span className="eyebrow">CLEAR RULES</span>
          <h2>出價以前，先把規則說清楚。</h2>

          <div className="rule-grid">
            <article>
              <strong>實物照片</strong>
              <p>
                所有商品必須使用賣家實際拍攝的照片，
                不得使用官方或網路商品圖。
              </p>
            </article>

            <article>
              <strong>完整揭露</strong>
              <p>
                新舊程度、缺件、霉味及可見發霉程度，
                均依平台統一定義填寫。
              </p>
            </article>

            <article>
              <strong>出價不可撤回</strong>
              <p>
                出價及直購成立後不能取消。
                所有修改與操作均保留紀錄。
              </p>
            </article>
          </div>

          <div className="disclaimer">
            本網站僅提供二手桌遊資訊刊登、競價及聯絡媒合服務，
            不經手款項，亦不驗證商品真偽、品質、付款或交付情形。
            交易雙方應自行確認商品與交易條件，並自行承擔交易風險。
          </div>
        </section>
      </main>

      <footer>
        <strong>Next Round Market</strong>
        <span>讓每一盒桌遊，都有下一局。</span>
      </footer>
    </div>
  );
}
