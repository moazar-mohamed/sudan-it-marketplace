import { useState, type DragEvent } from 'react';
import { imageProblem, imageProblemText, uploadImage, uploadProblemText } from '../data/images';
import { Icon } from './Icon';
import { ImageAdder } from './ImageAdder';
import { Banner, Chip } from './kit';
import { t } from '../i18n';

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
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
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
    if (files.length > room) setError((now) => now || t('الحد الأقصى {0} صور.', max));
    setProgress(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void addFiles([...e.dataTransfer.files]);
  };

  const uploading = progress !== null;
  const makeMain = (i: number) => onChange([urls[i], ...urls.filter((_, k) => k !== i)]);

  return (
    <div className="fld">
      <span className="lab">{t('صور المنتج')}{' '}<span className="muted">{t('({0} من {1})', urls.length, max)}</span></span>
      <div className="imgs">
        {urls.map((u, i) => (
          <div key={u + i} className={`imgslot${i === 0 ? ' main' : ''}`}>
            <img src={u} alt="" loading="lazy" />
            {i === 0 && <span className="tag"><Chip tone="info" dot={false} small>{t('الرئيسية')}</Chip></span>}
            <button type="button" className="x" aria-label={t('إزالة الصورة {0}', i + 1)} onClick={() => onChange(urls.filter((_, k) => k !== i))}><Icon name="x" size="sm" /></button>
            {i > 0 && <button type="button" className="btn sm" style={{ position: 'absolute', bottom: 6, insetInlineStart: 6, height: 26, padding: '0 8px', fontSize: 12 }} onClick={() => makeMain(i)}>{t('رئيسية')}</button>}
          </div>
        ))}
        {urls.length === 0 && <div className="imgslot main"><Icon name="image" size="lg" /></div>}
      </div>

      {room > 0 && (
        <div
          className={`imgbox${over ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <div className="imgbox-body">
            <ImageAdder
              multiple
              uploading={uploading}
              progress={progress}
              deviceLabel={t('رفع صور من الجهاز')}
              onFiles={(files) => void addFiles(files)}
              onLink={(url) => onChange([...urls, url])}
            />
            <div className="sub">{t('JPG أو PNG أو WebP أو GIF، حتى 5MB للصورة. يمكنك رفع عدة صور معًا أو سحبها وإفلاتها هنا.')}</div>
          </div>
        </div>
      )}
      {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
    </div>
  );
}
