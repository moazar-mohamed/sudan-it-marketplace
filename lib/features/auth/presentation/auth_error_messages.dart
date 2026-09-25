import '../../../l10n/app_localizations.dart';

/// Sign-in / sign-up / profile failures, in the language of [l10n], chosen by
/// the exception `code` set by the data layer. The data layer keeps its own
/// English `message` for logs; the UI never shows it.
String authErrorMessage(AppLocalizations l10n, String? code) {
  switch (code) {
    case 'email-already-in-use':
      return l10n.authErrorEmailInUse;
    case 'invalid-email':
      return l10n.authEmailInvalid;
    case 'weak-password':
      return l10n.authErrorWeakPassword;
    case 'user-not-found':
    case 'wrong-password':
    case 'invalid-credential':
      return l10n.authErrorInvalidCredentials;
    case 'user-disabled':
      return l10n.authErrorUserDisabled;
    case 'too-many-requests':
      return l10n.authErrorTooManyRequests;
    case 'network-request-failed':
      return l10n.authErrorNetwork;
    case 'operation-not-allowed':
      return l10n.authErrorOperationNotAllowed;
    case 'canceled':
    case 'popup-closed-by-user':
    case 'web-context-canceled':
      return l10n.authErrorCancelled;
    case 'account-exists-with-different-credential':
      return l10n.authErrorDifferentCredential;
    case 'google-sign-in-failed':
      return l10n.authErrorGoogleFailed;
    case 'google-reauth-required':
      return l10n.authErrorGoogleReauth;
    case 'google-config-error':
      return l10n.authErrorGoogleConfig;
    case 'popup-blocked':
      return l10n.authErrorPopupBlocked;
    case 'unauthorized-domain':
      return l10n.authErrorUnauthorizedDomain;
    case 'profile-create-failed':
      return l10n.errorProfileSave;
    case 'profile-fetch-failed':
      return l10n.errorProfileLoad;
    case 'profile-update-failed':
      return l10n.errorProfileUpdate;
    case 'password-flag-update-failed':
      return l10n.errorSetupAccount;
    case 'profile-missing-email':
      return l10n.errorProfileNoEmail;
    case 'permission-denied':
      return l10n.errorProfileLoadDenied;
    case 'unavailable':
      return l10n.errorProfileLoadOffline;
    default:
      return l10n.authErrorGeneric;
  }
}

/// Failures of the "forgot password" e-mail request. An address with no
/// account is not an error here (the screen reports it like a success).
String passwordResetErrorMessage(AppLocalizations l10n, String? code) {
  switch (code) {
    case 'invalid-email':
      return l10n.authEmailInvalid;
    case 'too-many-requests':
      return l10n.authErrorTooManyRequests;
    case 'network-request-failed':
      return l10n.authErrorNetwork;
    default:
      return l10n.authForgotPasswordFailed;
  }
}

/// Failures of the signed-in user's own password change.
String passwordChangeErrorMessage(AppLocalizations l10n, String code) {
  switch (code) {
    case 'wrong-password':
    case 'invalid-credential':
      return l10n.passwordErrorCurrentWrong;
    case 'weak-password':
      return l10n.passwordErrorNewWeak;
    case 'requires-recent-login':
      return l10n.passwordErrorRecentLogin;
    case 'too-many-requests':
      return l10n.authErrorTooManyRequests;
    default:
      return l10n.passwordErrorGeneric;
  }
}
