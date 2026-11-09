/**
 * Native "Today's habits" home-screen widget (Android only, see android/).
 * Optional: null when the running build doesn't include it (web, iOS, an older dev build).
 */
import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class StreaklyWidgetModule extends NativeModule {
  /** Saves `{ theme, data }` (JSON) for the widget and redraws it. */
  setData(json: string): void;
  /** Checks made in the widget and not yet applied by the app (JSON array); clears them. */
  takeToggles(): string;
}

export default requireOptionalNativeModule<StreaklyWidgetModule>('StreaklyWidget');
