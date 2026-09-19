import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/user_profile.dart';
import '../../domain/exceptions/auth_exception.dart';
import '../models/user_profile_model.dart';
import 'user_profile_remote_data_source.dart';

class FirestoreUserProfileRemoteDataSource
    implements UserProfileRemoteDataSource {
  FirestoreUserProfileRemoteDataSource({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _usersCollection = 'users';

  final FirebaseFirestore _firestore;

  @override
  Future<void> createCustomerProfile({
    required String id,
    required String fullName,
    required String email,
  }) async {
    try {
      // ignore: avoid_print
      print('[DIAG][FirestoreProfileDS] attempting set() for uid=$id');
      final profile = UserProfileModel.customer(
        id: id,
        fullName: fullName,
        email: email,
      );
      await _firestore.collection(_usersCollection).doc(id).set({
        ...profile.toFirestoreMap(),
        'createdAt': FieldValue.serverTimestamp(),
      });
      // ignore: avoid_print
      print('[DIAG][FirestoreProfileDS] set() succeeded');
    } on AuthException {
      rethrow;
    } on FirebaseException catch (error) {
      // ignore: avoid_print
      print('[DIAG][FirestoreProfileDS] FirebaseException plugin=${error.plugin} code=${error.code} message=${error.message}');
      throw AuthException(
        'Could not save your profile. Please try again.',
        code: error.code,
      );
    } catch (error, st) {
      // ignore: avoid_print
      print('[DIAG][FirestoreProfileDS] Unknown error type=${error.runtimeType} error=$error\n$st');
      throw const AuthException(
        'Could not save your profile. Please try again.',
        code: 'profile-create-failed',
      );
    }
  }

  @override
  Future<UserProfile?> fetchProfile(String userId) async {
    try {
      final doc = await _firestore
          .collection(_usersCollection)
          .doc(userId)
          .get();
      if (!doc.exists || doc.data() == null) return null;
      return UserProfileModel.fromFirestoreMap(doc.data()!, doc.id);
    } on FirebaseException catch (error) {
      // ignore: avoid_print
      print('[FirestoreProfileDS] fetchProfile code=${error.code} message=${error.message}');
      throw AuthException(
        error.code == 'permission-denied'
            ? 'Could not load your profile: access was denied by the server. Make sure the latest Firestore rules are deployed.'
            : error.code == 'unavailable'
                ? 'Could not load your profile. Check your internet connection and try again.'
                : 'Could not load your profile. Please try again.',
        code: error.code,
      );
    } catch (error, st) {
      // ignore: avoid_print
      print('[DIAG][FirestoreProfileDS] fetchProfile error=$error\n$st');
      throw const AuthException(
        'Could not load your profile. Please try again.',
        code: 'profile-fetch-failed',
      );
    }
  }

  @override
  Future<void> markPasswordChanged(String userId) async {
    try {
      // The security rules allow exactly this edit: true -> false on the
      // user's own profile, with nothing else changed.
      await _firestore.collection(_usersCollection).doc(userId).update({
        'mustChangePassword': false,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw AuthException(
        'Could not finish setting up your account. Please try again.',
        code: error.code,
      );
    }
  }

  @override
  Future<void> updateProfile({
    required String userId,
    required String fullName,
    String? phone,
    String? photoUrl,
  }) async {
    try {
      final data = <String, dynamic>{
        'fullName': fullName,
        'updatedAt': FieldValue.serverTimestamp(),
      };
      if (phone != null) {
        data['phone'] = phone;
      }
      // An empty string clears the picture.
      if (photoUrl != null) {
        data['photoUrl'] = photoUrl;
      }
      await _firestore
          .collection(_usersCollection)
          .doc(userId)
          .update(data);
    } on FirebaseException catch (error) {
      throw AuthException(
        'Could not update your profile. Please try again.',
        code: error.code,
      );
    } catch (error, st) {
      // ignore: avoid_print
      print('[DIAG][FirestoreProfileDS] updateProfile error=$error\n$st');
      throw const AuthException(
        'Could not update your profile. Please try again.',
        code: 'profile-update-failed',
      );
    }
  }
}
