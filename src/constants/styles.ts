/** Layout styles shared across components (combine with local styles in a style array). */
import { StyleSheet } from 'react-native';

import { Radius } from './theme';

export const Common = StyleSheet.create({
  flex: { flex: 1 },
  /** Horizontal, vertically centred. */
  row: { flexDirection: 'row', alignItems: 'center' },
  /** Horizontal, children pushed to both ends. */
  spread: { flexDirection: 'row', justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },
  /** Fully rounded and centred: give it a width and height to get a circle. */
  circle: { borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  textCenter: { textAlign: 'center' },
});
