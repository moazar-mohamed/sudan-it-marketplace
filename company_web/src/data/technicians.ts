import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { mapTechnician } from './mappers';
import type { Technician } from './types';

/** The company's technicians, live; null while they load. */
export function useTechnicians(companyId: string): Technician[] | null {
  const [list, setList] = useState<Technician[] | null>(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'technicians'), where('companyId', '==', companyId)),
        (s) => setList(s.docs.map((d) => mapTechnician(d.id, d.data())).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'))),
        () => setList([]),
      ),
    [companyId],
  );
  return list;
}
