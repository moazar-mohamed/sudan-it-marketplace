class CategoryException implements Exception {
  const CategoryException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => 'CategoryException(code: $code, message: $message)';
}
