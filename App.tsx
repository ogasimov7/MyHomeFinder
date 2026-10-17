/* ============================================================
   HomeFinder — a search on bina.az or kub.az, read and ranked.

   Nothing leaves the phone: the searches already run and the last
   ranking live in AsyncStorage, and the only network traffic is the
   site loading inside the WebView the user opened themselves.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SearchModal } from "./src/components/SearchModal";
import { BrowserModal, type BrowserTarget } from "./src/components/BrowserModal";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { FRESH_DAYS, scanCards, type RawCard } from "./src/lib/cards";
import { siteFor, typeOfUrl } from "./src/lib/sites";
import { siteName } from "./src/lib/format";
import { rank, type RankingResult } from "./src/lib/ranking";
import {
  loadHistory,
  loadResults,
  remember,
  saveHistory,
  saveResults,
  type SearchEntry,
} from "./src/lib/storage";
import { colors } from "./src/ui/theme";

type Stage = "loading" | "app";

/** Long enough for one sheet to leave before the next one arrives. */
const SHEET_SWAP_MS = 280;

export default function App() {
  return (
    /* gesture-handler wants the root of the tree; the sheets carry their own
       root inside their modals, which is where Android needs it. */
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const [stage, setStage] = useState<Stage>("loading");
  const [history, setHistory] = useState<SearchEntry[]>([]);
  const [results, setResults] = useState<RankingResult | null>(null);

  const [target, setTarget] = useState<BrowserTarget | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedHistory, storedResults] = await Promise.all([loadHistory(), loadResults()]);
      setHistory(storedHistory);
      setResults(storedResults);
      setStage("app");
    })();
  }, []);

  /* The reader walks the pages and hands over every card it read; the
     parsing, the geography and the ranking all happen here, in one place. */
  const handleCards = useCallback(
    (cards: RawCard[], url: string) => {
      const scan = scanCards(cards, {
        freshDays: FRESH_DAYS,
        site: siteFor(url) ?? undefined,
        // The link decides what was searched for, not the profile: a saved
        // house search stays a house search.
        type: typeOfUrl(url),
      });
      if (scan.listings.length === 0) {
        setTarget(null);
        Alert.alert(
          "Sıralanacaq elan tapılmadı",
          scan.skips.stale > 0
            ? `Tapılan elanların hamısı ${FRESH_DAYS} gündən köhnədir.`
            : "Axtarış boş qayıtdı. Filtrləri yoxlayıb yenidən cəhd edin.",
        );
        return;
      }
      const ranking = rank(scan, url);
      setResults(ranking);
      void saveResults(ranking);
      setTarget(null);
    },
    [],
  );

  /* A search is remembered by the link it ran on, then opened.

     The site waits for the search sheet to finish closing: iOS shows one
     modal at a time, and a second one raised over the first never appears. */
  const runSearch = useCallback(
    (url: string) => {
      setHistory((current) => {
        const next = remember(current, url);
        void saveHistory(next);
        return next;
      });
      setSearching(false);
      setTimeout(() => setTarget({ url, mode: "scan", title: siteName(url) }), SHEET_SWAP_MS);
    },
    [],
  );

  const forgetSearch = useCallback((id: string) => {
    setHistory((current) => {
      const next = current.filter((entry) => entry.id !== id);
      void saveHistory(next);
      return next;
    });
  }, []);

  if (stage === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <ResultsScreen
        result={results}
        onSearch={() => setSearching(true)}
        onOpenListing={(row) =>
          setTarget({ url: row.listing.url, mode: "view", title: `${row.listing.rooms} otaq · ${row.listing.areaName}` })
        }
      />

      {/* The one action the app has, centred where a thumb reaches it. */}
      <View style={styles.searchWrap} pointerEvents="box-none">
        <Pressable style={styles.search} onPress={() => setSearching(true)}>
          <Text style={styles.searchText}>Elan axtar</Text>
          <Ionicons name="search" size={17} color={colors.ink} />
        </Pressable>
      </View>

      <SearchModal
        visible={searching}
        history={history}
        onCancel={() => setSearching(false)}
        onSearch={runSearch}
        onForget={forgetSearch}
      />
      <BrowserModal target={target} onClose={() => setTarget(null)} onCards={handleCards} />
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { position: "absolute", left: 0, right: 0, bottom: 26, alignItems: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchText: { fontSize: 15, fontWeight: "600", color: colors.ink, letterSpacing: -0.2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
