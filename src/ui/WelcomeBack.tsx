import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { content } from '../content';
import { gameStore, useGame } from '../store';
import { strings } from './strings';
import { colors } from './theme';

/** Lists what finished while the player was away. A simple first pass at T4.7. */
export function WelcomeBack() {
  const summary = useGame((s) => s.welcomeBack);
  if (!summary) return null;
  const close = () => gameStore.getState().dismissWelcomeBack();
  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{strings.welcomeBackTitle}</Text>
          <Text style={styles.body}>{strings.welcomeBackBody}</Text>
          {Object.entries(summary.finished).map(([good, n]) => (
            <Text key={good} style={styles.item}>
              {content.goods[good]?.name ?? good} × {n}
            </Text>
          ))}
          <Pressable accessibilityRole="button" style={styles.button} onPress={close}>
            <Text style={styles.buttonText}>{strings.ok}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(40,25,15,0.4)', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: colors.panel, borderRadius: 20, padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, color: colors.inkSoft, marginBottom: 4 },
  item: { fontSize: 18, color: colors.ink, fontWeight: '600' },
  button: { marginTop: 12, backgroundColor: colors.button, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: colors.buttonText, fontSize: 17, fontWeight: '700' },
});
