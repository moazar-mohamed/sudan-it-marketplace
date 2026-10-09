import '../../auth/domain/entities/user_profile.dart';
import '../../auth/domain/entities/user_role.dart';
import '../../chats/domain/entities/chat_conversation.dart';

/// The screen a push notification opens when tapped.
sealed class PushDestination {
  const PushDestination();
}

class ChatDestination extends PushDestination {
  const ChatDestination(this.chatId, this.role);

  final String chatId;
  final ChatParticipantRole role;
}

class CompanyOrderDestination extends PushDestination {
  const CompanyOrderDestination(this.companyId, this.orderId);

  final String companyId;
  final String orderId;
}

class CustomerOrderDestination extends PushDestination {
  const CustomerOrderDestination(this.orderId);

  final String orderId;
}

/// A service request, as its company ([asCompany]) or its customer sees it.
class ServiceRequestDestination extends PushDestination {
  const ServiceRequestDestination(this.requestId, {required this.asCompany});

  final String requestId;
  final bool asCompany;
}

/// The person's own reports (a push about one of them).
class ReportDestination extends PushDestination {
  const ReportDestination();
}

/// One of a company's own products (the platform hid or showed it).
class CompanyProductDestination extends PushDestination {
  const CompanyProductDestination(this.companyId, this.productId);

  final String companyId;
  final String productId;
}

/// A company that now serves the customer's city (a city announcement).
class CompanyDestination extends PushDestination {
  const CompanyDestination(this.companyId);

  final String companyId;
}

/// Where a push with [data] (as the push relay sends it) leads for the
/// signed-in [profile], or null when it has no screen for them (it was meant
/// for another kind of account, or a technician's job, which opens the app).
PushDestination? pushDestination(Map<String, dynamic> data, UserProfile profile) {
  String text(String key) => (data[key] as String?)?.trim() ?? '';

  if (text('type') == 'chat_message') {
    final chatId = text('chatId');
    if (chatId.isEmpty) return null;
    return switch ((text('role'), profile.role)) {
      ('company', UserRole.companyAdmin) =>
        ChatDestination(chatId, ChatParticipantRole.company),
      ('customer', UserRole.customer) =>
        ChatDestination(chatId, ChatParticipantRole.customer),
      _ => null,
    };
  }

  if (text('type') == 'city_announcement') {
    final companyId = text('companyId');
    if (companyId.isEmpty || profile.role != UserRole.customer) return null;
    return CompanyDestination(companyId);
  }

  if (text('reportId').isNotEmpty) {
    return switch ((text('recipientType'), profile.role)) {
      ('company_admin', UserRole.companyAdmin) => const ReportDestination(),
      ('customer', UserRole.customer) => const ReportDestination(),
      _ => null,
    };
  }

  final productId = text('productId');
  if (productId.isNotEmpty) {
    final ownCompany = profile.companyId?.trim() ?? '';
    return switch ((text('recipientType'), profile.role)) {
      ('company_admin', UserRole.companyAdmin) when ownCompany.isNotEmpty =>
        CompanyProductDestination(ownCompany, productId),
      _ => null,
    };
  }

  final serviceRequestId = text('serviceRequestId');
  if (serviceRequestId.isNotEmpty) {
    return switch ((text('recipientType'), profile.role)) {
      ('company_admin', UserRole.companyAdmin) =>
        ServiceRequestDestination(serviceRequestId, asCompany: true),
      ('customer', UserRole.customer) =>
        ServiceRequestDestination(serviceRequestId, asCompany: false),
      _ => null,
    };
  }

  final orderId = text('orderId');
  if (orderId.isEmpty) return null;
  final companyId = profile.companyId?.trim() ?? '';
  return switch ((text('recipientType'), profile.role)) {
    ('company_admin', UserRole.companyAdmin) when companyId.isNotEmpty =>
      CompanyOrderDestination(companyId, orderId),
    ('customer', UserRole.customer) => CustomerOrderDestination(orderId),
    _ => null,
  };
}
