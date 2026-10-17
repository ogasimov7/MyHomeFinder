export function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy>
      <div className="results-head">
        <div>
          <p className="sk sk-line" style={{ width: 220 }} />
          <p className="sk sk-line" style={{ width: 320, marginTop: 8 }} />
        </div>
      </div>
      <div className="grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card is-skeleton">
            <div className="card-media sk" />
            <div className="card-body">
              <p className="sk sk-line" style={{ width: "60%" }} />
              <p className="sk sk-line" style={{ width: "45%", marginTop: 10 }} />
              <p className="sk sk-line" style={{ width: "80%", marginTop: 10 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <aside className="filters is-skeleton" aria-hidden>
      <header className="filters-head">
        <h2>Filtrlər</h2>
      </header>
      <div className="filters-scroll">
        {[90, 140, 120, 80].map((h, i) => (
          <div key={i} className="fgroup sk" style={{ height: h }} />
        ))}
      </div>
    </aside>
  );
}

export function DetailSkeleton() {
  return (
    <div className="detail" aria-busy>
      <div className="detail-top">
        <span className="round-btn sk" />
      </div>
      <div className="detail-head">
        <div>
          <p className="sk sk-line" style={{ width: 320, height: 26 }} />
          <p className="sk sk-line" style={{ width: 200, marginTop: 12 }} />
        </div>
      </div>
      <div className="pgrid pgrid-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="pgrid-tile sk" style={{ borderRadius: 0 }} />
        ))}
      </div>
      <div className="detail-cols">
        <div className="detail-main">
          <div className="specs sk" style={{ height: 76 }} />
          <div className="box sk" style={{ height: 220 }} />
        </div>
        <aside className="detail-side">
          <div className="box sk" style={{ height: 200 }} />
          <div className="box sk" style={{ height: 240 }} />
        </aside>
      </div>
    </div>
  );
}
