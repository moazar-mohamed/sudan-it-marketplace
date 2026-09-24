/// Every user-facing failure raised by the data layer that is not covered by a
/// feature-specific exception. The data layer only says WHAT went wrong; the
/// presentation layer turns the code into text in the active language (see
/// `localizedErrorMessage`), so no English sentence lives in the data layer.
enum AppErrorCode {
  orderCreateDenied,
  orderCreateNetwork,
  orderCreateFailed,
  orderNotConfirmed,
  orderProductNoPrice,
  orderAttachReceiptFailed,
  orderFetchFailed,
  orderUpdateStatusDenied,
  orderUpdateStatusFailed,
  orderConfirmPaymentDenied,
  orderConfirmPaymentFailed,
  orderAssignTechnicianDenied,
  orderAssignTechnicianFailed,
  productSaveDenied,
  productSaveFailed,
  productUpdateDenied,
  productUpdateFailed,
  productDeleteDenied,
  productDeleteFailed,
  technicianEmailInUse,
  technicianEmailInvalid,
  technicianPasswordWeak,
  technicianNetwork,
  technicianTooManyRequests,
  technicianAuthDisabled,
  technicianSaveDenied,
  technicianSaveFailed,
  technicianUpdateDenied,
  technicianUpdateFailed,
  technicianDeactivateDenied,
  technicianDeactivateFailed,
  companyUpdateDenied,
  companyUpdateFailed,
  serviceRequestCreateDenied,
  serviceRequestCreateFailed,
  serviceRequestUpdateDenied,
  serviceRequestUpdateFailed,
  serviceRequestLoadFailed,
  chatSendDenied,
  chatSendFailed,
  chatLoadFailed,
  chatMessageInvalid,
}

class AppException implements Exception {
  const AppException(this.code, {this.productName, this.detail, this.reason});

  final AppErrorCode code;

  /// The product a message refers to, when the code names one.
  final String? productName;

  /// Technical detail for logs only; never shown to the user.
  final String? detail;

  /// A short error code (like `unavailable`) that is safe to show next to a
  /// "could not ..." message, so a support person can tell what failed.
  final String? reason;

  @override
  String toString() =>
      'AppException(${code.name}${detail == null ? '' : ': $detail'})';
}
