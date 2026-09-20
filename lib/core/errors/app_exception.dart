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
  technicianSaveDenied,
  technicianSaveFailed,
  technicianUpdateDenied,
  technicianUpdateFailed,
  technicianDeactivateDenied,
  technicianDeactivateFailed,
  companyUpdateDenied,
  companyUpdateFailed,
}

class AppException implements Exception {
  const AppException(this.code, {this.productName, this.detail});

  final AppErrorCode code;

  /// The product a message refers to, when the code names one.
  final String? productName;

  /// Technical detail for logs only; never shown to the user.
  final String? detail;

  @override
  String toString() =>
      'AppException(${code.name}${detail == null ? '' : ': $detail'})';
}
