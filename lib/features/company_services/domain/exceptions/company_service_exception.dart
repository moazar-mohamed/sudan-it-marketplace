class CompanyServiceException implements Exception {
  const CompanyServiceException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() =>
      'CompanyServiceException(code: $code, message: $message)';
}
