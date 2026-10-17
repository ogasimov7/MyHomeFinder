/* The ranking, and what it does not cover.

   Each row carries only figures that can be traced: the asking price
   from the card and its distance from the median of the same area on
   the same search. The rank itself is the loudest thing on the row,
   because the order is the answer. */

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { money, moneyShort, perSqm, signedPct } from "../lib/format";
import { coverageParts, type RankedListing, type RankingResult } from "../lib/ranking";
import { USD_AZN } from "../lib/cards";
import { colors, radius, space } from "../ui/theme";

interface Props {
  result: RankingResult | null;
  /** opens the search sheet; this screen has nothing to show without it */
  onSearch: () => void;
  onOpenListing: (row: RankedListing) => void;
}

export function ResultsScreen({ result, onSearch, onOpenListing }: Props) {
  if (!result) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <Ionicons name="list-outline" size={26} color={colors.faint} />
        </View>
        <Text style={styles.emptyTitle}>Hələ nəticə yoxdur</Text>
        <Text style={styles.emptyText}>
          Bir axtarış linki ilə başlayın: saytda süzgəclərinizi qurun, səhifəni sürüşdürün, sonra
          “Nəticələri analiz et” düyməsinə basın.
        </Text>
        <Pressable style={styles.emptyButton} onPress={onSearch}>
          <Text style={styles.emptyButtonText}>Elan axtar</Text>
          <Ionicons name="search" size={16} color={colors.ink} />
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Son axtarış nəticələri</Text>
      <View style={styles.headerMeta}>
        <Text style={styles.source} numberOfLines={1}>
          {result.sourceUrl.replace(/^https?:\/\//, "")}
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{result.rows.length} elan</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <Ionicons name="information-circle-outline" size={15} color={colors.faint} />
        <Text style={styles.count}>{coverageParts(result).join(" · ")}</Text>
      </View>

      {result.rows.length === 0 ? (
        <Text style={styles.none}>Bu axtarışda sıralanacaq elan tapılmadı.</Text>
      ) : (
        result.rows.map((row, index) => (
          <Row key={row.listing.id} row={row} index={index} onPress={() => onOpenListing(row)} />
        ))
      )}

      <Text style={styles.footnote}>
        Faiz elanın kvadratmetr qiymətinin eyni səhifədəki qonşuları ilə fərqini göstərir — ümumi
        bazar deyil, sizin gördüyünüz elanlar. Kartlarda təmir və sənəd məlumatı olmadığı üçün
        rəqəmlər kobuddur.
      </Text>
    </ScrollView>
  );
}

function Row({ row, index, onPress }: { row: RankedListing; index: number; onPress: () => void }) {
  const { listing, deviationPct, reference } = row;
  const cheaper = (deviationPct ?? 0) <= 0;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rankWrap}>
        <Text style={styles.rank}>{index + 1}</Text>
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={styles.price}>{money(listing.price)}</Text>
          <Text style={styles.ppsm}>{perSqm(listing.pricePerSqm)}</Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {listing.rooms} otaq · {listing.area} m²
          {listing.floor && listing.totalFloors ? ` · ${listing.floor}/${listing.totalFloors}` : ""} ·{" "}
          {listing.areaName}
        </Text>
        <View style={styles.tags}>
          {deviationPct === null ? (
            <Tag text={`${reference.name}: tək elan`} />
          ) : (
            <Tag
              text={`${signedPct(deviationPct, 0)} · ${reference.name} ${moneyShort(reference.median)}/m²`}
              tone={cheaper ? "good" : "bad"}
            />
          )}
          {listing.priceConverted ? <Tag text={`USD → AZN · ${USD_AZN}`} /> : null}
          {!listing.marketKnown ? <Tag text="bazar məlumatı yoxdur" /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </Pressable>
  );
}

function Tag({ text, tone }: { text: string; tone?: "good" | "bad" }) {
  return (
    <View
      style={[
        styles.tag,
        tone === "good" && { backgroundColor: colors.goodBg },
        tone === "bad" && { backgroundColor: colors.badBg },
      ]}
    >
      <Text
        style={[
          styles.tagText,
          tone === "good" && { color: colors.good },
          tone === "bad" && { color: colors.bad },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // Room for the search button that floats over the end of the list.
  content: { padding: space.lg, paddingBottom: space.xl * 4 },

  title: { fontSize: 23, fontWeight: "700", color: colors.ink, letterSpacing: -0.6 },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.sm,
  },
  pill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  source: { flex: 1, fontSize: 12.5, color: colors.faint },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
    marginBottom: space.md,
  },
  count: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  none: { fontSize: 14, color: colors.muted, paddingVertical: space.xl, textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    marginBottom: space.sm,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  rankWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  rank: { fontSize: 12, fontWeight: "700", color: colors.muted },
  rowMain: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  price: { fontSize: 17, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  ppsm: { fontSize: 12.5, fontWeight: "600", color: colors.muted },
  sub: { fontSize: 12.5, color: colors.muted },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
  tag: {
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  footnote: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.faint,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },

  emptyWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: space.md, letterSpacing: -0.3 },
  emptyText: { fontSize: 13.5, lineHeight: 20, color: colors.muted, textAlign: "center" },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: space.lg + 2,
    paddingVertical: space.md + 1,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  emptyButtonText: { color: colors.ink, fontSize: 14.5, fontWeight: "600" },
});
