# HomeFinder — veb

bina.az və kub.az elanlarını oxuyub hər birini öz ərazisinin m² medianı ilə müqayisə edən sayt.
Mobil tətbiqlə **eyni** parser, coğrafiya və sıralamanı işlədir: `../src/lib` birbaşa import olunur.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build
```

## Səhifələr

| Yol        | Nə var |
| ---------- | ------ |
| `/`        | Hero, günün rəqəmləri, “Bu gün bazardan ucuz” (10 dəq. keş) |
| `/search`  | Filtrlər + kart qriddi. Bütün filtrlər URL-dədir, link paylaşmaq olur |
| `/listing/[bina\|kub]/[id]` | Elan səhifəsi: qalereya, təsvir, xüsusiyyətlər, xəritə, qiymətləndirmə, ipoteka hesabı, oxşar elanlar |
| `/map`     | Xəritə: istifadəçinin yerinə maksimum zoom-la açılır, ətrafdakı elanlar qiymət nişanları və bina klasterləri ilə |
| `/saved`   | Seçilmişlər, yalnız brauzerin localStorage-ında |
| `/how`     | Metodologiya |

## Məlumat necə gəlir

- **bina.az**: saytın öz axtarış səhifəsinin işlətdiyi GraphQL sorğusu (`/graphql`, `SearchItems`).
  Filtrlər (kateqoriya, rayon və onun alt əraziləri, otaq, büdcə, sahə, kupça, təmir, ipoteka) sorğuya gedir;
  12 × 25 = 300 elan oxunur. **Rayon** seçiləndə altında onun metro stansiyaları, qəsəbələri və mikrorayonları
  açılır (`lib/places.ts`: bina.az-ın yer kataloqu, gündə bir dəfə; qəsəbənin rayonunu bina.az özü verir, metronun
  rayonu isə bina.az elanlarının üst-üstə düşməsindən hesablanıb cədvəldə saxlanır — sərhəddəki stansiya hər iki
  rayonda görünür). Alt ərazi seçilməyən rayon bütöv, seçilən rayon həmin yerlərlə `locationIds` kimi soruşulur
  (`?district=nasimi&place=8,38`). bina.az bir elanı bir neçə yerə bağlayır, kartda isə əsas yeri görünür.
- **kub.az**: axtarış səhifəsinin HTML-i (15 səhifə, 5-5 paralel, ~300 elan). kub.az URL filtrlərini qəbul etmir, ona görə
  otaq, büdcə və sahə filtrləri sıralamadan **sonra** tətbiq olunur.
- **Müqayisə vahidi rayon deyil, elanın öz yeridir**: metro stansiyası, qəsəbə, mikrorayon (“28 May m.”,
  “7-ci mikrorayon q.”) — bina.az-da elanın `location` sahəsi, kub.az-da elan ünvanındakı (URL) yer.
  bina.az-da hər yerin **son 25 elanı** ayrıca çəkilib medianın nümunəsinə qoşulur (`placeSample`, 6 saatlıq
  keş, yer başına bir sorğu, eyni anda 4-dən çox deyil). Nümunə büdcə/sahə/sənəd filtrlərindən asılı deyil,
  yalnız əmlak növünə uyğundur — ucuz mənzil axtarışı ucuz mənzillərlə ölçülmür. kub.az yerə görə sorğu
  qəbul etmədiyi üçün orada median yalnız axtarışdakı elanlardandır.
- Hər iki mənbə `scanCards` → `rank(scan, url, { pool })` yolundan keçir (`lib/market.ts`). Nəticə `"use cache"` ilə
  10 dəqiqəlik keşə yazılır (`next.config.ts` → `cacheLife.market`).

Elan səhifəsi (`lib/detail.ts`) bina.az-da elanın tam məlumatını (`item` sorğusu: bütün şəkillər, təsvir,
koordinat, satıcı) oxuyur; kub.az-da isə elan səhifəsinin özündən yalnız başlıq, ünvan, təsvir və orijinal
mənbə linki gəlir. Kartdan açılan link axtarış parametrlərini daşıyır, ona görə elan **həmin axtarışla**
müqayisə olunur və faiz kartdakı ilə eyni çıxır. Elan o axtarışda yoxdursa, öz rayonunun elanları ilə
sıralanır.

**Satıcı ilə əlaqə**: elan səhifəsində “Zəng et” və “WhatsApp”. bina.az nömrəni yalnız soruşulanda verir
(`/items/{id}/phones` — öz “nömrəni göstər” düyməsinin sorğusu); `/api/phone/[id]` onu yalnız düyməyə basılanda,
həmin bir elan üçün soruşur, keşləmir və saxlamır. kub.az elanları üçün elanın öz səhifəsinə keçid qalır.

**Ana səhifə**: son elanların “Ən sərfəli”ləri rayonlar üzrə sıra-sıra (hər rayonda 4-ə qədər; çox elanlı yerin
ən ucuzu öndə); “Hamısı” həmin rayonun öz axtarışını açır.

**İlkin ödəniş qiymət yerinə** (`lib/instalment.ts`): bəzi satıcılar qiymət xanasına ilkin və ya aylıq
ödənişi yazır və elan öz yerinin “Ən sərfəli”si kimi görünür. m² qiyməti öz yerinin medianının 60%-indən aşağı olan
elan şübhəlidir; onun bina.az açıqlaması oxunur (yalnız şübhəlilər üçün, keşlə) və orada “ilkin ödəniş”, “aylıq
ödəniş”, “hissə-hissə”, “daxili kredit”, “kreditlə”, “первоначальный взнос” və s. yazılıbsa (“daxili kredit yoxdur”
kimi inkar sayılmır), elan nişanlardan əvvəl çıxarılır. 200 m²-ə qədər mənzil medianın 35%-indən də ucuzdursa,
açıqlamasız çıxarılır; böyük penthouse və dubleksə bu tətbiq olunmur — onların m² qiyməti həqiqətən aşağı olur.
Axtarışda, xəritə dairəsində və ana səhifədə belədir; elanın öz səhifəsində “Qiymət ilkin ödəniş ola bilər”
xəbərdarlığı çıxır və müqayisə edilmir.

**Nişanlar** (`lib/value.ts`): eyni yerdəki elanların orta m² qiyməti tapılır. m²-i ən ucuz olan
“Ən sərfəli”, ortadan ucuz olanlar “Sərfəli təklif” (faizsiz — satıcıya qaldırmaq üçün rəqəm verilmir), ortadan
baha olanlar “X% baha” (ortaya nisbətən; 1%-dən az fərq “Orta qiymətdə”) alır; tək elana nişan qoyulmur. Kartlarda qrup — axtarışdakı eyni yerin
elanları, xəritədə — kliklənən dairənin **bütün** elanları. bina.az dairəni 25-25 və yalnız verilən sərhəd daxilində
verir, kursoru isə sadəcə zaman nöqtəsidir: dairə öz plitəsinin sərhədləri ilə soruşulur (ekranın kənarında
kəsilməsin deyə) və zaman aralıqlarına bölünüb paralel oxunur (eyni anda ən çox 12 sorğu; 1 500 elan ≈ 1,5 s,
8 000 ≈ 4 s). 10 000-dən böyük dairə zaman üzrə bərabər seçmə ilə oxunur və panel bunu yazır. Panel dairənin m²-i
ən sərfəli 100 elanını göstərir; orta m² qiyməti isə bütün oxunan elanlar üzrədir. Axtarışda orta m² qiyməti
ekranda görünən nəticələr üzrədir. Mediana görə “bazardan X% ucuz” göstərilmir: rəqəm satıcıya qiymət
qaldırmaq üçün hazır arqument olurdu. Mediana görə sıralama (`rank`) arxa planda qalır.

Rayon, mətn axtarışı, “yalnız ən sərfəlilər” və sıralama yalnız göstərilən elanları daraldır və yenidən düzür,
etalonu dəyişmir (`lib/view.ts`).

## Diqqət

bina.az GraphQL-i açıq API deyil: saytın daxili sorğusudur və xəbərdarlıqsız dəyişə bilər.
Dəyişsə, `/search` “sayt cavab vermir” göstərəcək. Düzəliş `lib/market.ts` → `BINA_QUERY`-dədir.
Bu saytları bu yolla oxumağın onların istifadə şərtlərinə uyğunluğunu ictimai yayımdan əvvəl yoxlayın.

## Xəritə

- Yer brauzerin `navigator.geolocation`-ı ilə alınır və brauzerdə qalır; serverə yalnız xəritənin görünən
  kənarları (~100 m-ə yuvarlaqlaşdırılmış) gedir. İcazə soruşularkən vaxt limiti işləmir.
- Nişanlar bina.az-ın xəritə sorğusundandır (`lib/map.ts`: `mapMarkers`, `mapItems`, `item`), 1 dəqiqəlik keşlə.
  bina.az zoom 18-dən dərində elanları ayırmır; orada klaster bir binadır və klikləyəndə binanın elanları açılır.
- Plitələr OpenStreetMap-in öz serverindəndir (açarsız). Onların istifadə qaydası yalnız mülayim trafikə icazə
  verir — sayt böyüyəndə açarlı provayderə (MapTiler, Stadia, CARTO) keçmək lazımdır: `components/MapView.tsx`.
