/* The bottom sheets: how they arrive, how they leave, and the drag that
   dismisses them.

   Modal's own "slide" animation moves everything inside it, backdrop
   included, so the dim layer would rise up the screen as a dark rectangle.
   The sheet is therefore animated here — Modal itself does nothing — and the
   backdrop only fades, its opacity read from how far down the sheet sits.

   The drag is a gesture-handler pan rather than a PanResponder. RN's own
   responder system never saw most of these touches: a TextInput or the
   WebView takes them natively and the move events stop reaching JS, so the
   sheet moved only for the few drags that began on inert pixels. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";
import { Gesture } from "react-native-gesture-handler";

/** Past this much drag, or this much flick, the sheet is on its way out. */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 700; // px per second, gesture-handler's unit
const IN_DURATION = 280;
const OUT_DURATION = 200;
/** Downward past this the sheet takes the gesture; upward it never does. */
const CLAIM_OFFSET = 12;

export function useSheet(open: boolean, onClose: () => void, bodyEnabled = true) {
  const height = Dimensions.get("window").height;
  const translateY = useRef(new Animated.Value(height)).current;
  /* The modal outlives `open` by one animation, so the exit is visible. */
  const [mounted, setMounted] = useState(open);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: IN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(translateY, {
      toValue: height,
      duration: OUT_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [open, height, translateY]);

  /* Two identical pans over one sheet position: the handle always listens,
     the body only while its content has no scrolling left to do. */
  const build = () =>
    Gesture.Pan()
      .activeOffsetY(CLAIM_OFFSET)
      .failOffsetY(-CLAIM_OFFSET)
      .runOnJS(true)
      .onUpdate((event) => {
        translateY.setValue(Math.max(0, event.translationY));
      })
      .onEnd((event) => {
        if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) {
          close.current();
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 0,
          useNativeDriver: true,
        }).start();
      });

  const handleGesture = useMemo(build, [translateY]);
  const bodyGesture = useMemo(() => build().enabled(bodyEnabled), [translateY, bodyEnabled]);

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, height],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return { mounted, translateY, backdropOpacity, handleGesture, bodyGesture };
}
