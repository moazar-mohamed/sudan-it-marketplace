enum UserRole {
  customer('customer'),
  companyAdmin('company_admin'),
  technician('technician'),
  platformAdmin('platform_admin');

  const UserRole(this.firestoreValue);

  final String firestoreValue;

  static UserRole fromFirestoreValue(String value) {
    for (final role in UserRole.values) {
      if (role.firestoreValue == value) {
        return role;
      }
    }
    throw FormatException('Unknown user role: $value');
  }
}
