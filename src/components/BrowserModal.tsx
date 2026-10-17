/* ============================================================
   The site itself, in a sheet that slides up from the bottom.

   The sheet is drawn rather than handed to a native pageSheet, so the drag
   that closes it behaves the same on both platforms — Android ignores
   presentationStyle, and would otherwise have no way to swipe it away.

   Two jobs behind one component:
   - "scan": a search, with the reader injected. The user scrolls and
     turns the site's pages; each page is merged here, so the count is
     everything seen since the search opened, not just this page.
   - "view": a single listing, plain browsing, nothing injected.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { readerJs, type ReaderMessage } from "../lib/reader";
import { siteFor } from "../lib/sites";
import { useSheet } from "../lib/sheet";
import type { RawCard } from "../lib/cards";
import { colors, radius, space } from "../ui/theme";

export interface BrowserTarget {
  url: string;
  mode: "scan" | "view";
  title?: string;
}

interface Props {
  target: BrowserTarget | null;
  onClose: () => void;
  onCards: (cards: RawCard[], url: string) => void;
}

/** The reader for whichever site the search belongs to. */
function readerFor(url: string): string | null {
  const site = siteFor(url);
  return site ? readerJs(site) : null;
}

export function BrowserModal({ target, onClose, onCards }: Props) {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<string | null>(null);
  const webRef = useRef<WebView>(null);
  /* Everything read since this search opened, keyed by listing id: the site's
     next page is a new document, and its script starts from nothing. */
  const collected = useRef(new Map<string, RawCard>());
  const insets = useSafeAreaInsets();
  const sheetTop = insets.top + space.sm;

  /* The page keeps its own scrolling: the header always drags the sheet, the
     page area only once it has scrolled back to the top. */
  const [atTop, setAtTop] = useState(true);
  const { mounted, translateY, backdropOpacity, handleGesture, bodyGesture } = useSheet(
    target !== null,
    onClose,
    atTop,
  );

  /* The target is dropped the moment closing starts, so the sheet holds on to
     the last one and slides out showing the page instead of a blank card. */
  const [shown, setShown] = useState<BrowserTarget | null>(target);
  useEffect(() => {
    if (target) {
      setShown(target);
      setAtTop(true);
      collected.current = new Map();
    }
  }, [target]);

  const handleMessage = (event: WebViewMessageEvent) => {
    let message: ReaderMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as ReaderMessage;
    } catch {
      return; // The page can post anything it likes; only our own shape is read.
    }
    if (message.type !== "cards" && message.type !== "analyze") return;

    for (const card of message.cards ?? []) {
      if (!collected.current.has(card.id)) collected.current.set(card.id, card);
    }

    if (message.type === "analyze") {
      onCards([...collected.current.values()], shown?.url ?? message.url);
      return;
    }
    // The page counts itself; the button has to show the whole search.
    webRef.current?.injectJavaScript(
      `window.__hfReader && window.__hfReader.setTotal(${collected.current.size}); true;`,
    );
  };

  const host = (() => {
    const raw = current ?? shown?.url ?? "";
    return raw.replace(/^https?:\/\//, "").split("/")[0];
  })();

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
        <Animated.View
          style={[
            styles.sheet,
            { marginTop: sheetTop, paddingBottom: insets.bottom, transform: [{ translateY }] },
          ]}
        >
          <GestureDetector gesture={handleGesture}>
            <View>
              <View style={styles.header}>
                <View style={styles.grabber} />
              </View>
              <View style={styles.bar}>
                <View style={styles.barText}>
                  <Text style={styles.title} numberOfLines={1}>
                    {shown?.title ?? host}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {shown?.mode === "scan"
                      ? "Sürüşdürün, sonra aşağıdakı düyməyə basın"
                      : host}
                  </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
                  <Ionicons name="close" size={20} color={colors.ink} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <GestureDetector gesture={bodyGesture}>
            <View style={styles.web}>
              {shown ? (
                <WebView
                  ref={webRef}
                  source={{ uri: shown.url }}
                  style={styles.web}
                  onMessage={handleMessage}
                  injectedJavaScript={
                    shown.mode === "scan" ? (readerFor(shown.url) ?? undefined) : undefined
                  }
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onNavigationStateChange={(state) => setCurrent(state.url)}
                  onScroll={(event) => {
                    const top = event.nativeEvent.contentOffset.y <= 4;
                    setAtTop((was) => (was === top ? was : top));
                  }}
                  allowsBackForwardNavigationGestures
                  setSupportMultipleWindows={false}
                />
              ) : null}
            </View>
          </GestureDetector>

          {loading ? (
            <View style={styles.loading} pointerEvents="none">
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,18,22,.35)" },
  sheet: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
  },
  header: { alignItems: "center", paddingTop: space.sm },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  barText: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  web: { flex: 1 },
  loading: { position: "absolute", top: 90, left: 0, right: 0, alignItems: "center" },
});
