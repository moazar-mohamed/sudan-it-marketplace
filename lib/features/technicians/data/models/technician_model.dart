import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/technician.dart';

class TechnicianModel {
  static Technician fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? {};
    final createdAt = data['createdAt'];
    return Technician(
      id: snapshot.id,
      companyId: data['companyId'] as String? ?? '',
      fullName: data['fullName'] as String? ?? '',
      phone: data['phone'] as String? ?? '',
      email: data['email'] as String?,
      isActive: data['isActive'] as bool? ?? true,
      createdAt: createdAt is Timestamp ? createdAt.toDate() : null,
    );
  }

  static Map<String, dynamic> toFirestoreFields(Technician technician) {
    return {
      'id': technician.id,
      'companyId': technician.companyId,
      'fullName': technician.fullName,
      'phone': technician.phone,
      'email': technician.email,
      'isActive': technician.isActive,
    };
  }
}
