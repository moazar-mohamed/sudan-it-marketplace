import { useState } from 'react';
import { auth } from '../firebase';
import {
  addAdminNote,
  deleteAdminNote,
  noteProblem,
  NOTE_MAX,
  useAdminNotes,
  type NoteTarget,
} from '../data/adminNotes';
import { useI18n } from '../i18n/I18nProvider';
import { useConfirm, useRunner } from './feedback';
import { Card, Text } from './ui';

/**
 * Internal notes on a company, a customer or an order: written and read by
 * Platform Admins only. A note can be removed by whoever wrote it.
 */
export function AdminNotes({ targetType, targetId }: { targetType: NoteTarget; targetId: string }) {
  const { t, dateTime } = useI18n();
  const { notes, status } = useAdminNotes(targetType, targetId);
  const [text, setText] = useState('');
  const { busy, run } = useRunner();
  const confirm = useConfirm();
  const me = auth.currentUser?.uid ?? '';

  const add = async () => {
    if (noteProblem(text)) return;
    const done = await run('add', () => addAdminNote(targetType, targetId, text), t('notes.added'));
    if (done) setText('');
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t('notes.confirmDelete.title'),
      body: t('notes.confirmDelete.body'),
      confirmLabel: t('notes.delete'),
      danger: true,
    });
    if (!ok) return;
    await run(id, () => deleteAdminNote(id), t('notes.deleted'));
  };

  const problem = noteProblem(text);
  return (
    <Card title={`${t('notes.title')}${status === 'ready' && notes.length > 0 ? ` (${notes.length})` : ''}`}>
      <p className="muted">{t('notes.hint')}</p>
      <label className="field">
        <span className="field__label">{t('notes.new')}</span>
        <textarea
          className="input"
          rows={3}
          value={text}
          maxLength={NOTE_MAX + 200}
          placeholder={t('notes.placeholder')}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {problem === 'tooLong' && (
        <p className="alert alert--error" role="alert">
          {t('notes.tooLong', { max: NOTE_MAX })}
        </p>
      )}
      <div className="btn-group">
        <button className="btn btn--primary btn--sm" disabled={problem !== null || busy === 'add'} onClick={() => void add()}>
          {t('notes.add')}
        </button>
      </div>
      {status === 'error' && (
        <p className="alert alert--error" role="alert">
          {t('notes.loadFailed')}
        </p>
      )}
      {status === 'ready' && notes.length === 0 && <p className="muted">{t('notes.empty')}</p>}
      <ul className="note-list">
        {notes.map((n) => (
          <li key={n.id} className="note">
            <p className="note__text">
              <Text>{n.text}</Text>
            </p>
            <p className="note__meta">
              <span>{n.authorName || '—'}</span> · <span>{dateTime(n.createdAt)}</span>
              {n.authorId === me && (
                <>
                  {' · '}
                  <button className="link-sm" disabled={busy === n.id} onClick={() => void remove(n.id)}>
                    {t('notes.delete')}
                  </button>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
