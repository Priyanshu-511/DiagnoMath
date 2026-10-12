import * as Haptics from 'expo-haptics';
import { Pressable, type GestureResponderEvent, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';

// Mirrors the shape of BottomTabBarButtonProps from react-navigation/bottom-tabs
// without importing the package directly (incompatible with expo-router SDK 57+)
type TabBarButtonProps = PressableProps & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  to?: string;
};

export function HapticTab({ onPressIn, ...props }: TabBarButtonProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev: GestureResponderEvent) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    />
  );
}
