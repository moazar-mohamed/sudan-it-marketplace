import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from './hooks';
import { mapFavorite } from './mappers';
import type { Favorite, FavoriteKind } from './types';

// Port of favorites_store.dart: users/{uid}/favorites/{key}, private to the customer.

const NAME_MAX = 200;

/** The document id, fixed per item so one can only be saved once. */
export const favoriteKey = (kind: FavoriteKind, targetId: string): string => `${kind}_${targetId}`;

/** Newest first, sorted here so no index is needed. Null until loaded. */
export function useFavorites(uid: string): Favorite[] | null {
  const { items } = useCollection<Favorite>(() => collection(db, 'users', uid, 'favorites'), mapFavorite, uid);
  return items ? [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : null;
}

export function setFavorite(uid: string, kind: FavoriteKind, targetId: string, name: string, saved: boolean): Promise<void> {
  const ref = doc(db, 'users', uid, 'favorites', favoriteKey(kind, targetId));
  if (!saved) return deleteDoc(ref);
  return setDoc(ref, { kind, targetId, name: name.slice(0, NAME_MAX), createdAt: serverTimestamp() });
}

/** Whether the item is still in the catalogue, stocked or not; true when it cannot be told. */
export function useTargetExists(kind: FavoriteKind, targetId: string): boolean {
  const [exists, setExists] = useState(true);
  useEffect(() => {
    let live = true;
    getDoc(doc(db, kind === 'product' ? 'products' : 'services', targetId)).then(
      (snap) => live && setExists(snap.exists()),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [kind, targetId]);
  return exists;
}
