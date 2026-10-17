import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <h2>Bu səhifə tapılmadı</h2>
      <p>Elan satılmış, silinmiş və ya link səhv ola bilər.</p>
      <Link href="/search" className="btn-solid">
        Axtarışa qayıt
      </Link>
    </div>
  );
}
