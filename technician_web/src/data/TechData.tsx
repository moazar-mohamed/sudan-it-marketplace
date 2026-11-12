import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { collection, doc, limit, onSnapshot, query, where, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase';
import { useProfile } from '../auth/AuthProvider';
import { chatUnread } from './jobs';
import { mapChat, mapCompany, mapJob, mapNotice, mapTechnician } from './mappers';
import type { Company, GeoPoint, Job, JobChat, Notice, TechnicianRecord } from './types';

export type LocationState = { status: 'unknown' } | { status: 'off' } | { status: 'on'; point: GeoPoint };

interface TechDataValue {
  technician: TechnicianRecord | null;
  /** False until the technician record has been looked up (it may not exist). */
  technicianReady: boolean;
  jobs: Job[];
  jobsReady: boolean;
  jobsError: boolean;
  notices: Notice[];
  company: Company | null;
  chats: Record<string, JobChat | null>;
  location: LocationState;
  askLocation: () => void;
  online: boolean;
  /** When the device last had the server's copy of the jobs. */
  syncedAt: Date | null;
  /** Changes made on this device that the server has not confirmed yet. */
  pendingCount: number;
  unreadNotices: number;
  /** New jobs the technician has not opened: unread technician_assigned notices. */
  newJobIds: Set<string>;
  unreadChats: number;
}

const Ctx = createContext<TechDataValue | null>(null);
const LOCATION_ASKED = 'technician-portal-location-asked';

const ignoreDenied = (onOther: (e: FirestoreError) => void) => (e: FirestoreError) => {
  if (e.code !== 'permission-denied') onOther(e);
};

/** Everything the screens show, read live (and from the device's copy when offline). */
export function TechDataProvider({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const [byUid, setByUid] = useState<TechnicianRecord | null | undefined>(undefined);
  const [byEmail, setByEmail] = useState<TechnicianRecord | null | undefined>(undefined);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsReady, setJobsReady] = useState(false);
  const [jobsError, setJobsError] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [chats, setChats] = useState<Record<string, JobChat | null>>({});
  const [location, setLocation] = useState<LocationState>({ status: 'unknown' });
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  // The technician record: keyed by the account's uid (every account a company creates), else matched by company + e-mail (older ones).
  useEffect(() => {
    return onSnapshot(
      doc(db, 'technicians', profile.uid),
      (snap) => setByUid(snap.exists() ? mapTechnician(snap.id, snap.data()) : null),
      () => setByUid(null),
    );
  }, [profile.uid]);

  useEffect(() => {
    if (byUid !== null || !profile.email) {
      setByEmail(byUid === null ? null : undefined);
      return;
    }
    return onSnapshot(
      query(collection(db, 'technicians'), where('companyId', '==', profile.companyId), where('email', '==', profile.email), limit(1)),
      (snap) => setByEmail(snap.empty ? null : mapTechnician(snap.docs[0].id, snap.docs[0].data())),
      () => setByEmail(null),
    );
  }, [byUid, profile.companyId, profile.email]);

  const technician = byUid ?? byEmail ?? null;
  const technicianReady = byUid !== undefined && (byUid !== null || byEmail !== undefined);
  const techId = technician?.id ?? '';

  useEffect(() => {
    if (!techId) return;
    setJobsReady(false);
    return onSnapshot(
      query(collection(db, 'orders'), where('technicianId', '==', techId)),
      { includeMetadataChanges: true },
      (snap) => {
        const list = snap.docs.map((d) => mapJob(d.id, d.data(), d.metadata.hasPendingWrites));
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setJobs(list);
        setJobsReady(true);
        setJobsError(false);
        if (!snap.metadata.fromCache) setSyncedAt(new Date());
      },
      () => {
        setJobsReady(true);
        setJobsError(true);
      },
    );
  }, [techId]);

  useEffect(() => {
    if (!techId) return;
    return onSnapshot(
      query(collection(db, 'notifications'), where('recipientType', '==', 'technician'), where('recipientId', '==', techId)),
      (snap) => {
        const list = snap.docs.map((d) => mapNotice(d.id, d.data()));
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setNotices(list);
      },
      () => setNotices([]),
    );
  }, [techId]);

  useEffect(() => {
    if (!profile.companyId) return;
    return onSnapshot(
      doc(db, 'companies', profile.companyId),
      (snap) => setCompany(snap.exists() ? mapCompany(snap.id, snap.data()) : null),
      () => setCompany(null),
    );
  }, [profile.companyId]);

  // One conversation per job, read by its id (the rules allow get, not list). Before its first message it does not exist.
  const chatIds = useMemo(() => jobs.slice(0, 80).map((j) => j.id).join(','), [jobs]);
  const chatSubs = useRef(new Map<string, () => void>());
  useEffect(() => {
    const wanted = new Set(chatIds ? chatIds.split(',') : []);
    const subs = chatSubs.current;
    for (const [id, stop] of subs) {
      if (!wanted.has(id)) {
        stop();
        subs.delete(id);
      }
    }
    for (const id of wanted) {
      if (subs.has(id)) continue;
      subs.set(
        id,
        onSnapshot(
          doc(db, 'jobChats', id),
          (snap) => setChats((now) => ({ ...now, [id]: snap.exists() ? mapChat(snap.id, snap.data()) : null })),
          ignoreDenied(() => undefined),
        ),
      );
    }
  }, [chatIds]);
  useEffect(() => {
    const subs = chatSubs.current;
    return () => {
      for (const stop of subs.values()) stop();
      subs.clear();
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const readPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocation({ status: 'off' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setLocation({ status: 'on', point: { latitude: p.coords.latitude, longitude: p.coords.longitude } }),
      () => setLocation({ status: 'off' }),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 15_000 },
    );
  }, []);

  // The position is asked for once; after that it is read only when the browser already allows it.
  useEffect(() => {
    let asked = false;
    try {
      asked = localStorage.getItem(LOCATION_ASKED) === '1';
    } catch {
      asked = false;
    }
    const permissions = navigator.permissions?.query?.({ name: 'geolocation' as PermissionName });
    if (!permissions) {
      if (!asked) readPosition();
      else setLocation({ status: 'off' });
      return;
    }
    void permissions
      .then((p) => {
        if (p.state === 'granted' || (p.state === 'prompt' && !asked)) {
          try {
            localStorage.setItem(LOCATION_ASKED, '1');
          } catch {
            /* asked again next visit */
          }
          readPosition();
        } else setLocation({ status: 'off' });
      })
      .catch(() => setLocation({ status: 'off' }));
  }, [readPosition]);

  const askLocation = useCallback(() => {
    try {
      localStorage.setItem(LOCATION_ASKED, '1');
    } catch {
      /* fine */
    }
    readPosition();
  }, [readPosition]);

  const value = useMemo<TechDataValue>(() => {
    const unreadNotices = notices.filter((n) => !n.isRead).length;
    const newJobIds = new Set(notices.filter((n) => !n.isRead && n.type === 'technician_assigned').map((n) => n.orderId));
    const unreadChats = Object.values(chats).filter((c) => chatUnread(c)).length;
    return {
      technician,
      technicianReady,
      jobs,
      jobsReady,
      jobsError,
      notices,
      company,
      chats,
      location,
      askLocation,
      online,
      syncedAt,
      pendingCount: jobs.filter((j) => j.pendingSync).length,
      unreadNotices,
      newJobIds,
      unreadChats,
    };
  }, [technician, technicianReady, jobs, jobsReady, jobsError, notices, company, chats, location, askLocation, online, syncedAt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTechData(): TechDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTechData outside TechDataProvider');
  return v;
}

export function useJob(id: string | undefined): Job | null {
  const { jobs } = useTechData();
  return useMemo(() => jobs.find((j) => j.id === id) ?? null, [jobs, id]);
}
