import { useState, type DragEvent } from 'react';
import { imageProblem, imageProblemText, uploadImage, uploadProblemText } from '../data/images';
import { ImageAdder } from './ImageAdder';
import { Banner } from './kit';
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
  emptyText = 'لم تُضف صورة بعد',
  round,
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  emptyText?: string;
  round?: boolean;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

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

  const uploading = progress !== null;
  return (
    <div className="fld">
      <span className="lab">{label}</span>
      <div
        className={`imgbox${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <div className={`imgslot${round ? ' round' : ''}`}>
          {value ? <img src={value} alt="" /> : <Icon name="image" size="lg" />}
        </div>
        <div className="imgbox-body">
          <div className="b">{value ? 'الصورة الحالية' : emptyText}</div>
          <ImageAdder
            uploading={uploading}
            progress={progress}
            deviceLabel={value ? 'تغيير من الجهاز' : 'رفع من الجهاز'}
            onFiles={(files) => void pick(files[0])}
            onLink={onChange}
          >
            {value && !uploading && <button type="button" className="btn g" onClick={() => onChange('')}>إزالة</button>}
          </ImageAdder>
          <div className="sub">JPG أو PNG أو WebP أو GIF، حتى 5MB. يمكنك أيضًا سحب الصورة وإفلاتها هنا.</div>
        </div>
      </div>
      {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
    </div>
  );
}
