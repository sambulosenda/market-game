import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Street } from '@/scene/Street';
import { BakePanel } from '@/ui/BakePanel';
import { CollectFx } from '@/ui/fx/CollectFx';
import { PantryBar } from '@/ui/PantryBar';
import { colors } from '@/ui/theme';
import { useAppLifecycle } from '@/ui/useAppLifecycle';
import { WelcomeBack } from '@/ui/WelcomeBack';

export default function StreetScreen() {
  useAppLifecycle();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PantryBar />
      <Street />
      <View style={styles.panel}>
        <BakePanel shopId="bakery" />
      </View>
      <CollectFx />
      <WelcomeBack />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.panel },
  panel: { flex: 1 },
});
