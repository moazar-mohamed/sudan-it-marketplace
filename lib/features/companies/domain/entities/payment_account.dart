/// A bank / mobile-money account a company receives manual transfers on. The
/// customer sees these on the payment screen of an order for that company.
class PaymentAccount {
  const PaymentAccount({
    required this.bankName,
    required this.accountName,
    required this.accountNumber,
    this.phoneNumber = '',
  });

  /// Upper bound kept in step with `isValidPaymentAccounts` in firestore.rules.
  static const maxPerCompany = 5;

  final String bankName;
  final String accountName;
  final String accountNumber;

  /// The phone number linked to the account (optional).
  final String phoneNumber;

  PaymentAccount copyWith({
    String? bankName,
    String? accountName,
    String? accountNumber,
    String? phoneNumber,
  }) {
    return PaymentAccount(
      bankName: bankName ?? this.bankName,
      accountName: accountName ?? this.accountName,
      accountNumber: accountNumber ?? this.accountNumber,
      phoneNumber: phoneNumber ?? this.phoneNumber,
    );
  }

  Map<String, dynamic> toMap() => {
        'bankName': bankName,
        'accountName': accountName,
        'accountNumber': accountNumber,
        'phoneNumber': phoneNumber,
      };

  /// Null for anything that is not a usable account, so one bad entry never
  /// hides the rest.
  static PaymentAccount? tryFromMap(Object? value) {
    if (value is! Map) {
      return null;
    }
    String text(String key) => (value[key] as String?)?.trim() ?? '';
    final account = PaymentAccount(
      bankName: text('bankName'),
      accountName: text('accountName'),
      accountNumber: text('accountNumber'),
      phoneNumber: text('phoneNumber'),
    );
    if (account.bankName.isEmpty || account.accountNumber.isEmpty) {
      return null;
    }
    return account;
  }

  @override
  bool operator ==(Object other) =>
      other is PaymentAccount &&
      other.bankName == bankName &&
      other.accountName == accountName &&
      other.accountNumber == accountNumber &&
      other.phoneNumber == phoneNumber;

  @override
  int get hashCode =>
      Object.hash(bankName, accountName, accountNumber, phoneNumber);
}
