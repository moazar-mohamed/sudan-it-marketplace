import 'package:cloud_firestore/cloud_firestore.dart';

/// Saves the customer's chosen city on their own profile. The security rules
/// allow exactly this edit (`users/{uid}.cityId`, nothing else with it).
class CityPreferenceService {
  CityPreferenceService({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  Future<void> saveCity({required String userId, required String cityId}) {
    return _firestore.collection('users').doc(userId).update({
      'cityId': cityId,
    });
  }
}
