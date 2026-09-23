import '../../../core/localization/error_messages.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/exceptions/company_service_exception.dart';

/// The text for a company-service failure in the language of [l10n]; any
/// other error falls back to the shared resolver.
String companyServiceErrorMessage(AppLocalizations l10n, Object? error) {
  if (error is! CompanyServiceException) {
    return localizedErrorMessage(l10n, error);
  }
  return switch (error.code) {
    'already-exists' => l10n.companyServiceAlreadyOffered,
    'service-not-found' || 'not-found' => l10n.companyServiceNotFound,
    final code? => firebaseErrorMessage(l10n, code),
    null => l10n.errorGeneric,
  };
}
