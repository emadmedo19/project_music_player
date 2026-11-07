import { useEffect, useRef, useState } from "react";
import {
  FiSearch,
  FiPlay,
  FiPause,
  FiSkipBack,
  FiSkipForward,
  FiHeart,
  FiMusic,
  FiArrowRight,
  FiExternalLink,
  FiRefreshCw,
  FiX,
  FiHeadphones,
} from "react-icons/fi";
import {
  artwork,
  asText,
  COLLECTION,
  searchAlbums,
  loadAlbum,
} from "./lib/catalog";

const time = (seconds) =>
  Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
    : "0:00";
function readFavorites() {
  try {
    const data = JSON.parse(localStorage.getItem("naghma.favorites") || "[]");
    return Array.isArray(data)
      ? data.filter(
          (t) => t?.id && t?.url?.startsWith("https://archive.org/download/"),
        )
      : [];
  } catch {
    return [];
  }
}
function Cover({ id, title, ...props }) {
  return (
    <img
      src={artwork(id)}
      alt={title || ""}
      loading="lazy"
      {...props}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}
export default function App() {
  const [view, setView] = useState("discover");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [albums, setAlbums] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [album, setAlbum] = useState(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState("");
  const [favorites, setFavorites] = useState(readFavorites);
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerError, setPlayerError] = useState("");
  const audio = useRef(null);
  const albumRequest = useRef(null);
  const favoriteIds = new Set(favorites.map((t) => t.id));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    searchAlbums(query, page, controller.signal)
      .then((data) => {
        setAlbums((prev) =>
          page === 1 ? data.albums : [...prev, ...data.albums],
        );
        setTotal(data.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, page, retry]);
  useEffect(() => {
    try {
      localStorage.setItem("naghma.favorites", JSON.stringify(favorites));
    } catch {
      /* Playback still works without storage. */
    }
  }, [favorites]);
  useEffect(() => () => albumRequest.current?.abort(), []);
  useEffect(() => {
    if (!active || !audio.current) return;
    const el = audio.current;
    setElapsed(0);
    setDuration(0);
    setPlayerError("");
    setBuffering(true);
    el.load();
    el.play().catch((e) => {
      if (e.name !== "AbortError") {
        setBuffering(false);
        setPlayerError(
          "اضغط تشغيل للمحاولة مرة أخرى، وتأكد من اتصال الإنترنت.",
        );
      }
    });
    if ("mediaSession" in navigator && "MediaMetadata" in window)
      navigator.mediaSession.metadata = new MediaMetadata({
        title: active.title,
        artist: active.artist,
        album: active.album,
        artwork: [{ src: active.cover }],
      });
  }, [active]);
  function toggleFavorite(track) {
    setFavorites((prev) =>
      prev.some((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : [...prev, track],
    );
  }
  function start(track, tracks) {
    setQueue(tracks);
    if (active?.id === track.id) {
      audio.current
        ?.play()
        .catch(() => setPlayerError("تعذّر التشغيل. حاول مرة أخرى."));
    } else setActive(track);
  }
  function skip(delta) {
    const i = queue.findIndex((t) => t.id === active?.id);
    const next = queue[i + delta];
    if (next) setActive(next);
  }
  function togglePlay() {
    const el = audio.current;
    if (!el || !active) return;
    if (!el.paused) el.pause();
    else {
      setPlayerError("");
      if (el.error) el.load();
      el.play().catch(() =>
        setPlayerError("تعذّر التشغيل. تأكد من اتصال الإنترنت وحاول مرة أخرى."),
      );
    }
  }
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const actions = {
      play: () => audio.current?.play().catch(() => {}),
      pause: () => audio.current?.pause(),
      previoustrack: () => skip(-1),
      nexttrack: () => skip(1),
    };
    for (const [name, action] of Object.entries(actions)) {
      try {
        navigator.mediaSession.setActionHandler(name, action);
      } catch {
        /* Platform does not support this action. */
      }
    }
    return () => {
      for (const name of Object.keys(actions)) {
        try {
          navigator.mediaSession.setActionHandler(name, null);
        } catch {
          /* Unsupported action. */
        }
      }
    };
  }, [queue, active]);
  async function openAlbum(item) {
    albumRequest.current?.abort();
    const controller = new AbortController();
    albumRequest.current = controller;
    setAlbum(null);
    setAlbumLoading(true);
    setAlbumError("");
    setView("album");
    try {
      const data = await loadAlbum(item.identifier, controller.signal);
      if (!controller.signal.aborted) setAlbum(data);
    } catch (e) {
      if (e.name !== "AbortError") setAlbumError(e.message);
    } finally {
      if (!controller.signal.aborted) setAlbumLoading(false);
    }
  }
  function discover() {
    albumRequest.current?.abort();
    setView("discover");
  }
  function search(e) {
    e.preventDefault();
    albumRequest.current?.abort();
    setPage(1);
    setQuery(input.trim());
    setView("discover");
    setRetry((n) => n + 1);
  }
  function tracksList(tracks) {
    return (
      <div className="tracks">
        {tracks.map((track, i) => (
          <div
            className={`track ${active?.id === track.id ? "active" : ""}`}
            key={track.id}
          >
            <button
              className="track-main"
              onClick={() => start(track, tracks)}
              aria-label={`تشغيل ${track.title}`}
            >
              <span className="track-number">
                {active?.id === track.id && playing ? (
                  <span className="equalizer">▂▆▃</span>
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span className="track-copy">
                <strong dir="auto">{track.title}</strong>
                <small dir="auto">{track.artist}</small>
              </span>
              <span className="track-duration" dir="ltr">
                {track.duration || "MP3"}
              </span>
              <FiPlay />
            </button>
            <button
              className={`icon favorite ${favoriteIds.has(track.id) ? "selected" : ""}`}
              onClick={() => toggleFavorite(track)}
              aria-label={
                favoriteIds.has(track.id)
                  ? `إزالة ${track.title} من المفضلة`
                  : `إضافة ${track.title} للمفضلة`
              }
              aria-pressed={favoriteIds.has(track.id)}
            >
              <FiHeart />
            </button>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`app ${active ? "with-player" : ""}`}>
      <header className="header">
        <button
          className="brand"
          onClick={discover}
          aria-label="نغمة — الرئيسية"
        >
          <span className="brand-icon">
            <FiHeadphones />
          </span>
          <span>
            نغمة<small>NAGHMA</small>
          </span>
        </button>
        <div className="header-note">
          <span className="live-dot" />
          موسيقى مستقلة، كاملة
        </div>
      </header>
      <nav className="navigation" aria-label="القائمة الرئيسية">
        <button
          className={view !== "favorites" ? "current" : ""}
          onClick={discover}
        >
          <FiMusic />
          اكتشف
        </button>
        <button
          className={view === "favorites" ? "current" : ""}
          onClick={() => {
            albumRequest.current?.abort();
            setView("favorites");
          }}
        >
          <FiHeart />
          المفضلة<span className="count">{favorites.length}</span>
        </button>
      </nav>
      <main>
        {view === "discover" && (
          <>
            <section className="hero">
              <div className="eyebrow">بعيدًا عن المعتاد</div>
              <h1>
                مزاج جديد.
                <br />
                <span>موسيقى تستاهل تتسمع.</span>
              </h1>
              <p>
                اكتشف فنانين مستقلين من كتالوج blocSonic.
                <br />
                مقاطع كاملة أونلاين، بدون حساب أو اشتراك.
              </p>
              <span className="hero-art" aria-hidden="true">
                <span className="record">
                  <span>
                    <FiMusic />
                  </span>
                </span>
                <span className="sound s1" />
                <span className="sound s2" />
                <span className="sound s3" />
              </span>
            </section>
            <form className="search" onSubmit={search}>
              <FiSearch />
              <input
                aria-label="ابحث عن ألبوم أو فنان"
                placeholder="ابحث عن ألبوم أو فنان…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={150}
              />
              <button type="submit">ابحث</button>
            </form>
            <section className="catalog">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">شغّل حاجة مختلفة</span>
                  <h2>
                    {query ? `نتائج البحث: ${query}` : "اختيارات تستكشفها"}
                  </h2>
                </div>
                {!loading && (
                  <span className="muted">
                    {total.toLocaleString("ar")} إصدار
                  </span>
                )}
              </div>
              <p className="catalog-note">
                البحث داخل كتالوج الموسيقى المستقلة فقط. جرّب أسماء الفنانين أو
                الألبومات بالإنجليزية.
              </p>
              {error && (
                <div className="message error" role="alert">
                  <p>{error}</p>
                  <button
                    className="button"
                    onClick={() => setRetry((n) => n + 1)}
                  >
                    <FiRefreshCw />
                    إعادة المحاولة
                  </button>
                </div>
              )}
              {loading && page === 1 ? (
                <div className="album-grid" aria-label="جارٍ تحميل الألبومات">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div className="skeleton" key={i} />
                  ))}
                </div>
              ) : (
                <div className="album-grid">
                  {albums.map((item) => (
                    <button
                      className="album-card"
                      key={item.identifier}
                      onClick={() => openAlbum(item)}
                    >
                      <div className="cover">
                        <FiMusic className="fallback" />
                        <Cover
                          id={item.identifier}
                          title={asText(item.title)}
                        />
                        <span className="cover-play">
                          <FiPlay />
                        </span>
                      </div>
                      <h3 dir="auto">{asText(item.title)}</h3>
                      <p dir="auto">{asText(item.creator) || "blocSonic"}</p>
                      <span className="album-tag">
                        ألبوم كامل <span>↗</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {!loading && !error && !albums.length && (
                <div className="message">
                  <FiSearch />
                  <h3>مفيش نتائج بالاسم ده</h3>
                  <p>جرّب اسم فنان أو ألبوم مختلف داخل الكتالوج.</p>
                </div>
              )}
              {albums.length < total && !error && (
                <button
                  className="button more"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                >
                  {loading ? "جارٍ التحميل…" : "اكتشف المزيد"}
                </button>
              )}
            </section>
          </>
        )}
        {view === "album" && (
          <section className="album-detail">
            <button className="back" onClick={discover}>
              <FiArrowRight />
              رجوع للاكتشاف
            </button>
            {albumLoading && (
              <div className="message" role="status">
                <span className="spinner" />
                <p>بنحمّل مقاطع الألبوم…</p>
              </div>
            )}
            {albumError && (
              <div className="message error" role="alert">
                {albumError}
                <button className="button" onClick={discover}>
                  رجوع للكتالوج
                </button>
              </div>
            )}
            {album && (
              <>
                <div className="album-intro">
                  <div className="detail-cover">
                    <Cover id={album.id} title={album.title} />
                  </div>
                  <div>
                    <span className="eyebrow">اسمع الألبوم كامل</span>
                    <h1 dir="auto">{album.title}</h1>
                    <p dir="auto">{album.artist}</p>
                    <span className="muted">
                      {album.tracks.length} مقطع · موسيقى مستقلة
                    </span>
                    <button
                      className="button primary"
                      onClick={() => start(album.tracks[0], album.tracks)}
                    >
                      <FiPlay />
                      تشغيل الألبوم
                    </button>
                  </div>
                </div>
                {tracksList(album.tracks)}
                <div className="attribution">
                  <span>المصدر: blocSonic / Internet Archive</span>
                  <a
                    href={`https://archive.org/details/${encodeURIComponent(album.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    صفحة الإصدار <FiExternalLink />
                  </a>
                  <a href={album.license} target="_blank" rel="noreferrer">
                    ترخيص الاستخدام <FiExternalLink />
                  </a>
                </div>
              </>
            )}
          </section>
        )}
        {view === "favorites" && (
          <section className="favorites-page">
            <span className="eyebrow">على ذوقك</span>
            <h1>
              مكتبتك الصغيرة <FiHeart />
            </h1>
            <p className="muted">
              مقاطعك المفضلة محفوظة على الجهاز. التشغيل يحتاج إنترنت.
            </p>
            {favorites.length ? (
              tracksList(favorites)
            ) : (
              <div className="message">
                <FiHeart />
                <h3>لسه أول نغمة مستنياك</h3>
                <p>اضغط على القلب جنب أي مقطع عشان تلاقيه هنا.</p>
                <button className="button primary" onClick={discover}>
                  اكتشف الموسيقى
                </button>
              </div>
            )}
          </section>
        )}
        <footer>
          <span className="footer-brand">
            نغمة <FiHeadphones />
          </span>
          <p>
            موسيقى من{" "}
            <a href={COLLECTION} target="_blank" rel="noreferrer">
              blocSonic على Internet Archive
            </a>
            ، وفق ترخيص كل إصدار.
            <br />
            التطبيق مستقل وغير تابع لـSpotify. الاستخدام الشخصي غير التجاري؛
            راجع ترخيص المقطع.
          </p>
        </footer>
      </main>
      <audio
        ref={audio}
        src={active?.url}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          setPlayerError("");
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setPlaying(false);
          skip(1);
        }}
        onError={() => {
          if (active) {
            setBuffering(false);
            setPlaying(false);
            setPlayerError(
              "تعذّر تحميل الصوت. تأكد من الإنترنت أو جرّب مقطعًا آخر.",
            );
          }
        }}
      />
      {active && (
        <section className="player" aria-label="مشغل الموسيقى">
          <div className="player-inner">
            <div className="now-playing">
              <Cover id={active.albumId} />
              <div>
                <strong dir="auto">{active.title}</strong>
                <small dir="auto">{active.artist}</small>
              </div>
              <button
                className={`icon favorite ${favoriteIds.has(active.id) ? "selected" : ""}`}
                onClick={() => toggleFavorite(active)}
                aria-label="تبديل المفضلة"
                aria-pressed={favoriteIds.has(active.id)}
              >
                <FiHeart />
              </button>
            </div>
            <div className="play-controls" dir="ltr">
              <button
                className="icon"
                onClick={() => skip(-1)}
                disabled={queue.findIndex((t) => t.id === active.id) <= 0}
                aria-label="المقطع السابق"
              >
                <FiSkipBack />
              </button>
              <button
                className="play-button"
                onClick={togglePlay}
                aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
              >
                {buffering && !playerError ? (
                  <span className="spinner" />
                ) : playing ? (
                  <FiPause />
                ) : (
                  <FiPlay />
                )}
              </button>
              <button
                className="icon"
                onClick={() => skip(1)}
                disabled={
                  queue.findIndex((t) => t.id === active.id) >= queue.length - 1
                }
                aria-label="المقطع التالي"
              >
                <FiSkipForward />
              </button>
            </div>
            <div className="seek" dir="ltr">
              <span>{time(elapsed)}</span>
              <input
                type="range"
                min="0"
                max={Number.isFinite(duration) && duration > 0 ? duration : 0}
                step="0.1"
                value={elapsed}
                onChange={(e) => {
                  if (Number.isFinite(duration) && duration > 0) {
                    audio.current.currentTime = Number(e.target.value);
                    setElapsed(Number(e.target.value));
                  }
                }}
                aria-label="موضع التشغيل"
                disabled={!Number.isFinite(duration) || duration <= 0}
              />
              <span>{time(duration)}</span>
            </div>
            <a
              className="source-link"
              href={active.source}
              target="_blank"
              rel="noreferrer"
              aria-label="مصدر المقطع وترخيصه"
            >
              <FiExternalLink />
            </a>
          </div>
          {playerError && (
            <div className="player-error" role="alert">
              {playerError}
              <button
                onClick={() => setPlayerError("")}
                aria-label="إغلاق الرسالة"
              >
                <FiX />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
