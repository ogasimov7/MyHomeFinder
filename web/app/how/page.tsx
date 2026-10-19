import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Necə işləyir" };

const STEPS = [
  {
    n: "01",
    title: "Axtarış oxunur",
    body: "Filtrlərinizə uyğun ən son ~300 elan bina.az və ya kub.az-dan oxunur. Rayon seçəndə onun metro, qəsəbə və mikrorayonları açılır; bina.az elanları birbaşa seçdiyiniz yerlərdən verir. Nəticə 10 dəqiqəlik keşdə qalır, ona görə saytlara hər ziyarətçi üçün yeni sorğu getmir.",
  },
  {
    n: "02",
    title: "Hər elan öz məhəlləsi ilə müqayisə olunur",
    body: "Etalon rayon deyil, elanın öz yeridir: metro stansiyası, qəsəbə və ya mikrorayon — saytın özünün göstərdiyi kimi. bina.az-da medianı bu axtarışdakı elanlar və həmin yerin ən son 25 elanı birlikdə verir, büdcə filtrindən asılı olmadan. Yerdə müqayisə üçün azı 2 elan yoxdursa rayon götürülür; o da yoxdursa “Ərazidə tək elan” yazılır.",
  },
  {
    n: "03",
    title: "Hər yerin ən sərfəlisi nişan alır",
    body: "Eyni yerdəki elanların orta m² qiyməti tapılır. m²-i ən ucuz olan “Ən sərfəli” nişanı alır və siyahıda yuxarı çıxır; ortadan ucuz olanlar “Sərfəli təklif”, ortadan baha olanlar isə ortadan neçə faiz baha olduğunu göstərir. Xəritədə qrup seçdiyiniz dairənin bütün elanlarıdır; panel onların orta m² qiymətini də göstərir. Yerdə tək elan varsa nişan qoyulmur — müqayisə edəcək bir şey yoxdur.",
  },
];

const RULES = [
  ["Ünvan tanınmırsa", "elan sıralanmır və əhatə sətrində “ünvan tanınmadı” kimi sayılır."],
  ["Sumqayıt və Abşeron", "elanları öz səhifəsi ilə müqayisə olunur və kartda “Bakıdan kənar” etiketi ilə göstərilir."],
  ["Dollarla verilən qiymətlər", "1.70 məzənnəsi ilə manata çevrilir və kartda “USD → AZN” qeydi olur."],
  ["Torpaq, qaraj, ofis", "kartları mənzil sayılmır. Mənzil və həyət evi bir-biri ilə müqayisə olunmur."],
  ["5 gündən köhnə elanlar", "sıralamaya düşmür, çünki bir aylıq qiymət bugünkü bazar haqqında az şey deyir."],
];

export default function HowPage() {
  return (
    <>
      <header className="page-head">
        <h1>Necə işləyir</h1>
      </header>
      <div className="how">
        <ol className="how-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span>{s.n}</span>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>

        <section className="how-rules">
          <h2>Nə uydurulmur</h2>
          <dl>
            {RULES.map(([term, desc]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="how-note">
          <h2>Mənbələr</h2>
          <p>
            HomeFinder elanların sahibi deyil. Hər kart orijinal elana aparır; şəkillər və qiymətlər saytların özündən
            gəlir. Mobil tətbiq və bu sayt eyni parser, coğrafiya və sıralama kodunu işlədir, ona görə eyni elan hər
            ikisində eyni faizi alır.
          </p>
          <Link href="/search" className="btn-solid">
            Axtarışa keç
          </Link>
        </section>
      </div>
    </>
  );
}
