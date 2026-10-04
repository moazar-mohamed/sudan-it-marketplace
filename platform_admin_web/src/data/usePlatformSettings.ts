import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { DEFAULT_SETTINGS, parsePlatformSettings, type PlatformSettings } from './platformSettings';

export interface SettingsState {
  status: 'loading' | 'ready' | 'error';
  settings: PlatformSettings;
}

/** The live notices document; a missing document reads as everything off. */
export function usePlatformSettings(): SettingsState {
  const [state, setState] = useState<SettingsState>({ status: 'loading', settings: DEFAULT_SETTINGS });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'platform_settings', 'public'),
        (snapshot) => setState({ status: 'ready', settings: parsePlatformSettings(snapshot.data()) }),
        () => setState({ status: 'error', settings: DEFAULT_SETTINGS }),
      ),
    [],
  );
  return state;
}
