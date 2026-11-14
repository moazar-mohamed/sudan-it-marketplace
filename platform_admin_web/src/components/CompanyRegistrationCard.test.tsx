// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  documentFileName,
  registrationProblems,
  type CompanyDocument,
  type PreparedDocumentFile,
} from '../data/companyDocuments';
import { ar, en } from '../i18n/dictionary';
import { I18nProvider } from '../i18n/I18nProvider';
import { CompanyRegistrationCard } from './CompanyRegistrationCard';
import { ToastProvider } from './feedback';
import { RegistrationFields } from './RegistrationFields';

const stored: CompanyDocument = {
  companyId: 'c1',
  registrationNumber: 'CR-2024-0091',
  fileName: 'licence.jpg',
  contentType: 'image/jpeg',
  width: 1200,
  height: 1600,
  bytes: new Uint8Array(4096).fill(3),
  updatedAt: new Date(2026, 8, 20),
};

const storedPdf: CompanyDocument = {
  ...stored,
  fileName: 'licence.pdf',
  contentType: 'application/pdf',
  width: 0,
  height: 0,
};

const picked: PreparedDocumentFile = {
  bytes: new Uint8Array(1024).fill(5),
  contentType: 'image/jpeg',
  width: 800,
  height: 1000,
  fileName: 'new-scan.jpg',
};

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:test/doc');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const renderCard = (
  load: (id: string) => Promise<CompanyDocument | null>,
  save = vi.fn(async () => undefined),
) =>
  render(
    <I18nProvider>
      <ToastProvider>
        <CompanyRegistrationCard companyId="c1" load={load} save={save} />
      </ToastProvider>
    </I18nProvider>,
  );

const settle = () => act(async () => {});

describe('registration rules shared by both forms', () => {
  it('both the number and the document are required', () => {
    expect(registrationProblems({ registrationNumber: ' ', document: null })).toEqual([
      'number-required',
      'document-required',
    ]);
    expect(registrationProblems({ registrationNumber: 'x'.repeat(61), document: picked })).toEqual([
      'number-too-long',
    ]);
    expect(registrationProblems({ registrationNumber: 'CR-1', document: picked })).toEqual([]);
  });

  it('an image is always renamed to .jpg; a PDF keeps its name', () => {
    expect(documentFileName('Scan 2024.PNG', 'image/jpeg')).toBe('Scan 2024.jpg');
    expect(documentFileName('', 'image/jpeg')).toBe('document.jpg');
    expect(documentFileName(`${'a'.repeat(200)}.heic`, 'image/jpeg')).toHaveLength(99);
    expect(documentFileName('Commercial Register.pdf', 'application/pdf')).toBe(
      'Commercial Register.pdf',
    );
  });
});

describe('the registration card on a company page', () => {
  it('shows the number, and the image only when asked', async () => {
    renderCard(async () => stored);
    await settle();
    expect(screen.getByText('CR-2024-0091')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: en['registration.view'] }));
    expect(screen.getByRole('img', { name: en['registration.alt'] })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en['registration.hide'] }));
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('a PDF opens in a new tab instead of embedding', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderCard(async () => storedPdf);
    await settle();
    // One action, not a view/hide toggle: there is nothing to embed.
    expect(screen.queryByRole('button', { name: en['registration.hide'] })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: en['registration.view'] }));
    expect(openSpy).toHaveBeenCalledWith('blob:test/doc', '_blank', 'noopener');
    expect(screen.queryByRole('img')).toBeNull();
    openSpy.mockRestore();
  });

  it('a company added before documents were required says so and can get one', async () => {
    renderCard(async () => null);
    await settle();
    expect(screen.getByText(en['registration.missing'])).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en['registration.add'] }));
    // Saving without the fields is refused in the form itself.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    });
    expect(screen.getByText(en['registration.numberRequired'])).toBeTruthy();
    expect(screen.getByText(en['registration.documentRequired'])).toBeTruthy();
  });

  it('updating keeps the stored file unless a new one is picked', async () => {
    const save = vi.fn(async () => undefined);
    renderCard(async () => stored, save);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: en['registration.replace'] }));
    fireEvent.change(screen.getByLabelText(en['registration.number']), {
      target: { value: 'CR-2026-7' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    });
    expect(save).toHaveBeenCalledWith(
      'c1',
      'CR-2026-7',
      expect.objectContaining({ bytes: stored.bytes, fileName: 'licence.jpg' }),
    );
  });

  it('a failed load can be retried', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(stored);
    renderCard(load);
    await settle();
    expect(screen.getByRole('alert').textContent).toContain(en['registration.loadError']);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.retry'] }));
    });
    expect(screen.getByText('CR-2024-0091')).toBeTruthy();
  });
});

describe('picking the document file', () => {
  const renderFields = (prepare: (file: File) => Promise<PreparedDocumentFile>) => {
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <RegistrationFields
          value={{ registrationNumber: '', document: null }}
          onChange={onChange}
          showErrors={false}
          prepare={prepare}
        />
      </I18nProvider>,
    );
    return onChange;
  };

  it('the compressed photo is what goes into the form', async () => {
    const onChange = renderFields(async () => picked);
    const file = new File(['x'], 'scan.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('registration-file'), { target: { files: [file] } });
    });
    expect(onChange).toHaveBeenCalledWith({ registrationNumber: '', document: picked });
  });

  it('a small enough PDF is kept exactly as picked, not re-encoded', async () => {
    const pdf: PreparedDocumentFile = {
      bytes: new Uint8Array(2048).fill(1),
      contentType: 'application/pdf',
      width: 0,
      height: 0,
      fileName: 'register.pdf',
    };
    const onChange = renderFields(async () => pdf);
    const file = new File(['x'], 'register.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('registration-file'), { target: { files: [file] } });
    });
    expect(onChange).toHaveBeenCalledWith({ registrationNumber: '', document: pdf });
  });

  it('a picked PDF is shown by name only, never inline (a controlled re-render)', () => {
    render(
      <I18nProvider>
        <RegistrationFields
          value={{
            registrationNumber: '',
            document: {
              bytes: new Uint8Array(8).fill(1),
              contentType: 'application/pdf',
              width: 0,
              height: 0,
              fileName: 'register.pdf',
            },
          }}
          onChange={vi.fn()}
          showErrors={false}
        />
      </I18nProvider>,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText(/register\.pdf/).length).toBeGreaterThan(0);
  });

  it('a file over the limit is refused with its actual size in the message', async () => {
    const { DocumentFileError } = await import('../data/companyDocuments');
    renderFields(async () => {
      throw new DocumentFileError('too-large', 900_000);
    });
    const file = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('registration-file'), { target: { files: [file] } });
    });
    expect(screen.getByText('This file is 879 KB; the limit is 684 KB. Choose a smaller file, or a photo instead of a PDF.')).toBeTruthy();
  });

  it('an unsupported file type says so', async () => {
    const { DocumentFileError } = await import('../data/companyDocuments');
    renderFields(async () => {
      throw new DocumentFileError('unsupported-type');
    });
    const file = new File(['x'], 'notes.docx', { type: 'application/msword' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('registration-file'), { target: { files: [file] } });
    });
    expect(screen.getByText(en['registration.unsupportedType'])).toBeTruthy();
  });

  it('every text has an Arabic translation', () => {
    for (const key of Object.keys(en).filter((k) => k.startsWith('registration.'))) {
      expect(ar[key as keyof typeof ar], key).toBeTruthy();
    }
  });
});
