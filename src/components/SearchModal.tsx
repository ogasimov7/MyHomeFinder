/* The search sheet: a link to open, and the searches already run.

   The address is the whole form — a search names itself from where it points
   — and the history is there so the same search is one tap the second time. */

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { FRESH_DAYS } from "../lib/cards";
import { siteName, sitePath } from "../lib/format";
import { useSheet } from "../lib/sheet";
import { SITES, siteFor } from "../lib/sites";
import type { SearchEntry } from "../lib/storage";
import { colors, radius, space } from "../ui/theme";

interface Props {
  visible: boolean;
  history: SearchEntry[];
  onCancel: () => void;
  onSearch: (url: string) => void;
  onForget: (id: string) => void;
}

const SITE_NAMES = SITES.map((site) => site.name).join(" və ya ");

/** Links arrive from every direction; this is the shape they share. */
function normalise(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return siteFor(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function SearchModal({ visible, history, onCancel, onSearch, onForget }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mounted, translateY, backdropOpacity, handleGesture } = useSheet(visible, onCancel);

  /* KeyboardAvoidingView is unreliable inside a Modal — on Android it does
     not see the modal's window at all — so the sheet is lifted by the
     keyboard's own height, animated over the keyboard's own duration so the
     two move together instead of one jumping after the other. */
  const inputRef = useRef<TextInput>(null);
  const keyboard = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rise = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const fall = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const lift = (height: number, duration?: number) =>
      Animated.timing(keyboard, {
        toValue: height,
        duration: duration || 180,
        useNativeDriver: false, // padding is layout, not a transform
      }).start();
    const show = Keyboard.addListener(rise, (event) =>
      lift(event.endCoordinates.height, event.duration),
    );
    const hide = Keyboard.addListener(fall, (event) => lift(0, event.duration));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboard]);

  /* The keyboard waits for the sheet: raising both at once makes the entry
     animation stutter on the first frame. */
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setUrl("");
      setError(null);
    }
  }, [visible]);

  const submit = () => {
    const normalised = normalise(url);
    if (!normalised) {
      setError(`${SITE_NAMES} saytından bir axtarış linki yazın.`);
      return;
    }
    onSearch(normalised);
  };

  return (
    <Modal visible={mounted} animationType="none" transparent statusBarTranslucent onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </Animated.View>
        {/* The sheet's colour continues behind the keyboard, so the keyboard's
            own rounded corners do not cut dark notches out of the sheet. */}
        <Animated.View style={[styles.keyboardFill, { height: keyboard }]} pointerEvents="none" />
        <Animated.View style={[styles.wrap, { paddingBottom: keyboard }]}>
          <GestureDetector gesture={handleGesture}>
            <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
              <View style={styles.grabber} />
              <View style={styles.titleRow}>
                <Text style={styles.title}>Elan axtar</Text>
                <Pressable onPress={onCancel} hitSlop={12} style={styles.close}>
                  <Ionicons name="close" size={20} color={colors.ink} />
                </Pressable>
              </View>
              <Text style={styles.hint}>
                Linki yapışdırın, səhifədə gəzin — elanlar toplandıqca “Nəticələri analiz et”
                düyməsi son {FRESH_DAYS} günü sıralayır.
              </Text>

              <View style={[styles.field, error ? styles.fieldBad : null]}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={url}
                  onChangeText={(value) => {
                    setUrl(value);
                    setError(null);
                  }}
                  placeholder="Axtarış linkini yapışdırın"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={submit}
                />
                <Pressable style={styles.go} onPress={submit} hitSlop={8}>
                  <Ionicons name="search" size={18} color="#fff" />
                </Pressable>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {history.length > 0 ? (
                <>
                  <View style={styles.sectionRow}>
                    <Text style={styles.section}>Son axtarışlar</Text>
                    <Text style={styles.sectionCount}>{history.length}</Text>
                  </View>
                  <ScrollView style={styles.history} keyboardShouldPersistTaps="handled">
                    {history.map((entry) => (
                      <Pressable
                        key={entry.id}
                        style={styles.entry}
                        onPress={() => onSearch(entry.url)}
                      >
                        <View style={styles.entryIcon}>
                          <Ionicons name="time-outline" size={15} color={colors.muted} />
                        </View>
                        <View style={styles.entryText}>
                          <Text style={styles.entryHost} numberOfLines={1}>
                            {siteName(entry.url)}
                          </Text>
                          <Text style={styles.entryPath} numberOfLines={1}>
                            {sitePath(entry.url) || "/"}
                          </Text>
                        </View>
                        <Pressable
                          hitSlop={12}
                          style={styles.forget}
                          onPress={() => onForget(entry.id)}
                        >
                          <Ionicons name="close" size={14} color={colors.faint} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,18,22,.35)" },
  wrap: { flex: 1, justifyContent: "flex-end" },
  keyboardFill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.card },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: space.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  hint: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: space.xs, marginBottom: space.lg },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingLeft: space.md,
    paddingRight: space.xs,
    paddingVertical: space.xs,
    backgroundColor: colors.card,
  },
  fieldBad: { borderColor: colors.bad },
  input: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: space.sm + 2 },
  go: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 12.5, color: colors.bad, marginTop: space.sm },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
    marginBottom: space.xs,
  },
  section: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.faint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCount: { fontSize: 11, fontWeight: "700", color: colors.faint },
  history: { maxHeight: 220 },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  entryIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  entryText: { flex: 1 },
  entryHost: { fontSize: 14, fontWeight: "600", color: colors.ink, letterSpacing: -0.2 },
  entryPath: { fontSize: 12, color: colors.faint, marginTop: 1 },
  forget: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
