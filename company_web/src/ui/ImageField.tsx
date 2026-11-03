import { useRef, useState, type DragEvent } from 'react';
import { imageProblem, imageProblemText, isImageUrl, uploadImage, uploadProblemText } from '../data/images';
import { Banner, Spinner } from './kit';
import { Icon } from './Icon';

/**
 * One image: picked or dropped from the device (uploaded to Firebase Storage),
 * or given as a link. [value] is the URL to store; '' means none.
 */
export function ImageField({
  value,
  onChange,
  folder,
  label = 'الصورة',
  round,
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    const problem = imageProblem(file);
    if (problem) {
      setError(imageProblemText(problem));
      return;
    }
    setProgress(0);
    try {
      onChange(await uploadImage(file, folder, setProgress));
    } catch (e) {
      setError(uploadProblemText(e));
    } finally {
      setProgress(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void pick(e.dataTransfer.files[0]);
  };

  const addLink = () => {
    if (!isImageUrl(link)) {
      setLinkError('اكتب رابطًا صحيحًا يبدأ بـ https://');
      return;
    }
    setLinkError('');
    onChange(link.trim());
    setLink('');
  };

  const uploading = progress !== null;
  return (
    <div className="fld">
      <span className="lab">{label}</span>
      <div className="row wrap" style={{ alignItems: 'stretch' }}>
        <div className="imgs">
          <div className="imgslot main" style={round ? { borderRadius: '50%' } : undefined}>
            {value ? <img src={value} alt="" /> : <Icon name="image" size="lg" />}
            {value && !uploading && (
              <button type="button" className="x" aria-label="إزالة الصورة" onClick={() => onChange('')}>
                <Icon name="x" size="sm" />
              </button>
            )}
          </div>
        </div>
        <div
          className={`dropzone grow${over ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <div className="ico-c" style={{ background: 'var(--brand-tint)', color: 'var(--brand-ink)' }}>
            {uploading ? <Spinner /> : <Icon name="upload" size="lg" />}
          </div>
          <div className="grow">
            <div className="b">{uploading ? `جارٍ الرفع… ${progress}%` : 'اسحب الصورة هنا أو اختر من جهازك'}</div>
            <div className="sub">JPG أو PNG أو WebP أو GIF · حتى 5MB</div>
            {uploading && <div className="prog" style={{ marginTop: 6 }}><i style={{ width: `${progress}%` }} /></div>}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn p" disabled={uploading} onClick={() => input.current?.click()}>اختيار من الجهاز</button>
        </div>
      </div>
      {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
      <div className="row">
        <input className="inp ltr" placeholder="أو الصق رابط الصورة https://…" aria-label="رابط الصورة" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
        <button type="button" className="btn" onClick={addLink}><Icon name="link" />إضافة بالرابط</button>
      </div>
      {linkError && <span className="errt">{linkError}</span>}
    </div>
  );
}
