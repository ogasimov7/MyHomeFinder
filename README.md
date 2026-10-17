# HomeFinder — mobil

bina.az elanlarını **sizin ipoteka şərtlərinizlə** oxuyan tətbiq. Səhifəni siz açırsınız,
tətbiq yalnız ekranda olanı oxuyur; heç bir məlumat serverə getmir, baza yoxdur.

## İşə salmaq (Expo Go)

```bash
cd HomeFinderMobile
npm install       # ilk dəfə
npx expo start
```

Terminalda çıxan QR kodu **Expo Go** ilə oxudun (iOS-da Kamera, Android-də Expo Go içindən).
Telefon və kompüter eyni Wi-Fi şəbəkəsində olmalıdır; olmasa `npx expo start --tunnel`.

Digər əmrlər:

```bash
npm run typecheck   # TypeScript
npm run verify      # məntiq yoxlamaları (kart oxunuşu, coğrafiya, ipoteka, sıralama)
```

## İstifadəçi yolu

1. **Giriş** — “Google ilə davam et”. *Hələlik şərtidir:* real OAuth qoşulmayıb, test
   istifadəçisi ilə davam edilir və ekranda bu açıq yazılır.
2. **İpoteka şərtləri** — faiz, müddət, kredit tavanı, minimum ilkin ödəniş, aylıq ödəniş
   tavanı, əlinizdəki nağd. Üç hazır preset var; hamısı redaktə oluna bilir.
3. **Əsas** — bina.az axtarışlarınızı əlfəcin kimi saxlayırsınız (`+` düyməsi).
4. Əlfəcinə toxunanda **sayt aşağıdan açılan modalda** yüklənir. Sürüşdürdükcə səhifənin
   altındakı düymə neçə elan görüldüyünü sayır: **“Nəticələri analiz et (N elan)”**.
5. Düyməyə basanda modal bağlanır, **Nəticələr** səhifəsi sıralamanı göstərir.
6. Sıradakı elana toxunanda həmin elanın səhifəsi yenə modalda açılır.

## Sıralama nəyə görədir

Hər elan **eyni səhifədəki qonşuları** ilə müqayisə olunur — ümumi bazarla yox:

- əvvəlcə elanın öz ərazisinin medianı (ən azı 2 elan),
- orada yoxdursa rayonun medianı,
- o da yoxdursa “tək elan” yazılır — uydurma 0% göstərilmir.

Yəni filtrinizi dəyişsəniz, etalon da dəyişir. Bu qəsdəndir: müqayisə sizin gördüyünüz
elanlara söykənir.

İpoteka rəqəmləri (aylıq ödəniş, ilkin ödəniş, büdcəyə uyğunluq) bazardan asılı deyil,
yalnız qiymətdən və sizin şərtlərinizdən çıxır — ona görə hər elan üçün göstərilir.

## Nə uydurulmur

- **Ərazi tanınmırsa** elan sıralanmır və sayğacda “ünvan tanınmadı” kimi sayılır.
- **Sumqayıt / Abşeron** elanları oxunur və öz səhifəsi ilə müqayisə olunur, amma
  “bazar məlumatı yoxdur” etiketi ilə — bu bölgələr üçün heç bir median saxlanmır.
- **USD elanları** 1.7 məzənnəsi ilə çevrilir və sətirdə `USD → AZN` yazılır.
- **Torpaq, qaraj, ofis** kartları “mənzil deyil” kimi sayılır; **həyət evləri** sıralamadan
  kənarda qalır, çünki onların qiyməti torpaqdan asılıdır.

## Quruluş

```
App.tsx                  ekranlar arası keçid, WebView-dan gələn kartların emalı
src/lib/reader.ts        bina.az səhifəsinə injektə olunan skript (kartları oxuyur)
src/lib/cards.ts         kart mətni → elan (qiymət, sahə, otaq, ünvan)
src/lib/geo.ts           ünvan mətni → rayon/ərazi
src/lib/geography.ts     Bakı bölgələri (yalnız adlar, median yoxdur)
src/lib/mortgage.ts      annuitet, ilkin ödəniş, büdcə tavanı
src/lib/ranking.ts       səhifə medianı, faiz fərqi, sıralama
src/lib/storage.ts       AsyncStorage: profil, əlfəcinlər, son nəticə
src/screens, src/components
scripts/verify.ts        məntiq yoxlamaları
```

Skript yalnız **oxuyur**: səhifə DOM-undan qiymət/sahə/otaq mətnini götürüb tətbiqə ötürür.
Parsinq, coğrafiya və sıralama native tərəfdə gedir — bir parser var, iki yox.

## Veb sayt

`web/` qovluğunda Next.js saytı var: eyni `src/lib` kodu ilə bina.az və kub.az axtarışlarını serverdə
oxuyur, sıralayır və premium kart qriddində göstərir. Ətraflı: [`web/README.md`](web/README.md).

## Hələ edilməyənlər

- **Real Google girişi** — `SignInScreen` içində `onSignIn` çağırışı `expo-auth-session` ilə
  əvəz olunmalı, `app.json`-a client id-lər yazılmalıdır.
- **ru.bina.az və tap.az** — hazırda yalnız `bina.az` ünvanları qəbul olunur.
- **Qiymət tarixçəsi** — brauzer əlavəsində var, burada hələ yoxdur.
