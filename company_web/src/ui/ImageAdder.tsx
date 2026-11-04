import { useRef, useState, type ReactNode } from 'react';
import { isImageUrl } from '../data/images';
import { Icon } from './Icon';
import { Spinner } from './kit';

/**
 * The two ways to add a picture, as two plain buttons: from the device, or by
 * pasting a link (its box opens only when asked for). Shared by ImageField and
 * GalleryField. [children] are extra buttons, shown after the two.
 */
export function ImageAdder({
  multiple,
  uploading,
  progress,
  deviceLabel = 'رفع من الجهاز',
  onFiles,
  onLink,
  children,
}: {
  multiple?: boolean;
  uploading: boolean;
  progress: number | null;
  deviceLabel?: string;
  onFiles: (files: File[]) => void;
  onLink: (url: string) => void;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');

  const closeLink = () => { setLinkOpen(false); setLink(''); setLinkError(''); };
  const submitLink = () => {
    if (!isImageUrl(link)) {
      setLinkError('اكتب رابطًا صحيحًا يبدأ بـ https://');
      return;
    }
    onLink(link.trim());
    closeLink();
  };

  return (
    <div className="adder">
      <div className="row wrap" style={{ gap: 8 }}>
        <input
          ref={input}
          type="file"
          multiple={multiple}
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }}
        />
        <button type="button" className="btn p" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Spinner /> : <Icon name="upload" />}
          {uploading ? `جارٍ الرفع… ${progress ?? 0}%` : deviceLabel}
        </button>
        <button type="button" className="btn" disabled={uploading} aria-expanded={linkOpen} onClick={() => (linkOpen ? closeLink() : setLinkOpen(true))}>
          <Icon name="link" />
          من رابط
        </button>
        {children}
      </div>
      {uploading && <div className="prog"><i style={{ width: `${progress ?? 0}%` }} /></div>}
      {linkOpen && (
        <>
          <div className="linkrow">
            <input
              className="inp ltr"
              autoFocus
              placeholder="https://…"
              aria-label="رابط الصورة"
              value={link}
              onChange={(e) => { setLink(e.target.value); setLinkError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitLink(); } if (e.key === 'Escape') closeLink(); }}
            />
            <button type="button" className="btn p" onClick={submitLink}>إضافة</button>
            <button type="button" className="btn" onClick={closeLink}>إلغاء</button>
          </div>
          {linkError && <span className="errt">{linkError}</span>}
        </>
      )}
    </div>
  );
}
