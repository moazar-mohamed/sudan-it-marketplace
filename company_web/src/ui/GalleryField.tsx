import { useRef, useState, type DragEvent } from 'react';
import { imageProblem, imageProblemText, isImageUrl, uploadImage, uploadProblemText } from '../data/images';
import { Icon } from './Icon';
import { Banner, Chip, Spinner } from './kit';

/**
 * Up to [max] pictures of a product. The first one is the main picture (also
 * what older apps show). Add from the device (several at once) or by link.
 */
export function GalleryField({
  urls,
  onChange,
  folder,
  max = 5,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  folder: string;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const room = max - urls.length;

  const addFiles = async (files: File[]) => {
    setError('');
    let next = urls;
    for (const file of files.slice(0, Math.max(0, max - urls.length))) {
      const problem = imageProblem(file);
      if (problem) { setError(imageProblemText(problem)); continue; }
      setProgress(0);
      try {
        next = [...next, await uploadImage(file, folder, setProgress)];
        onChange(next);
      } catch (e) {
        setError(uploadProblemText(e));
        break;
      }
    }
    if (files.length > room) setError((now) => now || `الحد الأقصى ${max} صور.`);
    setProgress(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void addFiles([...e.dataTransfer.files]);
  };

  const addLink = () => {
    if (!isImageUrl(link)) { setLinkError('اكتب رابطًا صحيحًا يبدأ بـ https://'); return; }
    setLinkError('');
    onChange([...urls, link.trim()]);
    setLink('');
  };

  const uploading = progress !== null;
  const makeMain = (i: number) => onChange([urls[i], ...urls.filter((_, k) => k !== i)]);

  return (
    <div className="fld">
      <span className="lab">صور المنتج <span className="muted">({urls.length} من {max})</span></span>
      <div className="imgs">
        {urls.map((u, i) => (
          <div key={u + i} className={`imgslot${i === 0 ? ' main' : ''}`}>
            <img src={u} alt="" loading="lazy" />
            {i === 0 && <span className="tag"><Chip tone="info" dot={false} small>الرئيسية</Chip></span>}
            <button type="button" className="x" aria-label={`إزالة الصورة ${i + 1}`} onClick={() => onChange(urls.filter((_, k) => k !== i))}><Icon name="x" size="sm" /></button>
            {i > 0 && <button type="button" className="btn sm" style={{ position: 'absolute', bottom: 6, insetInlineStart: 6, height: 26, padding: '0 8px', fontSize: 12 }} onClick={() => makeMain(i)}>رئيسية</button>}
          </div>
        ))}
        {urls.length === 0 && <div className="imgslot main"><Icon name="image" size="lg" /></div>}
      </div>

      {room > 0 && (
        <>
          <div
            className={`dropzone${over ? ' over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <div className="ico-c" style={{ background: 'var(--brand-tint)', color: 'var(--brand-ink)' }}>{uploading ? <Spinner /> : <Icon name="upload" size="lg" />}</div>
            <div className="grow">
              <div className="b">{uploading ? `جارٍ الرفع… ${progress}%` : 'اسحب الصور هنا أو اختر من جهازك'}</div>
              <div className="sub">JPG أو PNG أو WebP أو GIF · حتى 5MB للصورة · يمكنك رفع عدة صور معًا</div>
              {uploading && <div className="prog" style={{ marginTop: 6 }}><i style={{ width: `${progress}%` }} /></div>}
            </div>
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
            <button type="button" className="btn p" disabled={uploading} onClick={() => input.current?.click()}>اختيار من الجهاز</button>
          </div>
          <div className="row">
            <input className="inp ltr" placeholder="أو الصق رابط صورة https://…" aria-label="رابط صورة" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
            <button type="button" className="btn" onClick={addLink}><Icon name="link" />إضافة بالرابط</button>
          </div>
          {linkError && <span className="errt">{linkError}</span>}
        </>
      )}
      {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
    </div>
  );
}
