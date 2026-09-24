import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'Sudan ICT Marketplace'**
  String get appName;

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @commonConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get commonConfirm;

  /// No description provided for @commonSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get commonSave;

  /// No description provided for @commonSaveChanges.
  ///
  /// In en, this message translates to:
  /// **'Save changes'**
  String get commonSaveChanges;

  /// No description provided for @commonEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get commonEdit;

  /// No description provided for @commonDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get commonDelete;

  /// No description provided for @commonDeactivate.
  ///
  /// In en, this message translates to:
  /// **'Deactivate'**
  String get commonDeactivate;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get commonRetry;

  /// No description provided for @commonLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get commonLoading;

  /// No description provided for @commonSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get commonSearch;

  /// No description provided for @commonClear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get commonClear;

  /// No description provided for @commonCopy.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get commonCopy;

  /// No description provided for @commonQuantityIncrease.
  ///
  /// In en, this message translates to:
  /// **'Increase quantity'**
  String get commonQuantityIncrease;

  /// No description provided for @commonQuantityDecrease.
  ///
  /// In en, this message translates to:
  /// **'Decrease quantity'**
  String get commonQuantityDecrease;

  /// No description provided for @commonDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get commonDone;

  /// No description provided for @commonOr.
  ///
  /// In en, this message translates to:
  /// **'OR'**
  String get commonOr;

  /// No description provided for @commonOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get commonOptional;

  /// No description provided for @commonRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get commonRemove;

  /// No description provided for @commonSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get commonSignOut;

  /// No description provided for @commonNotifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get commonNotifications;

  /// No description provided for @commonShowPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get commonShowPassword;

  /// No description provided for @commonHidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get commonHidePassword;

  /// No description provided for @commonLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get commonLanguage;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @settingsLanguageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose the language of the app'**
  String get settingsLanguageSubtitle;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageArabic.
  ///
  /// In en, this message translates to:
  /// **'العربية'**
  String get languageArabic;

  /// No description provided for @settingsLanguageSyncFailed.
  ///
  /// In en, this message translates to:
  /// **'The language was changed on this device, but could not be saved to your account yet.'**
  String get settingsLanguageSyncFailed;

  /// No description provided for @authWelcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back. Sign in to continue.'**
  String get authWelcomeBack;

  /// No description provided for @authEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authEmail;

  /// No description provided for @authPassword.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authPassword;

  /// No description provided for @authLogin.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get authLogin;

  /// No description provided for @authRegister.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get authRegister;

  /// No description provided for @authForgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get authForgotPassword;

  /// No description provided for @authForgotPasswordSoon.
  ///
  /// In en, this message translates to:
  /// **'Forgot password will be available soon.'**
  String get authForgotPasswordSoon;

  /// No description provided for @authContinueWithGoogle.
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get authContinueWithGoogle;

  /// No description provided for @authNoAccount.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account?'**
  String get authNoAccount;

  /// No description provided for @authHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get authHaveAccount;

  /// No description provided for @authCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get authCreateAccount;

  /// No description provided for @authJoinTitle.
  ///
  /// In en, this message translates to:
  /// **'Join Sudan ICT Marketplace'**
  String get authJoinTitle;

  /// No description provided for @authCreateAccountSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Create an account to get started.'**
  String get authCreateAccountSubtitle;

  /// No description provided for @authFullName.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get authFullName;

  /// No description provided for @authConfirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get authConfirmPassword;

  /// No description provided for @authPasswordHelper.
  ///
  /// In en, this message translates to:
  /// **'At least 6 characters.'**
  String get authPasswordHelper;

  /// No description provided for @authEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Email is required.'**
  String get authEmailRequired;

  /// No description provided for @authEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address.'**
  String get authEmailInvalid;

  /// No description provided for @authPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Password is required.'**
  String get authPasswordRequired;

  /// No description provided for @authFullNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Full name is required.'**
  String get authFullNameRequired;

  /// No description provided for @authFullNameInvalid.
  ///
  /// In en, this message translates to:
  /// **'Full name may only contain letters and spaces.'**
  String get authFullNameInvalid;

  /// No description provided for @authPasswordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 6 characters.'**
  String get authPasswordTooShort;

  /// No description provided for @authConfirmPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Confirm password is required.'**
  String get authConfirmPasswordRequired;

  /// No description provided for @authPasswordsMismatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get authPasswordsMismatch;

  /// No description provided for @authAccountDeactivatedTitle.
  ///
  /// In en, this message translates to:
  /// **'Account deactivated'**
  String get authAccountDeactivatedTitle;

  /// No description provided for @authAccountDeactivatedMessage.
  ///
  /// In en, this message translates to:
  /// **'Your account has been deactivated. Please contact support to have it reactivated.'**
  String get authAccountDeactivatedMessage;

  /// No description provided for @authCompanyNotLinkedTitle.
  ///
  /// In en, this message translates to:
  /// **'Company not linked'**
  String get authCompanyNotLinkedTitle;

  /// No description provided for @authCompanyAdminNotLinked.
  ///
  /// In en, this message translates to:
  /// **'Your company admin account is not linked to a company yet. Please contact the platform administrator.'**
  String get authCompanyAdminNotLinked;

  /// No description provided for @authTechnicianNotLinked.
  ///
  /// In en, this message translates to:
  /// **'Your technician account is not linked to a company yet. Please contact your company administrator.'**
  String get authTechnicianNotLinked;

  /// No description provided for @authPlatformAdminTitle.
  ///
  /// In en, this message translates to:
  /// **'Platform Admin'**
  String get authPlatformAdminTitle;

  /// No description provided for @authPlatformAdminMessage.
  ///
  /// In en, this message translates to:
  /// **'Platform administration is managed separately and is not available in this app.'**
  String get authPlatformAdminMessage;

  /// No description provided for @authTechnicianAccountTitle.
  ///
  /// In en, this message translates to:
  /// **'Technician account'**
  String get authTechnicianAccountTitle;

  /// No description provided for @authTechnicianNotSetUp.
  ///
  /// In en, this message translates to:
  /// **'Your technician account is not yet set up. Please contact your company administrator.'**
  String get authTechnicianNotSetUp;

  /// No description provided for @authTechnicianDeactivated.
  ///
  /// In en, this message translates to:
  /// **'Your technician account has been deactivated. Please contact your company administrator.'**
  String get authTechnicianDeactivated;

  /// No description provided for @authTechnicianLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your technician record. Please try again or contact your company administrator.'**
  String get authTechnicianLoadFailed;

  /// No description provided for @authVerifyEmailTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify your email'**
  String get authVerifyEmailTitle;

  /// No description provided for @authVerifyEmailGeneric.
  ///
  /// In en, this message translates to:
  /// **'Please verify your email address before continuing.'**
  String get authVerifyEmailGeneric;

  /// No description provided for @authVerifyEmailSent.
  ///
  /// In en, this message translates to:
  /// **'We sent a verification link to {email}. Please verify your email before continuing.'**
  String authVerifyEmailSent(String email);

  /// No description provided for @authVerifyEmailResent.
  ///
  /// In en, this message translates to:
  /// **'Verification email sent. Please check your inbox.'**
  String get authVerifyEmailResent;

  /// No description provided for @authVerifyEmailStillNot.
  ///
  /// In en, this message translates to:
  /// **'Still not verified. Please tap the link in the email, then try again.'**
  String get authVerifyEmailStillNot;

  /// No description provided for @authVerifiedMyEmail.
  ///
  /// In en, this message translates to:
  /// **'I\'ve verified my email'**
  String get authVerifiedMyEmail;

  /// No description provided for @authResendVerification.
  ///
  /// In en, this message translates to:
  /// **'Resend verification email'**
  String get authResendVerification;

  /// No description provided for @authSignedInTitle.
  ///
  /// In en, this message translates to:
  /// **'You are signed in'**
  String get authSignedInTitle;

  /// No description provided for @authDashboardLater.
  ///
  /// In en, this message translates to:
  /// **'Customer dashboard will be added later.'**
  String get authDashboardLater;

  /// No description provided for @authErrorEmailInUse.
  ///
  /// In en, this message translates to:
  /// **'This email is already registered.'**
  String get authErrorEmailInUse;

  /// No description provided for @authErrorWeakPassword.
  ///
  /// In en, this message translates to:
  /// **'Choose a stronger password.'**
  String get authErrorWeakPassword;

  /// No description provided for @authErrorInvalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid email or password.'**
  String get authErrorInvalidCredentials;

  /// No description provided for @authErrorUserDisabled.
  ///
  /// In en, this message translates to:
  /// **'This account has been disabled.'**
  String get authErrorUserDisabled;

  /// No description provided for @authErrorTooManyRequests.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait and try again.'**
  String get authErrorTooManyRequests;

  /// No description provided for @authErrorNetwork.
  ///
  /// In en, this message translates to:
  /// **'Network error. Check your connection and try again.'**
  String get authErrorNetwork;

  /// No description provided for @authErrorOperationNotAllowed.
  ///
  /// In en, this message translates to:
  /// **'Email and password sign-in is not enabled.'**
  String get authErrorOperationNotAllowed;

  /// No description provided for @authErrorCancelled.
  ///
  /// In en, this message translates to:
  /// **'Sign-in was cancelled.'**
  String get authErrorCancelled;

  /// No description provided for @authErrorDifferentCredential.
  ///
  /// In en, this message translates to:
  /// **'An account already exists with a different sign-in method for this email.'**
  String get authErrorDifferentCredential;

  /// No description provided for @authErrorGoogleFailed.
  ///
  /// In en, this message translates to:
  /// **'Google sign-in failed. Please try again.'**
  String get authErrorGoogleFailed;

  /// No description provided for @authErrorGoogleReauth.
  ///
  /// In en, this message translates to:
  /// **'Google needs you to sign in to your account again on this device. Remove your Google account in the device settings, add it again, then try again.'**
  String get authErrorGoogleReauth;

  /// No description provided for @authErrorGoogleConfig.
  ///
  /// In en, this message translates to:
  /// **'Google sign-in is not set up for this version of the app. Please contact support.'**
  String get authErrorGoogleConfig;

  /// No description provided for @authErrorPopupBlocked.
  ///
  /// In en, this message translates to:
  /// **'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'**
  String get authErrorPopupBlocked;

  /// No description provided for @authErrorUnauthorizedDomain.
  ///
  /// In en, this message translates to:
  /// **'Google sign-in is not enabled for this website address.'**
  String get authErrorUnauthorizedDomain;

  /// No description provided for @authErrorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Authentication failed. Please try again.'**
  String get authErrorGeneric;

  /// No description provided for @authErrorSendVerification.
  ///
  /// In en, this message translates to:
  /// **'Could not send the verification email. Please try again.'**
  String get authErrorSendVerification;

  /// No description provided for @authErrorNotAuthenticated.
  ///
  /// In en, this message translates to:
  /// **'Not authenticated.'**
  String get authErrorNotAuthenticated;

  /// No description provided for @errorProfileSave.
  ///
  /// In en, this message translates to:
  /// **'Could not save your profile. Please try again.'**
  String get errorProfileSave;

  /// No description provided for @errorProfileLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load your profile. Please try again.'**
  String get errorProfileLoad;

  /// No description provided for @errorProfileLoadDenied.
  ///
  /// In en, this message translates to:
  /// **'Could not load your profile: access was denied. Please try again later or contact support.'**
  String get errorProfileLoadDenied;

  /// No description provided for @errorProfileLoadOffline.
  ///
  /// In en, this message translates to:
  /// **'Could not load your profile. Check your internet connection and try again.'**
  String get errorProfileLoadOffline;

  /// No description provided for @errorProfileUpdate.
  ///
  /// In en, this message translates to:
  /// **'Could not update your profile. Please try again.'**
  String get errorProfileUpdate;

  /// No description provided for @errorProfileNoEmail.
  ///
  /// In en, this message translates to:
  /// **'Your account has no email on file, so a profile could not be created. Please contact support.'**
  String get errorProfileNoEmail;

  /// No description provided for @errorProfileNotFound.
  ///
  /// In en, this message translates to:
  /// **'Your profile could not be found.'**
  String get errorProfileNotFound;

  /// No description provided for @errorSetupAccount.
  ///
  /// In en, this message translates to:
  /// **'Could not finish setting up your account. Please try again.'**
  String get errorSetupAccount;

  /// No description provided for @errorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// No description provided for @errorPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to do this.'**
  String get errorPermissionDenied;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'Check your internet connection and try again.'**
  String get errorNetwork;

  /// No description provided for @passwordChangeTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a new password'**
  String get passwordChangeTitle;

  /// No description provided for @passwordChangeIntro.
  ///
  /// In en, this message translates to:
  /// **'You signed in with a temporary password. Choose your own password to continue.'**
  String get passwordChangeIntro;

  /// No description provided for @passwordChangeTemporary.
  ///
  /// In en, this message translates to:
  /// **'Temporary password'**
  String get passwordChangeTemporary;

  /// No description provided for @passwordChangeNew.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get passwordChangeNew;

  /// No description provided for @passwordChangeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm new password'**
  String get passwordChangeConfirm;

  /// No description provided for @passwordChangeSubmit.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get passwordChangeSubmit;

  /// No description provided for @passwordChangeCurrentRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your temporary password.'**
  String get passwordChangeCurrentRequired;

  /// No description provided for @passwordChangeNewRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a new password.'**
  String get passwordChangeNewRequired;

  /// No description provided for @passwordChangeTooShort.
  ///
  /// In en, this message translates to:
  /// **'The password must be at least {min} characters.'**
  String passwordChangeTooShort(int min);

  /// No description provided for @passwordChangeMismatch.
  ///
  /// In en, this message translates to:
  /// **'The passwords do not match.'**
  String get passwordChangeMismatch;

  /// No description provided for @passwordErrorCurrentWrong.
  ///
  /// In en, this message translates to:
  /// **'Current password is incorrect.'**
  String get passwordErrorCurrentWrong;

  /// No description provided for @passwordErrorNewWeak.
  ///
  /// In en, this message translates to:
  /// **'New password is too weak. Use at least 6 characters.'**
  String get passwordErrorNewWeak;

  /// No description provided for @passwordErrorRecentLogin.
  ///
  /// In en, this message translates to:
  /// **'Please sign out and sign back in before changing your password.'**
  String get passwordErrorRecentLogin;

  /// No description provided for @passwordErrorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Could not change password. Please try again.'**
  String get passwordErrorGeneric;

  /// No description provided for @imageLabel.
  ///
  /// In en, this message translates to:
  /// **'Image'**
  String get imageLabel;

  /// No description provided for @imageAdd.
  ///
  /// In en, this message translates to:
  /// **'Add Image'**
  String get imageAdd;

  /// No description provided for @imageChange.
  ///
  /// In en, this message translates to:
  /// **'Change Image'**
  String get imageChange;

  /// No description provided for @imageChooseFromDevice.
  ///
  /// In en, this message translates to:
  /// **'Choose from device'**
  String get imageChooseFromDevice;

  /// No description provided for @imageTakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take a photo'**
  String get imageTakePhoto;

  /// No description provided for @imageUseUrl.
  ///
  /// In en, this message translates to:
  /// **'Use image URL'**
  String get imageUseUrl;

  /// No description provided for @imageUrl.
  ///
  /// In en, this message translates to:
  /// **'Image URL'**
  String get imageUrl;

  /// No description provided for @imageUploading.
  ///
  /// In en, this message translates to:
  /// **'Uploading image'**
  String get imageUploading;

  /// No description provided for @imageUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to upload image'**
  String get imageUploadFailed;

  /// No description provided for @imageEmptyUrl.
  ///
  /// In en, this message translates to:
  /// **'Enter the image URL.'**
  String get imageEmptyUrl;

  /// No description provided for @imageInvalidUrl.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid image link (http/https).'**
  String get imageInvalidUrl;

  /// No description provided for @imageUnsupported.
  ///
  /// In en, this message translates to:
  /// **'Unsupported image. Use a JPG, PNG, WebP or GIF file.'**
  String get imageUnsupported;

  /// No description provided for @imageTooLarge.
  ///
  /// In en, this message translates to:
  /// **'This image is too large. The maximum size is 5 MB.'**
  String get imageTooLarge;

  /// No description provided for @imageCameraDenied.
  ///
  /// In en, this message translates to:
  /// **'Camera permission was denied. Allow camera access in settings to take a photo.'**
  String get imageCameraDenied;

  /// No description provided for @imageGalleryDenied.
  ///
  /// In en, this message translates to:
  /// **'Photo access was denied. Allow photo access in settings to choose an image.'**
  String get imageGalleryDenied;

  /// No description provided for @imageCameraUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The camera is not available on this device.'**
  String get imageCameraUnavailable;

  /// No description provided for @imagePickFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not open the image. Please try again.'**
  String get imagePickFailed;

  /// No description provided for @locationTitle.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get locationTitle;

  /// No description provided for @locationEnterAddress.
  ///
  /// In en, this message translates to:
  /// **'Enter address'**
  String get locationEnterAddress;

  /// No description provided for @locationSelectOnMap.
  ///
  /// In en, this message translates to:
  /// **'Select on Map'**
  String get locationSelectOnMap;

  /// No description provided for @locationUseCurrent.
  ///
  /// In en, this message translates to:
  /// **'Use My Current Location'**
  String get locationUseCurrent;

  /// No description provided for @locationConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm Location'**
  String get locationConfirm;

  /// No description provided for @locationChange.
  ///
  /// In en, this message translates to:
  /// **'Change Location'**
  String get locationChange;

  /// No description provided for @locationRemoveMap.
  ///
  /// In en, this message translates to:
  /// **'Remove map location'**
  String get locationRemoveMap;

  /// No description provided for @locationViewOnMap.
  ///
  /// In en, this message translates to:
  /// **'View on Map'**
  String get locationViewOnMap;

  /// No description provided for @locationOpenOrder.
  ///
  /// In en, this message translates to:
  /// **'Open Order Location'**
  String get locationOpenOrder;

  /// No description provided for @locationOpenCompany.
  ///
  /// In en, this message translates to:
  /// **'Open Company Location'**
  String get locationOpenCompany;

  /// No description provided for @locationViewCompany.
  ///
  /// In en, this message translates to:
  /// **'View Company Location'**
  String get locationViewCompany;

  /// No description provided for @locationOpenDelivery.
  ///
  /// In en, this message translates to:
  /// **'Open Delivery Location'**
  String get locationOpenDelivery;

  /// No description provided for @locationSearchAddress.
  ///
  /// In en, this message translates to:
  /// **'Search Address on Map'**
  String get locationSearchAddress;

  /// No description provided for @locationOpenInMaps.
  ///
  /// In en, this message translates to:
  /// **'Open in Maps app'**
  String get locationOpenInMaps;

  /// No description provided for @locationSelected.
  ///
  /// In en, this message translates to:
  /// **'Location selected'**
  String get locationSelected;

  /// No description provided for @locationLatShort.
  ///
  /// In en, this message translates to:
  /// **'Lat'**
  String get locationLatShort;

  /// No description provided for @locationLngShort.
  ///
  /// In en, this message translates to:
  /// **'Lng'**
  String get locationLngShort;

  /// No description provided for @locationTapToSelect.
  ///
  /// In en, this message translates to:
  /// **'Tap the map to choose the exact point. Tap again to move it.'**
  String get locationTapToSelect;

  /// No description provided for @locationPinned.
  ///
  /// In en, this message translates to:
  /// **'Pinned on map'**
  String get locationPinned;

  /// No description provided for @locationAddressApproximate.
  ///
  /// In en, this message translates to:
  /// **'Written address only (no exact map point)'**
  String get locationAddressApproximate;

  /// No description provided for @locationRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter an address or select a location on the map.'**
  String get locationRequired;

  /// No description provided for @locationCouldNotOpenMaps.
  ///
  /// In en, this message translates to:
  /// **'Could not open the maps app.'**
  String get locationCouldNotOpenMaps;

  /// No description provided for @locationServiceOff.
  ///
  /// In en, this message translates to:
  /// **'Location services are turned off. You can still tap the map.'**
  String get locationServiceOff;

  /// No description provided for @locationPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Location permission was denied. You can still tap the map or type an address.'**
  String get locationPermissionDenied;

  /// No description provided for @locationPermissionDeniedForever.
  ///
  /// In en, this message translates to:
  /// **'Location permission is blocked in settings. You can still tap the map.'**
  String get locationPermissionDeniedForever;

  /// No description provided for @locationCurrentUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Could not get your current location. You can still tap the map.'**
  String get locationCurrentUnavailable;

  /// No description provided for @productPriceOnRequest.
  ///
  /// In en, this message translates to:
  /// **'Price on request'**
  String get productPriceOnRequest;

  /// No description provided for @orderCreateDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to place this order. Please sign in again and try again.'**
  String get orderCreateDenied;

  /// No description provided for @orderCreateNetwork.
  ///
  /// In en, this message translates to:
  /// **'The order could not be confirmed. Check your internet connection and try again.'**
  String get orderCreateNetwork;

  /// No description provided for @orderCreateFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to create the order. Please try again.'**
  String get orderCreateFailed;

  /// No description provided for @orderNotConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Your order could not be confirmed. Check your connection and try again.'**
  String get orderNotConfirmed;

  /// No description provided for @orderProductNoPrice.
  ///
  /// In en, this message translates to:
  /// **'{productName} has no listed price yet. Please contact the company to order it.'**
  String orderProductNoPrice(String productName);

  /// No description provided for @orderAttachReceiptFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not attach the receipt. Please try again.'**
  String get orderAttachReceiptFailed;

  /// No description provided for @orderFetchFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load the order. Please try again.'**
  String get orderFetchFailed;

  /// No description provided for @orderUpdateStatusDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to update the status of this order.'**
  String get orderUpdateStatusDenied;

  /// No description provided for @orderUpdateStatusFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not update the order status. Please try again.'**
  String get orderUpdateStatusFailed;

  /// No description provided for @orderConfirmPaymentDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to confirm the payment for this order.'**
  String get orderConfirmPaymentDenied;

  /// No description provided for @orderConfirmPaymentFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not confirm the payment. Please try again.'**
  String get orderConfirmPaymentFailed;

  /// No description provided for @orderAssignTechnicianDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to assign a technician to this order.'**
  String get orderAssignTechnicianDenied;

  /// No description provided for @orderAssignTechnicianFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not assign the technician. Please try again.'**
  String get orderAssignTechnicianFailed;

  /// No description provided for @stockNoLongerAvailable.
  ///
  /// In en, this message translates to:
  /// **'This product is no longer available.'**
  String get stockNoLongerAvailable;

  /// No description provided for @stockChooseAtLeastOne.
  ///
  /// In en, this message translates to:
  /// **'Choose at least one unit to order.'**
  String get stockChooseAtLeastOne;

  /// No description provided for @stockOutOfStock.
  ///
  /// In en, this message translates to:
  /// **'{productName} is out of stock.'**
  String stockOutOfStock(String productName);

  /// No description provided for @stockOnlyLeft.
  ///
  /// In en, this message translates to:
  /// **'Only {available} of {productName} left in stock. Please reduce the quantity.'**
  String stockOnlyLeft(int available, String productName);

  /// No description provided for @productSaveDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to save this product.'**
  String get productSaveDenied;

  /// No description provided for @productSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not save the product. Please try again.'**
  String get productSaveFailed;

  /// No description provided for @productUpdateDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to update this product.'**
  String get productUpdateDenied;

  /// No description provided for @productUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not update the product. Please try again.'**
  String get productUpdateFailed;

  /// No description provided for @productDeleteDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to delete this product.'**
  String get productDeleteDenied;

  /// No description provided for @productDeleteFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not delete the product. Please try again.'**
  String get productDeleteFailed;

  /// No description provided for @technicianSaveDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to save this technician.'**
  String get technicianSaveDenied;

  /// No description provided for @technicianSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not save the technician. Please try again.'**
  String get technicianSaveFailed;

  /// No description provided for @technicianUpdateDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to update this technician.'**
  String get technicianUpdateDenied;

  /// No description provided for @technicianUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not update the technician. Please try again.'**
  String get technicianUpdateFailed;

  /// No description provided for @technicianDeactivateDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to deactivate this technician.'**
  String get technicianDeactivateDenied;

  /// No description provided for @technicianDeactivateFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not deactivate the technician. Please try again.'**
  String get technicianDeactivateFailed;

  /// No description provided for @companyUpdateDenied.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to edit this company.'**
  String get companyUpdateDenied;

  /// No description provided for @companyUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not update the company profile. Please try again.'**
  String get companyUpdateFailed;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navDashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get navDashboard;

  /// No description provided for @navProducts.
  ///
  /// In en, this message translates to:
  /// **'Products'**
  String get navProducts;

  /// No description provided for @navCompanies.
  ///
  /// In en, this message translates to:
  /// **'Companies'**
  String get navCompanies;

  /// No description provided for @navOrders.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get navOrders;

  /// No description provided for @navProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// No description provided for @navMyOrders.
  ///
  /// In en, this message translates to:
  /// **'My Orders'**
  String get navMyOrders;

  /// No description provided for @reviewsCount.
  ///
  /// In en, this message translates to:
  /// **'({count, plural, =0{no reviews} =1{1 review} other{{count} reviews}})'**
  String reviewsCount(int count);

  /// No description provided for @commonPhoneInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid phone number.'**
  String get commonPhoneInvalid;

  /// No description provided for @commonViewOrderStatus.
  ///
  /// In en, this message translates to:
  /// **'View Order Status'**
  String get commonViewOrderStatus;

  /// No description provided for @homeSearchProducts.
  ///
  /// In en, this message translates to:
  /// **'Search products...'**
  String get homeSearchProducts;

  /// No description provided for @homeSearchCompanies.
  ///
  /// In en, this message translates to:
  /// **'Search companies...'**
  String get homeSearchCompanies;

  /// No description provided for @homeNoProducts.
  ///
  /// In en, this message translates to:
  /// **'No products found'**
  String get homeNoProducts;

  /// No description provided for @homeNoCompanies.
  ///
  /// In en, this message translates to:
  /// **'No companies found'**
  String get homeNoCompanies;

  /// No description provided for @productInStockCount.
  ///
  /// In en, this message translates to:
  /// **'In Stock ({count})'**
  String productInStockCount(int count);

  /// No description provided for @productOutOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of Stock'**
  String get productOutOfStock;

  /// No description provided for @productVerifiedSeller.
  ///
  /// In en, this message translates to:
  /// **'Verified Seller'**
  String get productVerifiedSeller;

  /// No description provided for @productInstallationAvailable.
  ///
  /// In en, this message translates to:
  /// **'Professional Installation Available'**
  String get productInstallationAvailable;

  /// No description provided for @productInstallationNote.
  ///
  /// In en, this message translates to:
  /// **'Installation price: {price} {currency}. On-site setup option is selected during checkout.'**
  String productInstallationNote(String price, String currency);

  /// No description provided for @productDescription.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get productDescription;

  /// No description provided for @productSpecifications.
  ///
  /// In en, this message translates to:
  /// **'Specifications'**
  String get productSpecifications;

  /// No description provided for @productBuyNow.
  ///
  /// In en, this message translates to:
  /// **'Buy Now'**
  String get productBuyNow;

  /// No description provided for @productBuyNowPrice.
  ///
  /// In en, this message translates to:
  /// **'Buy Now • {price} {currency}'**
  String productBuyNowPrice(String price, String currency);

  /// No description provided for @companyAbout.
  ///
  /// In en, this message translates to:
  /// **'About Company'**
  String get companyAbout;

  /// No description provided for @companyProductsCount.
  ///
  /// In en, this message translates to:
  /// **'Products ({count})'**
  String companyProductsCount(int count);

  /// No description provided for @companyNoProducts.
  ///
  /// In en, this message translates to:
  /// **'No products listed by this company yet.'**
  String get companyNoProducts;

  /// No description provided for @checkoutTitle.
  ///
  /// In en, this message translates to:
  /// **'Checkout'**
  String get checkoutTitle;

  /// No description provided for @checkoutUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit: {price} {currency}'**
  String checkoutUnit(String price, String currency);

  /// No description provided for @checkoutQty.
  ///
  /// In en, this message translates to:
  /// **'Qty: {count}'**
  String checkoutQty(int count);

  /// No description provided for @checkoutSubtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal: {price} {currency}'**
  String checkoutSubtotal(String price, String currency);

  /// No description provided for @checkoutDeliveryContact.
  ///
  /// In en, this message translates to:
  /// **'Delivery & Contact'**
  String get checkoutDeliveryContact;

  /// No description provided for @checkoutPickupContact.
  ///
  /// In en, this message translates to:
  /// **'Pickup & Contact'**
  String get checkoutPickupContact;

  /// No description provided for @checkoutDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get checkoutDelivery;

  /// No description provided for @checkoutPickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get checkoutPickup;

  /// No description provided for @checkoutPickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Pickup Location'**
  String get checkoutPickupLocation;

  /// No description provided for @checkoutPickupFallback.
  ///
  /// In en, this message translates to:
  /// **'Company pickup location (the company will confirm by phone)'**
  String get checkoutPickupFallback;

  /// No description provided for @checkoutAddressHint.
  ///
  /// In en, this message translates to:
  /// **'Street name, building/house, neighborhood, city'**
  String get checkoutAddressHint;

  /// No description provided for @checkoutContactPhone.
  ///
  /// In en, this message translates to:
  /// **'Contact Phone Number'**
  String get checkoutContactPhone;

  /// No description provided for @checkoutContactPhoneHelper.
  ///
  /// In en, this message translates to:
  /// **'The company will call this number to coordinate delivery'**
  String get checkoutContactPhoneHelper;

  /// No description provided for @checkoutPhoneRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter a contact phone number'**
  String get checkoutPhoneRequired;

  /// No description provided for @checkoutInstallationOption.
  ///
  /// In en, this message translates to:
  /// **'Installation Option'**
  String get checkoutInstallationOption;

  /// No description provided for @checkoutInstallationTitle.
  ///
  /// In en, this message translates to:
  /// **'On-site Professional Installation'**
  String get checkoutInstallationTitle;

  /// No description provided for @checkoutInstallationNote.
  ///
  /// In en, this message translates to:
  /// **'Certified technician setup available for {price} {currency}.'**
  String checkoutInstallationNote(String price, String currency);

  /// No description provided for @checkoutProductOnly.
  ///
  /// In en, this message translates to:
  /// **'Product Only'**
  String get checkoutProductOnly;

  /// No description provided for @checkoutProductInstallation.
  ///
  /// In en, this message translates to:
  /// **'Product + Installation'**
  String get checkoutProductInstallation;

  /// No description provided for @checkoutPriceSummary.
  ///
  /// In en, this message translates to:
  /// **'Price Summary'**
  String get checkoutPriceSummary;

  /// No description provided for @checkoutProductSubtotal.
  ///
  /// In en, this message translates to:
  /// **'Product Subtotal ({count} items)'**
  String checkoutProductSubtotal(int count);

  /// No description provided for @checkoutInstallationService.
  ///
  /// In en, this message translates to:
  /// **'Installation Service'**
  String get checkoutInstallationService;

  /// No description provided for @checkoutNotIncluded.
  ///
  /// In en, this message translates to:
  /// **'Not included'**
  String get checkoutNotIncluded;

  /// No description provided for @checkoutDeliveryFee.
  ///
  /// In en, this message translates to:
  /// **'Delivery Fee'**
  String get checkoutDeliveryFee;

  /// No description provided for @checkoutFinalTotal.
  ///
  /// In en, this message translates to:
  /// **'Final Total'**
  String get checkoutFinalTotal;

  /// No description provided for @checkoutConfirmOrder.
  ///
  /// In en, this message translates to:
  /// **'Confirm Order • {price} {currency}'**
  String checkoutConfirmOrder(String price, String currency);

  /// No description provided for @paymentTitle.
  ///
  /// In en, this message translates to:
  /// **'Manual Payment'**
  String get paymentTitle;

  /// No description provided for @paymentCopied.
  ///
  /// In en, this message translates to:
  /// **'{label} copied to clipboard'**
  String paymentCopied(String label);

  /// No description provided for @paymentAccountNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Account number'**
  String get paymentAccountNumberLabel;

  /// No description provided for @paymentPhoneNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get paymentPhoneNumberLabel;

  /// No description provided for @paymentReceiptRequired.
  ///
  /// In en, this message translates to:
  /// **'Please upload or select a transfer receipt image before submitting.'**
  String get paymentReceiptRequired;

  /// No description provided for @paymentSubmitFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not submit your receipt. Please try again.'**
  String get paymentSubmitFailed;

  /// No description provided for @paymentAmountToTransfer.
  ///
  /// In en, this message translates to:
  /// **'Amount to Transfer'**
  String get paymentAmountToTransfer;

  /// No description provided for @paymentOrderCreatedAfter.
  ///
  /// In en, this message translates to:
  /// **'Your order will be created after receipt submission.'**
  String get paymentOrderCreatedAfter;

  /// No description provided for @paymentInstructions.
  ///
  /// In en, this message translates to:
  /// **'Please transfer the exact amount externally using your mobile banking app (Bankak, Fawry, etc.) or cash transfer. After completing the payment, upload a screenshot of your transfer receipt below.'**
  String get paymentInstructions;

  /// No description provided for @paymentAccounts.
  ///
  /// In en, this message translates to:
  /// **'Payment Accounts'**
  String get paymentAccounts;

  /// No description provided for @paymentUploadReceipt.
  ///
  /// In en, this message translates to:
  /// **'Upload Transfer Receipt'**
  String get paymentUploadReceipt;

  /// No description provided for @paymentUploadHint.
  ///
  /// In en, this message translates to:
  /// **'Upload a clear screenshot or photo of your transfer notification slip.'**
  String get paymentUploadHint;

  /// No description provided for @paymentTapToUpload.
  ///
  /// In en, this message translates to:
  /// **'Tap to Upload Receipt / Screenshot'**
  String get paymentTapToUpload;

  /// No description provided for @paymentSupports.
  ///
  /// In en, this message translates to:
  /// **'Supports JPG, PNG, or screenshot from Bankak/Fawry'**
  String get paymentSupports;

  /// No description provided for @paymentReceiptSelected.
  ///
  /// In en, this message translates to:
  /// **'Receipt Selected'**
  String get paymentReceiptSelected;

  /// No description provided for @paymentSlipPreview.
  ///
  /// In en, this message translates to:
  /// **'TRANSFER SLIP PREVIEW'**
  String get paymentSlipPreview;

  /// No description provided for @paymentSlipCompleted.
  ///
  /// In en, this message translates to:
  /// **'COMPLETED'**
  String get paymentSlipCompleted;

  /// No description provided for @paymentSlipAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount: {amount} SDG'**
  String paymentSlipAmount(String amount);

  /// No description provided for @paymentSlipBeneficiary.
  ///
  /// In en, this message translates to:
  /// **'Beneficiary: {name}'**
  String paymentSlipBeneficiary(String name);

  /// No description provided for @paymentSlipRef.
  ///
  /// In en, this message translates to:
  /// **'Ref: {ref}'**
  String paymentSlipRef(String ref);

  /// No description provided for @paymentReplace.
  ///
  /// In en, this message translates to:
  /// **'Replace'**
  String get paymentReplace;

  /// No description provided for @paymentPendingNote.
  ///
  /// In en, this message translates to:
  /// **'Submitting this receipt saves the transfer reference as \"Pending Verification\". Payment will be marked Confirmed after the company verifies it.'**
  String get paymentPendingNote;

  /// No description provided for @paymentSubmitting.
  ///
  /// In en, this message translates to:
  /// **'Submitting...'**
  String get paymentSubmitting;

  /// No description provided for @paymentSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit Receipt for Verification'**
  String get paymentSubmit;

  /// No description provided for @paymentAccountName.
  ///
  /// In en, this message translates to:
  /// **'Account Name'**
  String get paymentAccountName;

  /// No description provided for @paymentAccountMban.
  ///
  /// In en, this message translates to:
  /// **'Account / MBAN'**
  String get paymentAccountMban;

  /// No description provided for @paymentPhoneIdentifier.
  ///
  /// In en, this message translates to:
  /// **'Phone Identifier'**
  String get paymentPhoneIdentifier;

  /// No description provided for @ordersLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load orders'**
  String get ordersLoadFailed;

  /// No description provided for @ordersRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get ordersRetry;

  /// No description provided for @ordersEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No Orders Yet'**
  String get ordersEmptyTitle;

  /// No description provided for @ordersEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'When you purchase IT hardware or products from the marketplace, your orders and their live status will be tracked here.'**
  String get ordersEmptyBody;

  /// No description provided for @orderTitleNumber.
  ///
  /// In en, this message translates to:
  /// **'Order #{id}'**
  String orderTitleNumber(String id);

  /// No description provided for @orderTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total Amount'**
  String get orderTotalAmount;

  /// No description provided for @orderDetailsButton.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get orderDetailsButton;

  /// No description provided for @orderItemOrdered.
  ///
  /// In en, this message translates to:
  /// **'Item Ordered'**
  String get orderItemOrdered;

  /// No description provided for @orderUnitLine.
  ///
  /// In en, this message translates to:
  /// **'Unit: {price} SDG'**
  String orderUnitLine(String price);

  /// No description provided for @orderQtyLine.
  ///
  /// In en, this message translates to:
  /// **'Qty: {count}'**
  String orderQtyLine(int count);

  /// No description provided for @orderSubtotalLine.
  ///
  /// In en, this message translates to:
  /// **'Subtotal: {price} SDG'**
  String orderSubtotalLine(String price);

  /// No description provided for @orderPickupDetails.
  ///
  /// In en, this message translates to:
  /// **'Pickup Details'**
  String get orderPickupDetails;

  /// No description provided for @orderDeliveryDetails.
  ///
  /// In en, this message translates to:
  /// **'Delivery Details'**
  String get orderDeliveryDetails;

  /// No description provided for @orderAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get orderAddress;

  /// No description provided for @orderContactPhone.
  ///
  /// In en, this message translates to:
  /// **'Contact Phone'**
  String get orderContactPhone;

  /// No description provided for @orderType.
  ///
  /// In en, this message translates to:
  /// **'Order Type'**
  String get orderType;

  /// No description provided for @orderTypeInstallation.
  ///
  /// In en, this message translates to:
  /// **'Product + Installation (+{fee} SDG)'**
  String orderTypeInstallation(String fee);

  /// No description provided for @orderDeliveryFee.
  ///
  /// In en, this message translates to:
  /// **'Delivery Fee'**
  String get orderDeliveryFee;

  /// No description provided for @orderOrderedAt.
  ///
  /// In en, this message translates to:
  /// **'Ordered At'**
  String get orderOrderedAt;

  /// No description provided for @orderPaymentStatus.
  ///
  /// In en, this message translates to:
  /// **'Payment Status'**
  String get orderPaymentStatus;

  /// No description provided for @orderStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get orderStatusLabel;

  /// No description provided for @orderReceiptAttached.
  ///
  /// In en, this message translates to:
  /// **'Receipt Attached'**
  String get orderReceiptAttached;

  /// No description provided for @orderProductSubtotal.
  ///
  /// In en, this message translates to:
  /// **'Product Subtotal'**
  String get orderProductSubtotal;

  /// No description provided for @orderInstallationFee.
  ///
  /// In en, this message translates to:
  /// **'Installation Fee'**
  String get orderInstallationFee;

  /// No description provided for @orderTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get orderTotal;

  /// No description provided for @orderOrderStatus.
  ///
  /// In en, this message translates to:
  /// **'Order Status'**
  String get orderOrderStatus;

  /// No description provided for @pendingBanner.
  ///
  /// In en, this message translates to:
  /// **'PENDING VERIFICATION'**
  String get pendingBanner;

  /// No description provided for @pendingTitle.
  ///
  /// In en, this message translates to:
  /// **'Receipt Submitted for Verification'**
  String get pendingTitle;

  /// No description provided for @pendingBody.
  ///
  /// In en, this message translates to:
  /// **'Your transfer receipt reference has been saved. It is awaiting confirmation from the company. Payment will be marked Confirmed only after manual verification.'**
  String get pendingBody;

  /// No description provided for @pendingOrderReference.
  ///
  /// In en, this message translates to:
  /// **'Order Reference'**
  String get pendingOrderReference;

  /// No description provided for @pendingDeliveryAddress.
  ///
  /// In en, this message translates to:
  /// **'Delivery Address'**
  String get pendingDeliveryAddress;

  /// No description provided for @pendingInstallation.
  ///
  /// In en, this message translates to:
  /// **'Installation'**
  String get pendingInstallation;

  /// No description provided for @pendingInstallationIncluded.
  ///
  /// In en, this message translates to:
  /// **'Included ({fee} SDG)'**
  String pendingInstallationIncluded(String fee);

  /// No description provided for @pendingUploaded.
  ///
  /// In en, this message translates to:
  /// **'Uploaded'**
  String get pendingUploaded;

  /// No description provided for @pendingTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total Amount'**
  String get pendingTotalAmount;

  /// No description provided for @pendingBackToMarketplace.
  ///
  /// In en, this message translates to:
  /// **'Back to Marketplace'**
  String get pendingBackToMarketplace;

  /// No description provided for @pendingViewInMyOrders.
  ///
  /// In en, this message translates to:
  /// **'View in My Orders'**
  String get pendingViewInMyOrders;

  /// No description provided for @orderStatusProcessing.
  ///
  /// In en, this message translates to:
  /// **'Processing'**
  String get orderStatusProcessing;

  /// No description provided for @orderStatusOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for Delivery'**
  String get orderStatusOutForDelivery;

  /// No description provided for @orderStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get orderStatusCompleted;

  /// No description provided for @paymentStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending Verification'**
  String get paymentStatusPending;

  /// No description provided for @paymentStatusConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get paymentStatusConfirmed;

  /// No description provided for @deliveryMethodDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get deliveryMethodDelivery;

  /// No description provided for @deliveryMethodPickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get deliveryMethodPickup;

  /// No description provided for @jobStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get jobStatusPending;

  /// No description provided for @jobStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'In Progress'**
  String get jobStatusInProgress;

  /// No description provided for @customerFallback.
  ///
  /// In en, this message translates to:
  /// **'Customer {id}'**
  String customerFallback(String id);

  /// No description provided for @profileMyProfile.
  ///
  /// In en, this message translates to:
  /// **'My profile'**
  String get profileMyProfile;

  /// No description provided for @profileFullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get profileFullName;

  /// No description provided for @profilePhoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get profilePhoneNumber;

  /// No description provided for @profileFullNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your full name.'**
  String get profileFullNameRequired;

  /// No description provided for @profileEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get profileEdit;

  /// No description provided for @profileUpdated.
  ///
  /// In en, this message translates to:
  /// **'Profile updated successfully.'**
  String get profileUpdated;

  /// No description provided for @profileChangePassword.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get profileChangePassword;

  /// No description provided for @profileChangePasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Update your account password'**
  String get profileChangePasswordSubtitle;

  /// No description provided for @profileCurrentPassword.
  ///
  /// In en, this message translates to:
  /// **'Current password'**
  String get profileCurrentPassword;

  /// No description provided for @profileCurrentPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your current password.'**
  String get profileCurrentPasswordRequired;

  /// No description provided for @profilePasswordMin.
  ///
  /// In en, this message translates to:
  /// **'Use at least 6 characters.'**
  String get profilePasswordMin;

  /// No description provided for @profileConfirmPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Confirm your new password.'**
  String get profileConfirmPasswordRequired;

  /// No description provided for @profileUpdatePassword.
  ///
  /// In en, this message translates to:
  /// **'Update password'**
  String get profileUpdatePassword;

  /// No description provided for @profilePasswordChanged.
  ///
  /// In en, this message translates to:
  /// **'Password changed successfully.'**
  String get profilePasswordChanged;

  /// No description provided for @notificationsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load notifications.'**
  String get notificationsLoadFailed;

  /// No description provided for @notificationsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet.'**
  String get notificationsEmpty;

  /// No description provided for @notifNewOrderTitle.
  ///
  /// In en, this message translates to:
  /// **'New order received'**
  String get notifNewOrderTitle;

  /// No description provided for @notifNewOrderBody.
  ///
  /// In en, this message translates to:
  /// **'A new order for \"{product}\" was placed and is awaiting payment verification.'**
  String notifNewOrderBody(String product);

  /// No description provided for @notifPaymentConfirmedTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment confirmed'**
  String get notifPaymentConfirmedTitle;

  /// No description provided for @notifPaymentConfirmedBody.
  ///
  /// In en, this message translates to:
  /// **'Your payment for \"{product}\" has been confirmed.'**
  String notifPaymentConfirmedBody(String product);

  /// No description provided for @notifOutForDeliveryTitle.
  ///
  /// In en, this message translates to:
  /// **'Order out for delivery'**
  String get notifOutForDeliveryTitle;

  /// No description provided for @notifOutForDeliveryBody.
  ///
  /// In en, this message translates to:
  /// **'Your order \"{product}\" is out for delivery.'**
  String notifOutForDeliveryBody(String product);

  /// No description provided for @notifOrderCompletedTitle.
  ///
  /// In en, this message translates to:
  /// **'Order completed'**
  String get notifOrderCompletedTitle;

  /// No description provided for @notifOrderCompletedBody.
  ///
  /// In en, this message translates to:
  /// **'Your order has been completed.'**
  String get notifOrderCompletedBody;

  /// No description provided for @notifTechnicianAssignedTitle.
  ///
  /// In en, this message translates to:
  /// **'New installation job assigned'**
  String get notifTechnicianAssignedTitle;

  /// No description provided for @notifTechnicianAssignedBody.
  ///
  /// In en, this message translates to:
  /// **'You have been assigned to install \"{product}\".'**
  String notifTechnicianAssignedBody(String product);

  /// No description provided for @navTechnicians.
  ///
  /// In en, this message translates to:
  /// **'Technicians'**
  String get navTechnicians;

  /// No description provided for @adminInstallationJobs.
  ///
  /// In en, this message translates to:
  /// **'Installation Jobs'**
  String get adminInstallationJobs;

  /// No description provided for @adminNavInstallations.
  ///
  /// In en, this message translates to:
  /// **'Installations'**
  String get adminNavInstallations;

  /// No description provided for @adminCompanyProfile.
  ///
  /// In en, this message translates to:
  /// **'Company Profile'**
  String get adminCompanyProfile;

  /// No description provided for @adminCompanyDashboard.
  ///
  /// In en, this message translates to:
  /// **'Company Dashboard'**
  String get adminCompanyDashboard;

  /// No description provided for @techShellDashboard.
  ///
  /// In en, this message translates to:
  /// **'Technician Dashboard'**
  String get techShellDashboard;

  /// No description provided for @techShellJobs.
  ///
  /// In en, this message translates to:
  /// **'My Jobs'**
  String get techShellJobs;

  /// No description provided for @techNavJobs.
  ///
  /// In en, this message translates to:
  /// **'Jobs'**
  String get techNavJobs;

  /// No description provided for @adminWelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get adminWelcome;

  /// No description provided for @adminDashboardOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview of your products and orders'**
  String get adminDashboardOverview;

  /// No description provided for @adminTotalProducts.
  ///
  /// In en, this message translates to:
  /// **'Total Products'**
  String get adminTotalProducts;

  /// No description provided for @adminTotalOrders.
  ///
  /// In en, this message translates to:
  /// **'Total Orders'**
  String get adminTotalOrders;

  /// No description provided for @adminPendingOrders.
  ///
  /// In en, this message translates to:
  /// **'Pending Orders'**
  String get adminPendingOrders;

  /// No description provided for @adminRecentOrders.
  ///
  /// In en, this message translates to:
  /// **'Recent Orders'**
  String get adminRecentOrders;

  /// No description provided for @adminViewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get adminViewAll;

  /// No description provided for @adminOrdersLoadFailedShort.
  ///
  /// In en, this message translates to:
  /// **'Could not load orders.'**
  String get adminOrdersLoadFailedShort;

  /// No description provided for @adminNoOrdersYet.
  ///
  /// In en, this message translates to:
  /// **'No orders yet.'**
  String get adminNoOrdersYet;

  /// No description provided for @orderDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Order Details'**
  String get orderDetailsTitle;

  /// No description provided for @adminOrderNotFound.
  ///
  /// In en, this message translates to:
  /// **'This order was not found.'**
  String get adminOrderNotFound;

  /// No description provided for @adminJobNotFound.
  ///
  /// In en, this message translates to:
  /// **'This job was not found.'**
  String get adminJobNotFound;

  /// No description provided for @adminProductNotFound.
  ///
  /// In en, this message translates to:
  /// **'This product was not found.'**
  String get adminProductNotFound;

  /// No description provided for @adminOrdersLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your orders.'**
  String get adminOrdersLoadFailed;

  /// No description provided for @adminFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All ({count})'**
  String adminFilterAll(int count);

  /// No description provided for @adminFilterStatus.
  ///
  /// In en, this message translates to:
  /// **'{status} ({count})'**
  String adminFilterStatus(String status, int count);

  /// No description provided for @adminNoOrdersToShow.
  ///
  /// In en, this message translates to:
  /// **'No orders to show.'**
  String get adminNoOrdersToShow;

  /// No description provided for @adminQtyShort.
  ///
  /// In en, this message translates to:
  /// **'Qty {count}'**
  String adminQtyShort(int count);

  /// No description provided for @adminCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get adminCustomer;

  /// No description provided for @adminName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get adminName;

  /// No description provided for @adminProduct.
  ///
  /// In en, this message translates to:
  /// **'Product'**
  String get adminProduct;

  /// No description provided for @adminQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get adminQuantity;

  /// No description provided for @adminUnitPrice.
  ///
  /// In en, this message translates to:
  /// **'Unit Price'**
  String get adminUnitPrice;

  /// No description provided for @adminMethod.
  ///
  /// In en, this message translates to:
  /// **'Method'**
  String get adminMethod;

  /// No description provided for @adminSelection.
  ///
  /// In en, this message translates to:
  /// **'Selection'**
  String get adminSelection;

  /// No description provided for @adminJobStatus.
  ///
  /// In en, this message translates to:
  /// **'Job Status'**
  String get adminJobStatus;

  /// No description provided for @adminPayment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get adminPayment;

  /// No description provided for @adminReceiptReference.
  ///
  /// In en, this message translates to:
  /// **'Receipt Reference'**
  String get adminReceiptReference;

  /// No description provided for @adminNotProvided.
  ///
  /// In en, this message translates to:
  /// **'Not provided'**
  String get adminNotProvided;

  /// No description provided for @adminOrderInformation.
  ///
  /// In en, this message translates to:
  /// **'Order Information'**
  String get adminOrderInformation;

  /// No description provided for @adminOrderNumber.
  ///
  /// In en, this message translates to:
  /// **'Order Number'**
  String get adminOrderNumber;

  /// No description provided for @adminCreated.
  ///
  /// In en, this message translates to:
  /// **'Created'**
  String get adminCreated;

  /// No description provided for @adminLastUpdated.
  ///
  /// In en, this message translates to:
  /// **'Last Updated'**
  String get adminLastUpdated;

  /// No description provided for @adminCurrentStatus.
  ///
  /// In en, this message translates to:
  /// **'Current Status'**
  String get adminCurrentStatus;

  /// No description provided for @adminManageOrder.
  ///
  /// In en, this message translates to:
  /// **'Manage Order'**
  String get adminManageOrder;

  /// No description provided for @adminVerifyReceipt.
  ///
  /// In en, this message translates to:
  /// **'Verify the transfer receipt before processing this order.'**
  String get adminVerifyReceipt;

  /// No description provided for @adminConfirmPaymentTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm payment'**
  String get adminConfirmPaymentTitle;

  /// No description provided for @adminConfirmPaymentBody.
  ///
  /// In en, this message translates to:
  /// **'Mark the payment for order #{id} as confirmed?'**
  String adminConfirmPaymentBody(String id);

  /// No description provided for @adminPaymentConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Payment confirmed.'**
  String get adminPaymentConfirmed;

  /// No description provided for @adminConfirmPaymentButton.
  ///
  /// In en, this message translates to:
  /// **'Confirm Payment'**
  String get adminConfirmPaymentButton;

  /// No description provided for @adminOrderCompleted.
  ///
  /// In en, this message translates to:
  /// **'This order is completed.'**
  String get adminOrderCompleted;

  /// No description provided for @adminMarkCompletedHint.
  ///
  /// In en, this message translates to:
  /// **'Mark completed once the technician has finished the installation.'**
  String get adminMarkCompletedHint;

  /// No description provided for @adminUpdateOrderStatus.
  ///
  /// In en, this message translates to:
  /// **'Update order status'**
  String get adminUpdateOrderStatus;

  /// No description provided for @adminChangeOrderStatusBody.
  ///
  /// In en, this message translates to:
  /// **'Change order #{id} to \"{status}\"? This cannot be undone.'**
  String adminChangeOrderStatusBody(String id, String status);

  /// No description provided for @adminOrderMarked.
  ///
  /// In en, this message translates to:
  /// **'Order marked {status}.'**
  String adminOrderMarked(String status);

  /// No description provided for @adminMarkOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Mark Out for Delivery'**
  String get adminMarkOutForDelivery;

  /// No description provided for @adminMarkCompletedInstalled.
  ///
  /// In en, this message translates to:
  /// **'Mark Completed (Installed)'**
  String get adminMarkCompletedInstalled;

  /// No description provided for @adminMarkCompleted.
  ///
  /// In en, this message translates to:
  /// **'Mark Completed'**
  String get adminMarkCompleted;

  /// No description provided for @adminMarkProcessing.
  ///
  /// In en, this message translates to:
  /// **'Mark Processing'**
  String get adminMarkProcessing;

  /// No description provided for @adminInstallationJobsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load installation jobs.'**
  String get adminInstallationJobsLoadFailed;

  /// No description provided for @adminInstallationJobsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No installation jobs yet.\nOrders with Product + Installation appear here.'**
  String get adminInstallationJobsEmpty;

  /// No description provided for @adminInstallationJob.
  ///
  /// In en, this message translates to:
  /// **'Installation Job'**
  String get adminInstallationJob;

  /// No description provided for @adminJobTitleNumber.
  ///
  /// In en, this message translates to:
  /// **'Job #{id}'**
  String adminJobTitleNumber(String id);

  /// No description provided for @adminJobDetails.
  ///
  /// In en, this message translates to:
  /// **'Job Details'**
  String get adminJobDetails;

  /// No description provided for @adminJobOrderNumber.
  ///
  /// In en, this message translates to:
  /// **'Job / Order Number'**
  String get adminJobOrderNumber;

  /// No description provided for @adminCustomerLocation.
  ///
  /// In en, this message translates to:
  /// **'Customer & Location'**
  String get adminCustomerLocation;

  /// No description provided for @adminInstallationAddress.
  ///
  /// In en, this message translates to:
  /// **'Installation Address'**
  String get adminInstallationAddress;

  /// No description provided for @adminLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get adminLocation;

  /// No description provided for @adminCustomerPickupConfirm.
  ///
  /// In en, this message translates to:
  /// **'Customer pickup — confirm the installation location by phone'**
  String get adminCustomerPickupConfirm;

  /// No description provided for @adminCustomerPickupConfirmShort.
  ///
  /// In en, this message translates to:
  /// **'Customer pickup — confirm the location by phone'**
  String get adminCustomerPickupConfirmShort;

  /// No description provided for @adminCustomerPickup.
  ///
  /// In en, this message translates to:
  /// **'Customer pickup'**
  String get adminCustomerPickup;

  /// No description provided for @adminViewFullOrder.
  ///
  /// In en, this message translates to:
  /// **'View full order'**
  String get adminViewFullOrder;

  /// No description provided for @adminTechnicianAssigned.
  ///
  /// In en, this message translates to:
  /// **'Technician assigned.'**
  String get adminTechnicianAssigned;

  /// No description provided for @adminAssignTechnician.
  ///
  /// In en, this message translates to:
  /// **'Assign Technician'**
  String get adminAssignTechnician;

  /// No description provided for @adminChangeTechnician.
  ///
  /// In en, this message translates to:
  /// **'Change Technician'**
  String get adminChangeTechnician;

  /// No description provided for @adminTechnicianSection.
  ///
  /// In en, this message translates to:
  /// **'Technician'**
  String get adminTechnicianSection;

  /// No description provided for @adminAssignedTo.
  ///
  /// In en, this message translates to:
  /// **'Assigned to'**
  String get adminAssignedTo;

  /// No description provided for @adminNotAssigned.
  ///
  /// In en, this message translates to:
  /// **'Not assigned'**
  String get adminNotAssigned;

  /// No description provided for @adminTechniciansLoadFailedShort.
  ///
  /// In en, this message translates to:
  /// **'Could not load technicians.'**
  String get adminTechniciansLoadFailedShort;

  /// No description provided for @adminAddTechnicianFirst.
  ///
  /// In en, this message translates to:
  /// **'Add a technician first to assign this job.'**
  String get adminAddTechnicianFirst;

  /// No description provided for @adminAddProduct.
  ///
  /// In en, this message translates to:
  /// **'Add Product'**
  String get adminAddProduct;

  /// No description provided for @adminEditProduct.
  ///
  /// In en, this message translates to:
  /// **'Edit Product'**
  String get adminEditProduct;

  /// No description provided for @adminProductsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your products.'**
  String get adminProductsLoadFailed;

  /// No description provided for @adminProductsEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have not added any products yet.\nTap \"Add Product\" to create your first one.'**
  String get adminProductsEmpty;

  /// No description provided for @adminInStock.
  ///
  /// In en, this message translates to:
  /// **'In stock: {count}'**
  String adminInStock(int count);

  /// No description provided for @adminUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get adminUnavailable;

  /// No description provided for @adminOutOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of stock'**
  String get adminOutOfStock;

  /// No description provided for @adminInstallationBadge.
  ///
  /// In en, this message translates to:
  /// **'Installation'**
  String get adminInstallationBadge;

  /// No description provided for @adminPickupOnlyBadge.
  ///
  /// In en, this message translates to:
  /// **'Pickup only'**
  String get adminPickupOnlyBadge;

  /// No description provided for @adminDeleteProduct.
  ///
  /// In en, this message translates to:
  /// **'Delete product'**
  String get adminDeleteProduct;

  /// No description provided for @adminDeleteProductBody.
  ///
  /// In en, this message translates to:
  /// **'Delete \"{name}\"? This cannot be undone.'**
  String adminDeleteProductBody(String name);

  /// No description provided for @adminProductDeleted.
  ///
  /// In en, this message translates to:
  /// **'Product deleted.'**
  String get adminProductDeleted;

  /// No description provided for @adminProductDetails.
  ///
  /// In en, this message translates to:
  /// **'Product Details'**
  String get adminProductDetails;

  /// No description provided for @adminEditProductTooltip.
  ///
  /// In en, this message translates to:
  /// **'Edit product'**
  String get adminEditProductTooltip;

  /// No description provided for @adminAvailability.
  ///
  /// In en, this message translates to:
  /// **'Availability'**
  String get adminAvailability;

  /// No description provided for @adminStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get adminStatus;

  /// No description provided for @adminAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get adminAvailable;

  /// No description provided for @adminNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Not available'**
  String get adminNotAvailable;

  /// No description provided for @adminNotAvailablePickup.
  ///
  /// In en, this message translates to:
  /// **'Not available (pickup only)'**
  String get adminNotAvailablePickup;

  /// No description provided for @adminStock.
  ///
  /// In en, this message translates to:
  /// **'Stock'**
  String get adminStock;

  /// No description provided for @adminDeliveryInstallation.
  ///
  /// In en, this message translates to:
  /// **'Delivery & Installation'**
  String get adminDeliveryInstallation;

  /// No description provided for @adminInstallationPrice.
  ///
  /// In en, this message translates to:
  /// **'Installation Price'**
  String get adminInstallationPrice;

  /// No description provided for @formProductAdded.
  ///
  /// In en, this message translates to:
  /// **'Product added.'**
  String get formProductAdded;

  /// No description provided for @formProductUpdated.
  ///
  /// In en, this message translates to:
  /// **'Product updated.'**
  String get formProductUpdated;

  /// No description provided for @formProductName.
  ///
  /// In en, this message translates to:
  /// **'Product Name'**
  String get formProductName;

  /// No description provided for @formProductNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Product name is required.'**
  String get formProductNameRequired;

  /// No description provided for @formCategoryLabel.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get formCategoryLabel;

  /// No description provided for @adminUnitsLeft.
  ///
  /// In en, this message translates to:
  /// **'{count} left'**
  String adminUnitsLeft(int count);

  /// No description provided for @adminStockLow.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get adminStockLow;

  /// No description provided for @adminAttentionRestock.
  ///
  /// In en, this message translates to:
  /// **'Restock'**
  String get adminAttentionRestock;

  /// No description provided for @adminAttentionAssignTechnician.
  ///
  /// In en, this message translates to:
  /// **'Assign technician'**
  String get adminAttentionAssignTechnician;

  /// No description provided for @adminAttentionVerifyPayment.
  ///
  /// In en, this message translates to:
  /// **'Verify payment'**
  String get adminAttentionVerifyPayment;

  /// No description provided for @adminQuickTechnician.
  ///
  /// In en, this message translates to:
  /// **'Technician'**
  String get adminQuickTechnician;

  /// No description provided for @adminQuickService.
  ///
  /// In en, this message translates to:
  /// **'Service'**
  String get adminQuickService;

  /// No description provided for @adminQuickProduct.
  ///
  /// In en, this message translates to:
  /// **'Product'**
  String get adminQuickProduct;

  /// No description provided for @adminStatLowStock.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get adminStatLowStock;

  /// No description provided for @adminStatSalesWeek.
  ///
  /// In en, this message translates to:
  /// **'Sales this week'**
  String get adminStatSalesWeek;

  /// No description provided for @adminStatNewOrders.
  ///
  /// In en, this message translates to:
  /// **'New orders'**
  String get adminStatNewOrders;

  /// No description provided for @adminNothingToDo.
  ///
  /// In en, this message translates to:
  /// **'Nothing needs your attention right now.'**
  String get adminNothingToDo;

  /// No description provided for @adminNeedsAttention.
  ///
  /// In en, this message translates to:
  /// **'Needs your attention'**
  String get adminNeedsAttention;

  /// No description provided for @adminMenuTitle.
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get adminMenuTitle;

  /// No description provided for @adminSearchOrders.
  ///
  /// In en, this message translates to:
  /// **'Search by product or customer'**
  String get adminSearchOrders;

  /// No description provided for @adminSearchProducts.
  ///
  /// In en, this message translates to:
  /// **'Search products'**
  String get adminSearchProducts;

  /// No description provided for @adminServiceOwnBadge.
  ///
  /// In en, this message translates to:
  /// **'Created by you'**
  String get adminServiceOwnBadge;

  /// No description provided for @adminServiceCategoryInvalid.
  ///
  /// In en, this message translates to:
  /// **'Choose a valid category.'**
  String get adminServiceCategoryInvalid;

  /// No description provided for @adminServiceCategoryRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose a category.'**
  String get adminServiceCategoryRequired;

  /// No description provided for @adminServiceDescriptionLabel.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get adminServiceDescriptionLabel;

  /// No description provided for @adminServiceNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Service name is required.'**
  String get adminServiceNameRequired;

  /// No description provided for @adminServiceNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Service name'**
  String get adminServiceNameLabel;

  /// No description provided for @adminServiceFormEditTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit service'**
  String get adminServiceFormEditTitle;

  /// No description provided for @adminServiceCreateFirst.
  ///
  /// In en, this message translates to:
  /// **'Create your first service'**
  String get adminServiceCreateFirst;

  /// No description provided for @adminServiceNew.
  ///
  /// In en, this message translates to:
  /// **'New service'**
  String get adminServiceNew;

  /// No description provided for @adminServicesYours.
  ///
  /// In en, this message translates to:
  /// **'Your services'**
  String get adminServicesYours;

  /// No description provided for @formCategoryInactiveSuffix.
  ///
  /// In en, this message translates to:
  /// **'(inactive)'**
  String get formCategoryInactiveSuffix;

  /// No description provided for @formCategoryNone.
  ///
  /// In en, this message translates to:
  /// **'No category'**
  String get formCategoryNone;

  /// No description provided for @homeFilterAllCategories.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get homeFilterAllCategories;

  /// No description provided for @homeCategoriesTitle.
  ///
  /// In en, this message translates to:
  /// **'Categories'**
  String get homeCategoriesTitle;

  /// No description provided for @homeCategoriesMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get homeCategoriesMore;

  /// No description provided for @adminProductUncategorized.
  ///
  /// In en, this message translates to:
  /// **'No category'**
  String get adminProductUncategorized;

  /// No description provided for @formPriceOptional.
  ///
  /// In en, this message translates to:
  /// **'Price (SDG) - optional'**
  String get formPriceOptional;

  /// No description provided for @formPriceInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid price greater than 0.'**
  String get formPriceInvalid;

  /// No description provided for @formInstallationPriceRequired.
  ///
  /// In en, this message translates to:
  /// **'Installation price is required.'**
  String get formInstallationPriceRequired;

  /// No description provided for @formInstallationPriceInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid installation price greater than 0.'**
  String get formInstallationPriceInvalid;

  /// No description provided for @formStockSection.
  ///
  /// In en, this message translates to:
  /// **'Stock / Availability'**
  String get formStockSection;

  /// No description provided for @formStockQuantity.
  ///
  /// In en, this message translates to:
  /// **'Stock Quantity'**
  String get formStockQuantity;

  /// No description provided for @formStockRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the stock quantity (0 or more).'**
  String get formStockRequired;

  /// No description provided for @formAvailableForSale.
  ///
  /// In en, this message translates to:
  /// **'Available for sale'**
  String get formAvailableForSale;

  /// No description provided for @formAvailableHint.
  ///
  /// In en, this message translates to:
  /// **'Customers can buy this product while it has stock.'**
  String get formAvailableHint;

  /// No description provided for @formSpecName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get formSpecName;

  /// No description provided for @formSpecValue.
  ///
  /// In en, this message translates to:
  /// **'Value'**
  String get formSpecValue;

  /// No description provided for @formAddSpec.
  ///
  /// In en, this message translates to:
  /// **'Add specification'**
  String get formAddSpec;

  /// No description provided for @formDeliveryAvailable.
  ///
  /// In en, this message translates to:
  /// **'Delivery Available'**
  String get formDeliveryAvailable;

  /// No description provided for @formDeliveryOn.
  ///
  /// In en, this message translates to:
  /// **'Customers can choose delivery at checkout.'**
  String get formDeliveryOn;

  /// No description provided for @formDeliveryOff.
  ///
  /// In en, this message translates to:
  /// **'Customers collect this product from your pickup location.'**
  String get formDeliveryOff;

  /// No description provided for @formInstallationAvailable.
  ///
  /// In en, this message translates to:
  /// **'Installation Available'**
  String get formInstallationAvailable;

  /// No description provided for @formInstallationOn.
  ///
  /// In en, this message translates to:
  /// **'Customers can choose Product + Installation.'**
  String get formInstallationOn;

  /// No description provided for @formInstallationOff.
  ///
  /// In en, this message translates to:
  /// **'Customers will not see any installation option.'**
  String get formInstallationOff;

  /// No description provided for @formInstallationPrice.
  ///
  /// In en, this message translates to:
  /// **'Installation Price (SDG)'**
  String get formInstallationPrice;

  /// No description provided for @adminCompanyLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your company profile.'**
  String get adminCompanyLoadFailed;

  /// No description provided for @adminCompanyNotFound.
  ///
  /// In en, this message translates to:
  /// **'Your company record was not found. Please contact the platform administrator.'**
  String get adminCompanyNotFound;

  /// No description provided for @adminContact.
  ///
  /// In en, this message translates to:
  /// **'Contact'**
  String get adminContact;

  /// No description provided for @adminPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get adminPhone;

  /// No description provided for @adminCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get adminCity;

  /// No description provided for @adminEditCompanyProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit Company Profile'**
  String get adminEditCompanyProfile;

  /// No description provided for @adminCompanyProfileUpdated.
  ///
  /// In en, this message translates to:
  /// **'Company profile updated.'**
  String get adminCompanyProfileUpdated;

  /// No description provided for @adminCompanyName.
  ///
  /// In en, this message translates to:
  /// **'Company Name'**
  String get adminCompanyName;

  /// No description provided for @adminCompanyNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Company name is required.'**
  String get adminCompanyNameRequired;

  /// No description provided for @adminPickupAddress.
  ///
  /// In en, this message translates to:
  /// **'Pickup Location / Address'**
  String get adminPickupAddress;

  /// No description provided for @adminShortDescription.
  ///
  /// In en, this message translates to:
  /// **'Short Description'**
  String get adminShortDescription;

  /// No description provided for @adminAddTechnician.
  ///
  /// In en, this message translates to:
  /// **'Add Technician'**
  String get adminAddTechnician;

  /// No description provided for @adminEditTechnician.
  ///
  /// In en, this message translates to:
  /// **'Edit Technician'**
  String get adminEditTechnician;

  /// No description provided for @adminDeactivateTechnician.
  ///
  /// In en, this message translates to:
  /// **'Deactivate technician'**
  String get adminDeactivateTechnician;

  /// No description provided for @adminDeactivateTechnicianBody.
  ///
  /// In en, this message translates to:
  /// **'Deactivate \"{name}\"? They will no longer be available for new installation jobs.'**
  String adminDeactivateTechnicianBody(String name);

  /// No description provided for @adminTechnicianDeactivated.
  ///
  /// In en, this message translates to:
  /// **'Technician deactivated.'**
  String get adminTechnicianDeactivated;

  /// No description provided for @adminTechniciansLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your technicians.'**
  String get adminTechniciansLoadFailed;

  /// No description provided for @adminTechniciansEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have not added any technicians yet.\nTap \"Add Technician\" to create your first technician account.'**
  String get adminTechniciansEmpty;

  /// No description provided for @adminActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get adminActive;

  /// No description provided for @adminInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get adminInactive;

  /// No description provided for @adminTechnicianUpdated.
  ///
  /// In en, this message translates to:
  /// **'Technician updated.'**
  String get adminTechnicianUpdated;

  /// No description provided for @adminTechnicianNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Technician name is required.'**
  String get adminTechnicianNameRequired;

  /// No description provided for @adminPhoneRequired.
  ///
  /// In en, this message translates to:
  /// **'Phone number is required.'**
  String get adminPhoneRequired;

  /// No description provided for @adminTechnicianEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Technician email is required.'**
  String get adminTechnicianEmailRequired;

  /// No description provided for @adminInactiveTechnicianNote.
  ///
  /// In en, this message translates to:
  /// **'Inactive technicians cannot be assigned to new jobs.'**
  String get adminInactiveTechnicianNote;

  /// No description provided for @techDashboardLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your dashboard.'**
  String get techDashboardLoadFailed;

  /// No description provided for @techWelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome, {name}'**
  String techWelcome(String name);

  /// No description provided for @techTotalJobs.
  ///
  /// In en, this message translates to:
  /// **'Total Jobs'**
  String get techTotalJobs;

  /// No description provided for @techUpcomingJobs.
  ///
  /// In en, this message translates to:
  /// **'Upcoming Jobs'**
  String get techUpcomingJobs;

  /// No description provided for @techNoPendingJobs.
  ///
  /// In en, this message translates to:
  /// **'No pending jobs right now.'**
  String get techNoPendingJobs;

  /// No description provided for @techJobsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your jobs.'**
  String get techJobsLoadFailed;

  /// No description provided for @techNoJobsAssigned.
  ///
  /// In en, this message translates to:
  /// **'No installation jobs assigned to you yet.'**
  String get techNoJobsAssigned;

  /// No description provided for @techJobCompleted.
  ///
  /// In en, this message translates to:
  /// **'This job is completed.'**
  String get techJobCompleted;

  /// No description provided for @techUpdateJobStatus.
  ///
  /// In en, this message translates to:
  /// **'Update job status'**
  String get techUpdateJobStatus;

  /// No description provided for @techChangeJobBody.
  ///
  /// In en, this message translates to:
  /// **'Change job #{id} to \"{status}\"? This cannot be undone.'**
  String techChangeJobBody(String id, String status);

  /// No description provided for @techJobMarked.
  ///
  /// In en, this message translates to:
  /// **'Job marked {status}.'**
  String techJobMarked(String status);

  /// No description provided for @techMarkInstallationCompleted.
  ///
  /// In en, this message translates to:
  /// **'Mark Installation Completed'**
  String get techMarkInstallationCompleted;

  /// No description provided for @techProfileLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your profile.'**
  String get techProfileLoadFailed;

  /// No description provided for @techCompany.
  ///
  /// In en, this message translates to:
  /// **'Company'**
  String get techCompany;

  /// No description provided for @techMyDetails.
  ///
  /// In en, this message translates to:
  /// **'My Details'**
  String get techMyDetails;

  /// No description provided for @techEditName.
  ///
  /// In en, this message translates to:
  /// **'Edit name'**
  String get techEditName;

  /// No description provided for @comingSoonTitle.
  ///
  /// In en, this message translates to:
  /// **'{title} is coming soon'**
  String comingSoonTitle(String title);

  /// No description provided for @paymentAccountsManage.
  ///
  /// In en, this message translates to:
  /// **'Payment accounts'**
  String get paymentAccountsManage;

  /// No description provided for @paymentAccountsIntro.
  ///
  /// In en, this message translates to:
  /// **'Customers transfer their order payments to these accounts. Add at least one so customers can pay you.'**
  String get paymentAccountsIntro;

  /// No description provided for @paymentAccountsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No payment accounts yet.'**
  String get paymentAccountsEmpty;

  /// No description provided for @paymentAccountAdd.
  ///
  /// In en, this message translates to:
  /// **'Add account'**
  String get paymentAccountAdd;

  /// No description provided for @paymentAccountEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit account'**
  String get paymentAccountEdit;

  /// No description provided for @paymentAccountBankName.
  ///
  /// In en, this message translates to:
  /// **'Bank / wallet name'**
  String get paymentAccountBankName;

  /// No description provided for @paymentAccountBankRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the bank or wallet name.'**
  String get paymentAccountBankRequired;

  /// No description provided for @paymentAccountHolderRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the account holder name.'**
  String get paymentAccountHolderRequired;

  /// No description provided for @paymentAccountNumberRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the account number.'**
  String get paymentAccountNumberRequired;

  /// No description provided for @paymentAccountPhoneOptional.
  ///
  /// In en, this message translates to:
  /// **'Linked phone number (optional)'**
  String get paymentAccountPhoneOptional;

  /// No description provided for @paymentAccountSaved.
  ///
  /// In en, this message translates to:
  /// **'Payment account saved.'**
  String get paymentAccountSaved;

  /// No description provided for @paymentAccountRemoved.
  ///
  /// In en, this message translates to:
  /// **'Payment account removed.'**
  String get paymentAccountRemoved;

  /// No description provided for @paymentAccountRemoveTitle.
  ///
  /// In en, this message translates to:
  /// **'Remove this account?'**
  String get paymentAccountRemoveTitle;

  /// No description provided for @paymentAccountRemoveBody.
  ///
  /// In en, this message translates to:
  /// **'Customers will no longer see it on the payment screen.'**
  String get paymentAccountRemoveBody;

  /// No description provided for @paymentAccountLimit.
  ///
  /// In en, this message translates to:
  /// **'You can add up to {max} accounts.'**
  String paymentAccountLimit(int max);

  /// No description provided for @paymentNoAccountsForCompany.
  ///
  /// In en, this message translates to:
  /// **'This company has not added payment accounts yet, so it cannot receive a payment right now. Please contact the company.'**
  String get paymentNoAccountsForCompany;

  /// No description provided for @adminTechnicianAccountNote.
  ///
  /// In en, this message translates to:
  /// **'This creates the technician\'s account with a temporary password. Give them this email and password; they choose their own password the first time they sign in.'**
  String get adminTechnicianAccountNote;

  /// No description provided for @adminTechnicianTempPassword.
  ///
  /// In en, this message translates to:
  /// **'Temporary password'**
  String get adminTechnicianTempPassword;

  /// No description provided for @adminTechnicianPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a temporary password.'**
  String get adminTechnicianPasswordRequired;

  /// No description provided for @adminAddTechnicianSubmit.
  ///
  /// In en, this message translates to:
  /// **'Add technician'**
  String get adminAddTechnicianSubmit;

  /// No description provided for @adminTechnicianCreated.
  ///
  /// In en, this message translates to:
  /// **'Technician added. Share the email and temporary password with them.'**
  String get adminTechnicianCreated;

  /// No description provided for @technicianEmailInUse.
  ///
  /// In en, this message translates to:
  /// **'An account with this email already exists.'**
  String get technicianEmailInUse;

  /// No description provided for @technicianEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'This email address is not valid.'**
  String get technicianEmailInvalid;

  /// No description provided for @technicianPasswordWeak.
  ///
  /// In en, this message translates to:
  /// **'The temporary password is too weak. Choose a longer, harder one.'**
  String get technicianPasswordWeak;

  /// No description provided for @technicianTooManyRequests.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Wait a few minutes and try again.'**
  String get technicianTooManyRequests;

  /// No description provided for @technicianAuthDisabled.
  ///
  /// In en, this message translates to:
  /// **'Creating accounts by email is turned off for this project. Contact the platform administrator.'**
  String get technicianAuthDisabled;

  /// No description provided for @comingSoonBody.
  ///
  /// In en, this message translates to:
  /// **'This section will be available in a later update.'**
  String get comingSoonBody;

  /// No description provided for @navServices.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get navServices;

  /// No description provided for @navChats.
  ///
  /// In en, this message translates to:
  /// **'Chats'**
  String get navChats;

  /// No description provided for @navMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get navMore;

  /// No description provided for @homeSearchServices.
  ///
  /// In en, this message translates to:
  /// **'Search services...'**
  String get homeSearchServices;

  /// No description provided for @homeNoServices.
  ///
  /// In en, this message translates to:
  /// **'No services found'**
  String get homeNoServices;

  /// No description provided for @homeServicesLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Services could not be loaded.'**
  String get homeServicesLoadFailed;

  /// No description provided for @ordersTabProducts.
  ///
  /// In en, this message translates to:
  /// **'Products'**
  String get ordersTabProducts;

  /// No description provided for @ordersTabServices.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get ordersTabServices;

  /// No description provided for @serviceDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Service details'**
  String get serviceDetailsTitle;

  /// No description provided for @serviceAvailableCompanies.
  ///
  /// In en, this message translates to:
  /// **'Available companies'**
  String get serviceAvailableCompanies;

  /// No description provided for @serviceNoCompanies.
  ///
  /// In en, this message translates to:
  /// **'No company offers this service yet.'**
  String get serviceNoCompanies;

  /// No description provided for @serviceCompaniesLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'The companies could not be loaded.'**
  String get serviceCompaniesLoadFailed;

  /// No description provided for @serviceRequestAction.
  ///
  /// In en, this message translates to:
  /// **'Request service'**
  String get serviceRequestAction;

  /// No description provided for @serviceRequestFormTitle.
  ///
  /// In en, this message translates to:
  /// **'Request service'**
  String get serviceRequestFormTitle;

  /// No description provided for @serviceRequestDetailsLabel.
  ///
  /// In en, this message translates to:
  /// **'What do you need?'**
  String get serviceRequestDetailsLabel;

  /// No description provided for @serviceRequestDetailsHint.
  ///
  /// In en, this message translates to:
  /// **'Describe the work, the device or system, and anything the company should know.'**
  String get serviceRequestDetailsHint;

  /// No description provided for @serviceRequestDetailsRequired.
  ///
  /// In en, this message translates to:
  /// **'Please describe what you need.'**
  String get serviceRequestDetailsRequired;

  /// No description provided for @serviceRequestLocationOptional.
  ///
  /// In en, this message translates to:
  /// **'Address (optional)'**
  String get serviceRequestLocationOptional;

  /// No description provided for @serviceRequestAddressHint.
  ///
  /// In en, this message translates to:
  /// **'Where should the service be done?'**
  String get serviceRequestAddressHint;

  /// No description provided for @serviceRequestSubmit.
  ///
  /// In en, this message translates to:
  /// **'Send request'**
  String get serviceRequestSubmit;

  /// No description provided for @serviceRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Your request was sent. You can now chat with the company.'**
  String get serviceRequestSent;

  /// No description provided for @serviceRequestCreateDenied.
  ///
  /// In en, this message translates to:
  /// **'This request could not be sent. The company may no longer offer this service.'**
  String get serviceRequestCreateDenied;

  /// No description provided for @serviceRequestCreateFailed.
  ///
  /// In en, this message translates to:
  /// **'The request could not be sent. Please try again.'**
  String get serviceRequestCreateFailed;

  /// No description provided for @serviceRequestUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'The request could not be updated. Please try again.'**
  String get serviceRequestUpdateFailed;

  /// No description provided for @serviceRequestsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Service requests could not be loaded.'**
  String get serviceRequestsLoadFailed;

  /// No description provided for @serviceRequestNotFound.
  ///
  /// In en, this message translates to:
  /// **'This service request was not found.'**
  String get serviceRequestNotFound;

  /// No description provided for @serviceRequestsEmptyCustomer.
  ///
  /// In en, this message translates to:
  /// **'You have not requested any services yet.'**
  String get serviceRequestsEmptyCustomer;

  /// No description provided for @serviceRequestsEmptyCompany.
  ///
  /// In en, this message translates to:
  /// **'No service requests yet.'**
  String get serviceRequestsEmptyCompany;

  /// No description provided for @serviceRequestDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Service request'**
  String get serviceRequestDetailsTitle;

  /// No description provided for @serviceRequestCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get serviceRequestCustomer;

  /// No description provided for @serviceRequestCompany.
  ///
  /// In en, this message translates to:
  /// **'Company'**
  String get serviceRequestCompany;

  /// No description provided for @serviceRequestPrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get serviceRequestPrice;

  /// No description provided for @serviceRequestSentAt.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get serviceRequestSentAt;

  /// No description provided for @serviceRequestNumber.
  ///
  /// In en, this message translates to:
  /// **'Request'**
  String get serviceRequestNumber;

  /// No description provided for @serviceRequestContact.
  ///
  /// In en, this message translates to:
  /// **'Contact and location'**
  String get serviceRequestContact;

  /// No description provided for @serviceRequestAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get serviceRequestAddress;

  /// No description provided for @serviceRequestOpenChat.
  ///
  /// In en, this message translates to:
  /// **'Open chat'**
  String get serviceRequestOpenChat;

  /// No description provided for @serviceRequestViewDetails.
  ///
  /// In en, this message translates to:
  /// **'Request details'**
  String get serviceRequestViewDetails;

  /// No description provided for @serviceRequestCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel request'**
  String get serviceRequestCancel;

  /// No description provided for @serviceRequestCancelTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel this request?'**
  String get serviceRequestCancelTitle;

  /// No description provided for @serviceRequestCancelBody.
  ///
  /// In en, this message translates to:
  /// **'The company will see that you cancelled it. This cannot be undone.'**
  String get serviceRequestCancelBody;

  /// No description provided for @serviceRequestAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get serviceRequestAccept;

  /// No description provided for @serviceRequestReject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get serviceRequestReject;

  /// No description provided for @serviceRequestRejectTitle.
  ///
  /// In en, this message translates to:
  /// **'Reject this request?'**
  String get serviceRequestRejectTitle;

  /// No description provided for @serviceRequestRejectBody.
  ///
  /// In en, this message translates to:
  /// **'The customer will see that the request was rejected. This cannot be undone.'**
  String get serviceRequestRejectBody;

  /// No description provided for @serviceRequestStart.
  ///
  /// In en, this message translates to:
  /// **'Start work'**
  String get serviceRequestStart;

  /// No description provided for @serviceRequestComplete.
  ///
  /// In en, this message translates to:
  /// **'Mark as completed'**
  String get serviceRequestComplete;

  /// No description provided for @serviceRequestStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get serviceRequestStatusPending;

  /// No description provided for @serviceRequestStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get serviceRequestStatusAccepted;

  /// No description provided for @serviceRequestStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get serviceRequestStatusRejected;

  /// No description provided for @serviceRequestStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get serviceRequestStatusInProgress;

  /// No description provided for @serviceRequestStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get serviceRequestStatusCompleted;

  /// No description provided for @serviceRequestStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get serviceRequestStatusCancelled;

  /// No description provided for @serviceRequestStatusLine.
  ///
  /// In en, this message translates to:
  /// **'Request status: {status}'**
  String serviceRequestStatusLine(String status);

  /// No description provided for @chatsEmptyCustomer.
  ///
  /// In en, this message translates to:
  /// **'No chats yet. When you request a service, your conversation with the company appears here.'**
  String get chatsEmptyCustomer;

  /// No description provided for @chatsEmptyCompany.
  ///
  /// In en, this message translates to:
  /// **'No chats yet. Each service request sent to your company opens a conversation here.'**
  String get chatsEmptyCompany;

  /// No description provided for @chatNoMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get chatNoMessagesYet;

  /// No description provided for @chatEmpty.
  ///
  /// In en, this message translates to:
  /// **'No messages yet. Write to start the conversation.'**
  String get chatEmpty;

  /// No description provided for @chatInputHint.
  ///
  /// In en, this message translates to:
  /// **'Write a message'**
  String get chatInputHint;

  /// No description provided for @chatSend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get chatSend;

  /// No description provided for @chatYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get chatYou;

  /// No description provided for @chatYouPrefix.
  ///
  /// In en, this message translates to:
  /// **'You: {text}'**
  String chatYouPrefix(String text);

  /// No description provided for @chatYesterdayAt.
  ///
  /// In en, this message translates to:
  /// **'Yesterday {time}'**
  String chatYesterdayAt(String time);

  /// No description provided for @chatCustomerFallback.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get chatCustomerFallback;

  /// No description provided for @chatUnread.
  ///
  /// In en, this message translates to:
  /// **'Unread'**
  String get chatUnread;

  /// No description provided for @chatNotFound.
  ///
  /// In en, this message translates to:
  /// **'This conversation was not found.'**
  String get chatNotFound;

  /// No description provided for @chatLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'The chat could not be loaded.'**
  String get chatLoadFailed;

  /// No description provided for @chatSendDenied.
  ///
  /// In en, this message translates to:
  /// **'You cannot send messages in this conversation.'**
  String get chatSendDenied;

  /// No description provided for @chatSendFailed.
  ///
  /// In en, this message translates to:
  /// **'The message could not be sent. Please try again.'**
  String get chatSendFailed;

  /// No description provided for @chatMessageInvalid.
  ///
  /// In en, this message translates to:
  /// **'Write a message of up to 2000 characters.'**
  String get chatMessageInvalid;

  /// No description provided for @adminServiceRequestsTab.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get adminServiceRequestsTab;

  /// No description provided for @adminMyServicesTab.
  ///
  /// In en, this message translates to:
  /// **'My services'**
  String get adminMyServicesTab;

  /// No description provided for @adminServicesLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Services could not be loaded.'**
  String get adminServicesLoadFailed;

  /// No description provided for @adminServicesOffered.
  ///
  /// In en, this message translates to:
  /// **'Services you offer'**
  String get adminServicesOffered;

  /// No description provided for @adminServicesOfferedEmpty.
  ///
  /// In en, this message translates to:
  /// **'You do not offer any services yet. Create one to start receiving requests.'**
  String get adminServicesOfferedEmpty;

  /// No description provided for @adminServicesAvailable.
  ///
  /// In en, this message translates to:
  /// **'From the platform catalogue'**
  String get adminServicesAvailable;

  /// No description provided for @adminServicesCatalogueEmpty.
  ///
  /// In en, this message translates to:
  /// **'The service catalogue is empty for now.'**
  String get adminServicesCatalogueEmpty;

  /// No description provided for @adminServicesAllAdded.
  ///
  /// In en, this message translates to:
  /// **'You already offer every service in the catalogue.'**
  String get adminServicesAllAdded;

  /// No description provided for @adminServiceAdd.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get adminServiceAdd;

  /// No description provided for @adminServiceSaved.
  ///
  /// In en, this message translates to:
  /// **'Service saved.'**
  String get adminServiceSaved;

  /// No description provided for @adminServiceRemoved.
  ///
  /// In en, this message translates to:
  /// **'Service removed.'**
  String get adminServiceRemoved;

  /// No description provided for @adminServiceRemoveTitle.
  ///
  /// In en, this message translates to:
  /// **'Stop offering this service?'**
  String get adminServiceRemoveTitle;

  /// No description provided for @adminServiceRemoveBody.
  ///
  /// In en, this message translates to:
  /// **'Customers will no longer be able to request {name} from your company. Existing requests are kept.'**
  String adminServiceRemoveBody(String name);

  /// No description provided for @adminServicePriceHelper.
  ///
  /// In en, this message translates to:
  /// **'Leave empty if you do not want to show a price.'**
  String get adminServicePriceHelper;

  /// No description provided for @adminServiceNoteLabel.
  ///
  /// In en, this message translates to:
  /// **'Note for customers (optional)'**
  String get adminServiceNoteLabel;

  /// No description provided for @adminServiceNoteHint.
  ///
  /// In en, this message translates to:
  /// **'For example: done on site or remotely, what is included'**
  String get adminServiceNoteHint;

  /// No description provided for @companyServiceAlreadyOffered.
  ///
  /// In en, this message translates to:
  /// **'Your company already offers this service.'**
  String get companyServiceAlreadyOffered;

  /// No description provided for @companyServiceNotFound.
  ///
  /// In en, this message translates to:
  /// **'This service is no longer available.'**
  String get companyServiceNotFound;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
