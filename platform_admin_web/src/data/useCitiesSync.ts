import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '../firebase';
import { citiesFromDocument, setCityDirectory } from './cities';

/**
 * Keeps the list of cities current while the panel is open: Platform Admin's
 * list from `platform_settings/cities`, or the built-in one while there is
 * none (or it cannot be read).
 */
export function useCitiesSync(): void {
  useEffect(() => {
    try {
      return onSnapshot(
        doc(db, 'platform_settings', 'cities'),
        (snapshot) => setCityDirectory(citiesFromDocument(snapshot.data())),
        () => undefined,
      );
    } catch {
      return undefined;
    }
  }, []);
}
