import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { analytics } from '../analytics';
import { notifier } from '../notify';
import { shop } from '../purchases';
import { deleteAllData, settingsStore, useSettings } from '../store';
import type { SettingKey } from '../store/settings';
import { haptics } from './haptics';
import { Button, Popup, Sheet, ToggleRow, Txt, Well } from './kit';
import { strings } from './strings';
import { colors, space } from './theme';
import { closeSheet, toast } from './uiStore';

/** The pages the store listings point to as well. */
const SITE = 'https://sambulosenda.github.io/market-game';
const links = [
  { label: strings.settings.privacy, url: `${SITE}/privacy/` },
  { label: strings.settings.terms, url: `${SITE}/terms/` },
  { label: strings.settings.support, url: `${SITE}/support/` },
];

const toggles: SettingKey[] = ['music', 'sound', 'haptics', 'notifications', 'reduceMotion'];

/** The settings: each switch applies at once and is saved. Deleting data asks first. */
export function SettingsSheet() {
  const settings = useSettings((s) => s);
  const [confirming, setConfirming] = useState(false);
  // Read on each render: deleting the data replaces it.
  const playerId = analytics.playerId();

  const change = (key: SettingKey, value: boolean) => {
    settingsStore.getState().set(key, value);
    // After the change, so turning haptics on is felt and turning them off is not.
    haptics.light();
    // The system asks the player once. If the answer is no, the switch goes back off.
    if (key === 'notifications' && value) {
      void notifier.requestPermission().then((allowed) => {
        if (allowed) return;
        settingsStore.getState().set('notifications', false);
        toast(strings.notifications.blocked);
      });
    }
  };

  return (
    <>
      <Sheet title={strings.settings.title} onClose={closeSheet}>
        <Well style={styles.group}>
          {toggles.map((key) => (
            <ToggleRow
              key={key}
              label={strings.settings[key]}
              hint={strings.settings.hints[key]}
              value={settings[key]}
              onChange={(value) => change(key, value)}
            />
          ))}
        </Well>
        {shop.available && (
          <Button
            small
            kind="secondary"
            label={strings.gemShop.restore}
            onPress={() =>
              void shop
                .restore()
                .then((restored) =>
                  toast(
                    restored === null
                      ? strings.gemShop.restoreFailed
                      : restored.length > 0
                        ? strings.gemShop.restored
                        : strings.gemShop.nothingToRestore,
                  ),
                )
            }
          />
        )}
        <View style={styles.links}>
          {links.map((link) => (
            <Button
              key={link.url}
              small
              kind="secondary"
              style={styles.link}
              label={link.label}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(link.url).catch(() => toast(strings.settings.linkFailed))}
            />
          ))}
        </View>
        <View style={styles.danger}>
          <Txt variant="small" soft>
            {strings.settings.deleteHint}
          </Txt>
          <Button kind="secondary" label={strings.settings.deleteData} onPress={() => setConfirming(true)} />
          {playerId && (
            // Selectable, so a long press copies it into an email to support.
            <Txt variant="small" soft selectable>
              {strings.settings.playerId(playerId)}
            </Txt>
          )}
        </View>
      </Sheet>
      {confirming && (
        <Popup
          title={strings.settings.deleteTitle}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button label={strings.settings.deleteKeep} onPress={() => setConfirming(false)} />
              <Button
                kind="secondary"
                label={strings.settings.deleteConfirm}
                haptic={false}
                onPress={() => {
                  deleteAllData();
                  // The new game reports under a new anonymous id.
                  analytics.reset();
                  haptics.warning();
                  setConfirming(false);
                  closeSheet();
                }}
              />
            </>
          }
        >
          <Txt style={styles.centre}>{strings.settings.deleteBody}</Txt>
        </Popup>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { paddingHorizontal: space.md, paddingVertical: space.xs },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  link: { flexGrow: 1 },
  danger: { gap: space.sm, borderTopWidth: 1, borderColor: colors.panelEdge, paddingTop: space.md },
  centre: { textAlign: 'center' },
});
