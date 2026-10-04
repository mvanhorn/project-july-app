// Web dev builds only: shown inside a frame (the local phone board, public/phones.html),
// the app hides desktop scrollbars, as a phone wouldn't show them. The board can't
// do it from outside: its frames load from another origin, each in its own process.
import { Platform } from 'react-native';

if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && window.top !== window) {
  const style = document.createElement('style');
  style.textContent = '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}';
  document.head.appendChild(style);
}
