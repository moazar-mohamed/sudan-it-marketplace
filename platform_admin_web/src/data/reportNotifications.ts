import type { Report, ReportStatus } from './types';

/*
 * Telling the person who sent a report that it moved on. The notification is
 * written in the same batch that changes the report (firestore.rules checks it
 * says what is true, goes only to the sender, and is the one allowed for that
 * report and status), and carries no text of its own: the app words it from the
 * type and the report's subject, in the reader's language.
 */

export type ReportNotificationType = 'report_in_progress' | 'report_closed';

export interface ReportNotification {
  /** `{reportId}_{type}`: one per report and type, as the rules require. */
  id: string;
  recipientType: 'customer' | 'company_admin';
  /** A customer's uid, or a company's id (all its admins read it). */
  recipientId: string;
  reportId: string;
  type: ReportNotificationType;
  /** The report's subject: the only text, and the rules check it is the report's own. */
  productName: string;
}

/**
 * The notification for moving [report] to [status], or null when there is none:
 * the status did not change, it went back to "new", or the sender is someone
 * with no notification list (a technician) or a company with no id.
 */
export function reportNotificationFor(report: Report, status: ReportStatus): ReportNotification | null {
  if (status === report.status) return null;
  const type: ReportNotificationType | null =
    status === 'closed' ? 'report_closed' : status === 'in_progress' ? 'report_in_progress' : null;
  if (!type) return null;
  const to =
    report.reporterRole === 'customer' && report.reporterId
      ? ({ recipientType: 'customer', recipientId: report.reporterId } as const)
      : report.reporterRole === 'company_admin' && report.companyId
        ? ({ recipientType: 'company_admin', recipientId: report.companyId } as const)
        : null;
  if (!to) return null;
  return { id: `${report.id}_${type}`, ...to, reportId: report.id, type, productName: report.subject };
}
