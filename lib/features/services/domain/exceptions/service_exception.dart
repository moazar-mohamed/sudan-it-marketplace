class ServiceException implements Exception {
  const ServiceException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => 'ServiceException(code: $code, message: $message)';
}
