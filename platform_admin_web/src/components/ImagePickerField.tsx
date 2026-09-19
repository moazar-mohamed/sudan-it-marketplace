import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IMAGE_ACCEPT,
  checkImageFile,
  isValidImageUrl,
  type ImageSelection,
} from '../data/imageRules';
import type { TranslationKey } from '../i18n/dictionary';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';

type View = 'options' | 'url' | 'camera';

/** Captured photos are scaled down so they stay well under the size limit. */
const CAMERA_MAX_SIDE = 1600;

/**
 * Live camera preview using the browser's camera API. Reports a translation
 * key through `onError` when there is no camera, no permission, or the
 * browser does not offer camera access (it needs https or localhost).
 */
function CameraView({
  onCapture,
  onCancel,
  onError,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
  onError: (message: TranslationKey) => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      const media = navigator.mediaDevices;
      if (!media?.getUserMedia) {
        onError('image.cameraUnsupported');
        return;
      }
      try {
        stream = await media.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setReady(true);
      } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          onError('image.cameraDenied');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          onError('image.cameraNotFound');
        } else {
          onError('image.cameraFailed');
        }
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onError]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, CAMERA_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        else onError('image.cameraFailed');
      },
      'image/jpeg',
      0.9,
    );
  };

  return (
    <>
      <video ref={videoRef} className="image-source__video" playsInline muted autoPlay />
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--primary" onClick={capture} disabled={!ready}>
          {t('image.capture')}
        </button>
      </div>
    </>
  );
}

/**
 * The source chooser: device file, camera or URL. It is a small dialog of its
 * own (rather than the shared Modal) so it can sit on top of another dialog
 * and close alone on Escape.
 */
function ImageSourceDialog({
  title,
  initialUrl,
  onClose,
  onPickDevice,
  onFile,
  onUrl,
}: {
  title: string;
  initialUrl: string;
  onClose: () => void;
  onPickDevice: () => void;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('options');
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [urlText, setUrlText] = useState(initialUrl);

  useEffect(() => {
    // Capture phase, so Escape closes only this dialog and not the one below.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const cameraFailed = useCallback((key: TranslationKey) => {
    setMessage(key);
    setView('options');
  }, []);

  const submitUrl = () => {
    if (!urlText.trim()) setMessage('image.emptyUrl');
    else if (!isValidImageUrl(urlText)) setMessage('image.invalidUrl');
    else onUrl(urlText.trim());
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--narrow image-source" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{view === 'url' ? t('image.useUrl') : title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {view === 'options' && (
          <>
            <div className="image-source__list">
              <button type="button" className="image-source__option" onClick={onPickDevice}>
                <span aria-hidden="true">📱</span> {t('image.fromDevice')}
              </button>
              <button
                type="button"
                className="image-source__option"
                onClick={() => {
                  setMessage(null);
                  setView('camera');
                }}
              >
                <span aria-hidden="true">📷</span> {t('image.takePhoto')}
              </button>
              <button
                type="button"
                className="image-source__option"
                onClick={() => {
                  setMessage(null);
                  setView('url');
                }}
              >
                <span aria-hidden="true">🔗</span> {t('image.useUrl')}
              </button>
            </div>
            {message && (
              <p className="field__error image-source__message" role="alert">
                {t(message)}
              </p>
            )}
            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose}>
                {t('common.cancel')}
              </button>
            </div>
          </>
        )}

        {view === 'url' && (
          <>
            <label className="field">
              <span>{t('image.url')}</span>
              <input
                value={urlText}
                onChange={(e) => {
                  setUrlText(e.target.value);
                  setMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitUrl();
                  }
                }}
                placeholder="https://…"
                inputMode="url"
                dir="ltr"
                autoFocus
                aria-invalid={message !== null}
              />
              {message && <small className="field__error">{t(message)}</small>}
            </label>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--primary" onClick={submitUrl}>
                {t('image.done')}
              </button>
            </div>
          </>
        )}

        {view === 'camera' && (
          <CameraView onCapture={onFile} onCancel={onClose} onError={cameraFailed} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * One "Add Image" control for every image input on the dashboard. The source
 * (device file, browser camera, URL) is chosen in a dialog; a picked file is
 * previewed here and uploaded by the caller when the form is saved.
 */
export function ImagePickerField({
  value,
  onChange,
  disabled,
  uploading,
}: {
  value: ImageSelection;
  onChange: (next: ImageSelection) => void;
  disabled?: boolean;
  /** Shows the "Uploading image" overlay while the form is being saved. */
  uploading?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<TranslationKey | null>(null);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const commit = (next: ImageSelection) => {
    if (value.kind === 'file') URL.revokeObjectURL(value.preview);
    onChange(next);
  };

  const acceptFile = (file: File) => {
    const found = checkImageFile(file);
    if (found) {
      setProblem(found === 'tooLarge' ? 'image.tooLarge' : 'image.unsupported');
      return;
    }
    setProblem(null);
    commit({ kind: 'file', file, preview: URL.createObjectURL(file) });
  };

  const previewSrc =
    value.kind === 'file' ? value.preview : value.kind === 'url' ? value.url : '';

  return (
    <div className="image-field">
      <span className="image-field__label">{t('image.label')}</span>

      {value.kind === 'none' ? (
        <button
          type="button"
          className="image-field__add"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          + {t('image.add')}
        </button>
      ) : (
        <>
          <div className="image-field__preview">
            {brokenSrc === previewSrc ? (
              <Icon name="image" size={36} />
            ) : (
              <img src={previewSrc} alt="" referrerPolicy="no-referrer" onError={() => setBrokenSrc(previewSrc)} />
            )}
            {uploading && (
              <div className="image-field__uploading" role="status">
                <span className="spinner" aria-hidden="true" />
                {t('image.uploading')}
              </div>
            )}
          </div>
          <div className="image-field__actions">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setOpen(true)}
              disabled={disabled || uploading}
            >
              {t('image.change')}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--danger-ghost"
              onClick={() => {
                setProblem(null);
                commit({ kind: 'none' });
              }}
              disabled={disabled || uploading}
            >
              {t('image.remove')}
            </button>
          </div>
        </>
      )}

      {problem && (
        <small className="field__error" role="alert">
          {t(problem)}
        </small>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // Lets the same file be picked again.
          if (file) acceptFile(file);
        }}
      />

      {open && (
        <ImageSourceDialog
          title={value.kind === 'none' ? t('image.add') : t('image.change')}
          initialUrl={value.kind === 'url' ? value.url : ''}
          onClose={close}
          onPickDevice={() => {
            setOpen(false);
            inputRef.current?.click();
          }}
          onFile={(file) => {
            setOpen(false);
            acceptFile(file);
          }}
          onUrl={(url) => {
            setOpen(false);
            setProblem(null);
            commit({ kind: 'url', url });
          }}
        />
      )}
    </div>
  );
}
