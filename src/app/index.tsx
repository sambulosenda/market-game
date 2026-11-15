import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Street } from '@/scene/Street';
import { CollectFx } from '@/ui/fx/CollectFx';
import { RewardFx } from '@/ui/fx/RewardFx';
import { Hud } from '@/ui/Hud';
import { Toasts } from '@/ui/kit';
import { AlbumSheet } from '@/ui/AlbumSheet';
import { DailySheet } from '@/ui/DailySheet';
import { LandmarkSheet } from '@/ui/LandmarkSheet';
import { LevelUpPopup } from '@/ui/LevelUpPopup';
import { OrderBoard } from '@/ui/OrderBoard';
import { PantrySheet } from '@/ui/PantrySheet';
import { SettingsSheet } from '@/ui/SettingsSheet';
import { ShopSheet } from '@/ui/ShopSheet';
import { StreetPlaces } from '@/ui/StreetPlaces';
import { colors } from '@/ui/theme';
import { TutorialPointer } from '@/ui/tutorial/TutorialPointer';
import { uiStore } from '@/ui/uiStore';
import { useAppLifecycle } from '@/ui/useAppLifecycle';
import { useGameFeedback } from '@/ui/useGameFeedback';
import { WelcomeBack } from '@/ui/WelcomeBack';

/**
 * The one screen of the game: the street with the order board under it.
 * Sheets, effects and pop-ups are layers above, in that order.
 */
export default function StreetScreen() {
  useAppLifecycle();
  useGameFeedback();
  const sheet = useStore(uiStore, (s) => s.sheet);
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Hud />
        <Street />
        <StreetPlaces />
        <OrderBoard />
      </SafeAreaView>
      {sheet?.kind === 'shop' && <ShopSheet key={sheet.id} shopId={sheet.id} />}
      {sheet?.kind === 'landmark' && <LandmarkSheet key={sheet.id} landmarkId={sheet.id} />}
      {sheet?.kind === 'pantry' && <PantrySheet />}
      {sheet?.kind === 'settings' && <SettingsSheet />}
      {sheet?.kind === 'daily' && <DailySheet />}
      {sheet?.kind === 'album' && <AlbumSheet />}
      <TutorialPointer />
      <CollectFx />
      <RewardFx />
      <LevelUpPopup />
      <WelcomeBack />
      <Toasts />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.panel },
  safe: { flex: 1 },
});
