import 'package:cloud_firestore/cloud_firestore.dart';

import '../../l10n/app_localizations.dart';
import '../errors/app_exception.dart';

/// The text for an error that is not specific to one feature, in the language
/// of [l10n]. Feature-specific errors (auth, stock) have their own resolver
/// next to the feature and fall back to this one.
String localizedErrorMessage(AppLocalizations l10n, Object? error) {
  return switch (error) {
    AppException() => _appException(l10n, error),
    FirebaseException() => firebaseErrorMessage(l10n, error.code),
    _ => l10n.errorGeneric,
  };
}

String firebaseErrorMessage(AppLocalizations l10n, String code) {
  switch (code) {
    case 'permission-denied':
      return l10n.errorPermissionDenied;
    case 'unavailable':
    case 'network-request-failed':
      return l10n.errorNetwork;
    default:
      return l10n.errorGeneric;
  }
}

String _appException(AppLocalizations l10n, AppException error) {
  return switch (error.code) {
    AppErrorCode.orderCreateDenied => l10n.orderCreateDenied,
    AppErrorCode.orderCreateNetwork => l10n.orderCreateNetwork,
    AppErrorCode.orderCreateFailed => l10n.orderCreateFailed,
    AppErrorCode.orderNotConfirmed => l10n.orderNotConfirmed,
    AppErrorCode.orderProductNoPrice =>
      l10n.orderProductNoPrice(error.productName ?? ''),
    AppErrorCode.orderAttachReceiptFailed => l10n.orderAttachReceiptFailed,
    AppErrorCode.orderFetchFailed => l10n.orderFetchFailed,
    AppErrorCode.orderUpdateStatusDenied => l10n.orderUpdateStatusDenied,
    AppErrorCode.orderUpdateStatusFailed => l10n.orderUpdateStatusFailed,
    AppErrorCode.orderConfirmPaymentDenied => l10n.orderConfirmPaymentDenied,
    AppErrorCode.orderConfirmPaymentFailed => l10n.orderConfirmPaymentFailed,
    AppErrorCode.orderAssignTechnicianDenied =>
      l10n.orderAssignTechnicianDenied,
    AppErrorCode.orderAssignTechnicianFailed =>
      l10n.orderAssignTechnicianFailed,
    AppErrorCode.productSaveDenied => l10n.productSaveDenied,
    AppErrorCode.productSaveFailed => l10n.productSaveFailed,
    AppErrorCode.productUpdateDenied => l10n.productUpdateDenied,
    AppErrorCode.productUpdateFailed => l10n.productUpdateFailed,
    AppErrorCode.productDeleteDenied => l10n.productDeleteDenied,
    AppErrorCode.productDeleteFailed => l10n.productDeleteFailed,
    AppErrorCode.technicianEmailInUse => l10n.technicianEmailInUse,
    AppErrorCode.technicianSaveDenied => l10n.technicianSaveDenied,
    AppErrorCode.technicianSaveFailed => l10n.technicianSaveFailed,
    AppErrorCode.technicianUpdateDenied => l10n.technicianUpdateDenied,
    AppErrorCode.technicianUpdateFailed => l10n.technicianUpdateFailed,
    AppErrorCode.technicianDeactivateDenied =>
      l10n.technicianDeactivateDenied,
    AppErrorCode.technicianDeactivateFailed =>
      l10n.technicianDeactivateFailed,
    AppErrorCode.companyUpdateDenied => l10n.companyUpdateDenied,
    AppErrorCode.companyUpdateFailed => l10n.companyUpdateFailed,
    AppErrorCode.serviceRequestCreateDenied =>
      l10n.serviceRequestCreateDenied,
    AppErrorCode.serviceRequestCreateFailed =>
      l10n.serviceRequestCreateFailed,
    AppErrorCode.serviceRequestUpdateDenied => l10n.errorPermissionDenied,
    AppErrorCode.serviceRequestUpdateFailed =>
      l10n.serviceRequestUpdateFailed,
    AppErrorCode.serviceRequestLoadFailed => l10n.serviceRequestsLoadFailed,
    AppErrorCode.chatSendDenied => l10n.chatSendDenied,
    AppErrorCode.chatSendFailed => l10n.chatSendFailed,
    AppErrorCode.chatLoadFailed => l10n.chatLoadFailed,
    AppErrorCode.chatMessageInvalid => l10n.chatMessageInvalid,
  };
}
