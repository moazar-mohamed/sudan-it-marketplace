// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Sudan ICT Marketplace';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonConfirm => 'Confirm';

  @override
  String get commonSave => 'Save';

  @override
  String get commonSaveChanges => 'Save changes';

  @override
  String get commonEdit => 'Edit';

  @override
  String get commonDelete => 'Delete';

  @override
  String get commonDeactivate => 'Deactivate';

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonLoading => 'Loading…';

  @override
  String get commonSearch => 'Search';

  @override
  String get commonClear => 'Clear';

  @override
  String get commonCopy => 'Copy';

  @override
  String get commonQuantityIncrease => 'Increase quantity';

  @override
  String get commonQuantityDecrease => 'Decrease quantity';

  @override
  String get commonDone => 'Done';

  @override
  String get commonOr => 'OR';

  @override
  String get commonOptional => 'Optional';

  @override
  String get commonRemove => 'Remove';

  @override
  String get commonSignOut => 'Sign out';

  @override
  String get commonNotifications => 'Notifications';

  @override
  String get commonShowPassword => 'Show password';

  @override
  String get commonHidePassword => 'Hide password';

  @override
  String get commonLanguage => 'Language';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsLanguageSubtitle => 'Choose the language of the app';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageArabic => 'العربية';

  @override
  String get settingsLanguageSyncFailed =>
      'The language was changed on this device, but could not be saved to your account yet.';

  @override
  String get authWelcomeBack => 'Welcome back. Sign in to continue.';

  @override
  String get authEmail => 'Email';

  @override
  String get authPassword => 'Password';

  @override
  String get authLogin => 'Login';

  @override
  String get authRegister => 'Register';

  @override
  String get authForgotPassword => 'Forgot password?';

  @override
  String get authForgotPasswordTitle => 'Reset your password';

  @override
  String get authForgotPasswordBody =>
      'Enter the email you signed up with. We will send you a link to choose a new password.';

  @override
  String get authForgotPasswordSend => 'Send reset link';

  @override
  String get authForgotPasswordSentTitle => 'Check your email';

  @override
  String authForgotPasswordSentBody(String email) {
    return 'If an account exists for $email, we sent a link to reset its password. Check your spam folder too.';
  }

  @override
  String get authForgotPasswordResend => 'Resend email';

  @override
  String authForgotPasswordResendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get authForgotPasswordBackToLogin => 'Back to sign in';

  @override
  String get authForgotPasswordFailed =>
      'Could not send the reset email. Please try again.';

  @override
  String get authContinueWithGoogle => 'Continue with Google';

  @override
  String get authNoAccount => 'Don\'t have an account?';

  @override
  String get authHaveAccount => 'Already have an account?';

  @override
  String get authCreateAccount => 'Create account';

  @override
  String get authJoinTitle => 'Join Sudan ICT Marketplace';

  @override
  String get authCreateAccountSubtitle => 'Create an account to get started.';

  @override
  String get authFullName => 'Full Name';

  @override
  String get authConfirmPassword => 'Confirm Password';

  @override
  String get authPasswordHelper => 'At least 6 characters.';

  @override
  String get authEmailRequired => 'Email is required.';

  @override
  String get authEmailInvalid => 'Enter a valid email address.';

  @override
  String get authPasswordRequired => 'Password is required.';

  @override
  String get authFullNameRequired => 'Full name is required.';

  @override
  String get authFullNameInvalid =>
      'Full name may only contain letters and spaces.';

  @override
  String get authPasswordTooShort => 'Password must be at least 6 characters.';

  @override
  String get authConfirmPasswordRequired => 'Confirm password is required.';

  @override
  String get authPasswordsMismatch => 'Passwords do not match.';

  @override
  String get authAccountDeactivatedTitle => 'Account deactivated';

  @override
  String get authAccountDeactivatedMessage =>
      'Your account has been deactivated. Please contact support to have it reactivated.';

  @override
  String get authCompanyNotLinkedTitle => 'Company not linked';

  @override
  String get authCompanyAdminNotLinked =>
      'Your company admin account is not linked to a company yet. Please contact the platform administrator.';

  @override
  String get authTechnicianNotLinked =>
      'Your technician account is not linked to a company yet. Please contact your company administrator.';

  @override
  String get authPlatformAdminTitle => 'Platform Admin';

  @override
  String get authPlatformAdminMessage =>
      'Platform administration is managed separately and is not available in this app.';

  @override
  String get authTechnicianAccountTitle => 'Technician account';

  @override
  String get authTechnicianNotSetUp =>
      'Your technician account is not yet set up. Please contact your company administrator.';

  @override
  String get authTechnicianDeactivated =>
      'Your technician account has been deactivated. Please contact your company administrator.';

  @override
  String get authTechnicianLoadFailed =>
      'Could not load your technician record. Please try again or contact your company administrator.';

  @override
  String get authVerifyEmailTitle => 'Verify your email';

  @override
  String get authVerifyEmailGeneric =>
      'Please verify your email address before continuing.';

  @override
  String authVerifyEmailSent(String email) {
    return 'We sent a verification link to $email. Please verify your email before continuing.';
  }

  @override
  String get authVerifyEmailResent =>
      'Verification email sent. Please check your inbox.';

  @override
  String get authVerifyEmailStillNot =>
      'Still not verified. Please tap the link in the email, then try again.';

  @override
  String get authVerifiedMyEmail => 'I\'ve verified my email';

  @override
  String get authResendVerification => 'Resend verification email';

  @override
  String get authSignedInTitle => 'You are signed in';

  @override
  String get authDashboardLater => 'Customer dashboard will be added later.';

  @override
  String get authErrorEmailInUse => 'This email is already registered.';

  @override
  String get authErrorWeakPassword => 'Choose a stronger password.';

  @override
  String get authErrorInvalidCredentials => 'Invalid email or password.';

  @override
  String get authErrorUserDisabled => 'This account has been disabled.';

  @override
  String get authErrorTooManyRequests =>
      'Too many attempts. Please wait and try again.';

  @override
  String get authErrorNetwork =>
      'Network error. Check your connection and try again.';

  @override
  String get authErrorOperationNotAllowed =>
      'Email and password sign-in is not enabled.';

  @override
  String get authErrorCancelled => 'Sign-in was cancelled.';

  @override
  String get authErrorDifferentCredential =>
      'An account already exists with a different sign-in method for this email.';

  @override
  String get authErrorGoogleFailed =>
      'Google sign-in failed. Please try again.';

  @override
  String get authErrorGoogleReauth =>
      'Google needs you to sign in to your account again on this device. Remove your Google account in the device settings, add it again, then try again.';

  @override
  String get authErrorGoogleConfig =>
      'Google sign-in is not set up for this version of the app. Please contact support.';

  @override
  String get authErrorPopupBlocked =>
      'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';

  @override
  String get authErrorUnauthorizedDomain =>
      'Google sign-in is not enabled for this website address.';

  @override
  String get authErrorGeneric => 'Authentication failed. Please try again.';

  @override
  String get authErrorSendVerification =>
      'Could not send the verification email. Please try again.';

  @override
  String get authErrorNotAuthenticated => 'Not authenticated.';

  @override
  String get errorProfileSave =>
      'Could not save your profile. Please try again.';

  @override
  String get errorProfileLoad =>
      'Could not load your profile. Please try again.';

  @override
  String get errorProfileLoadDenied =>
      'Could not load your profile: access was denied. Please try again later or contact support.';

  @override
  String get errorProfileLoadOffline =>
      'Could not load your profile. Check your internet connection and try again.';

  @override
  String get errorProfileUpdate =>
      'Could not update your profile. Please try again.';

  @override
  String get errorProfileNoEmail =>
      'Your account has no email on file, so a profile could not be created. Please contact support.';

  @override
  String get errorProfileNotFound => 'Your profile could not be found.';

  @override
  String get errorSetupAccount =>
      'Could not finish setting up your account. Please try again.';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get errorPermissionDenied => 'You do not have permission to do this.';

  @override
  String get errorNetwork => 'Check your internet connection and try again.';

  @override
  String get passwordChangeTitle => 'Choose a new password';

  @override
  String get passwordChangeIntro =>
      'You signed in with a temporary password. Choose your own password to continue.';

  @override
  String get passwordChangeTemporary => 'Temporary password';

  @override
  String get passwordChangeNew => 'New password';

  @override
  String get passwordChangeConfirm => 'Confirm new password';

  @override
  String get passwordChangeSubmit => 'Change password';

  @override
  String get passwordChangeCurrentRequired => 'Enter your temporary password.';

  @override
  String get passwordChangeNewRequired => 'Enter a new password.';

  @override
  String passwordChangeTooShort(int min) {
    return 'The password must be at least $min characters.';
  }

  @override
  String get passwordChangeMismatch => 'The passwords do not match.';

  @override
  String get passwordErrorCurrentWrong => 'Current password is incorrect.';

  @override
  String get passwordErrorNewWeak =>
      'New password is too weak. Use at least 6 characters.';

  @override
  String get passwordErrorRecentLogin =>
      'Please sign out and sign back in before changing your password.';

  @override
  String get passwordErrorGeneric =>
      'Could not change password. Please try again.';

  @override
  String get imageLabel => 'Image';

  @override
  String get imageAdd => 'Add Image';

  @override
  String get imageChange => 'Change Image';

  @override
  String get imageChooseFromDevice => 'Choose from device';

  @override
  String get imageTakePhoto => 'Take a photo';

  @override
  String get imageUseUrl => 'Use image URL';

  @override
  String get imageUrl => 'Image URL';

  @override
  String get imageUploading => 'Uploading image';

  @override
  String get imageUploadFailed => 'Failed to upload image';

  @override
  String get imageEmptyUrl => 'Enter the image URL.';

  @override
  String get imageInvalidUrl => 'Enter a valid image link (http/https).';

  @override
  String get imageUnsupported =>
      'Unsupported image. Use a JPG, PNG, WebP or GIF file.';

  @override
  String get imageTooLarge =>
      'This image is too large. The maximum size is 5 MB.';

  @override
  String get imageCameraDenied =>
      'Camera permission was denied. Allow camera access in settings to take a photo.';

  @override
  String get imageGalleryDenied =>
      'Photo access was denied. Allow photo access in settings to choose an image.';

  @override
  String get imageCameraUnavailable =>
      'The camera is not available on this device.';

  @override
  String get imagePickFailed => 'Could not open the image. Please try again.';

  @override
  String get locationTitle => 'Location';

  @override
  String get locationEnterAddress => 'Enter address';

  @override
  String get locationSelectOnMap => 'Select on Map';

  @override
  String get locationUseCurrent => 'Use My Current Location';

  @override
  String get locationConfirm => 'Confirm Location';

  @override
  String get locationChange => 'Change Location';

  @override
  String get locationRemoveMap => 'Remove map location';

  @override
  String get locationViewOnMap => 'View on Map';

  @override
  String get locationOpenOrder => 'Open Order Location';

  @override
  String get locationOpenCompany => 'Open Company Location';

  @override
  String get locationViewCompany => 'View Company Location';

  @override
  String get locationOpenDelivery => 'Open Delivery Location';

  @override
  String get locationSearchAddress => 'Search Address on Map';

  @override
  String get locationOpenInMaps => 'Open in Maps app';

  @override
  String get locationSelected => 'Location selected';

  @override
  String get locationLatShort => 'Lat';

  @override
  String get locationLngShort => 'Lng';

  @override
  String get locationTapToSelect =>
      'Tap the map to choose the exact point. Tap again to move it.';

  @override
  String get locationPinned => 'Pinned on map';

  @override
  String get locationAddressApproximate =>
      'Written address only (no exact map point)';

  @override
  String get locationRequired =>
      'Enter an address or select a location on the map.';

  @override
  String get locationCouldNotOpenMaps => 'Could not open the maps app.';

  @override
  String get locationServiceOff =>
      'Location services are turned off. You can still tap the map.';

  @override
  String get locationPermissionDenied =>
      'Location permission was denied. You can still tap the map or type an address.';

  @override
  String get locationPermissionDeniedForever =>
      'Location permission is blocked in settings. You can still tap the map.';

  @override
  String get locationCurrentUnavailable =>
      'Could not get your current location. You can still tap the map.';

  @override
  String get productPriceOnRequest => 'Price on request';

  @override
  String get orderCreateDenied =>
      'You do not have permission to place this order. Please sign in again and try again.';

  @override
  String get orderCreateNetwork =>
      'The order could not be confirmed. Check your internet connection and try again.';

  @override
  String get orderCreateFailed =>
      'Failed to create the order. Please try again.';

  @override
  String get orderNotConfirmed =>
      'Your order could not be confirmed. Check your connection and try again.';

  @override
  String orderProductNoPrice(String productName) {
    return '$productName has no listed price yet. Please contact the company to order it.';
  }

  @override
  String get orderAttachReceiptFailed =>
      'Could not attach the receipt. Please try again.';

  @override
  String get orderFetchFailed => 'Could not load the order. Please try again.';

  @override
  String get orderUpdateStatusDenied =>
      'You do not have permission to update the status of this order.';

  @override
  String get orderUpdateStatusFailed =>
      'Could not update the order status. Please try again.';

  @override
  String get orderConfirmPaymentDenied =>
      'You do not have permission to confirm the payment for this order.';

  @override
  String get orderConfirmPaymentFailed =>
      'Could not confirm the payment. Please try again.';

  @override
  String get orderAssignTechnicianDenied =>
      'You do not have permission to assign a technician to this order.';

  @override
  String get orderAssignTechnicianFailed =>
      'Could not assign the technician. Please try again.';

  @override
  String get stockNoLongerAvailable => 'This product is no longer available.';

  @override
  String get stockChooseAtLeastOne => 'Choose at least one unit to order.';

  @override
  String stockOutOfStock(String productName) {
    return '$productName is out of stock.';
  }

  @override
  String stockOnlyLeft(int available, String productName) {
    return 'Only $available of $productName left in stock. Please reduce the quantity.';
  }

  @override
  String get productSaveDenied =>
      'You do not have permission to save this product.';

  @override
  String get productSaveFailed =>
      'Could not save the product. Please try again.';

  @override
  String get productUpdateDenied =>
      'You do not have permission to update this product.';

  @override
  String get productUpdateFailed =>
      'Could not update the product. Please try again.';

  @override
  String get productDeleteDenied =>
      'You do not have permission to delete this product.';

  @override
  String get productDeleteFailed =>
      'Could not delete the product. Please try again.';

  @override
  String get technicianSaveDenied =>
      'You do not have permission to save this technician.';

  @override
  String get technicianSaveFailed =>
      'Could not save the technician. Please try again.';

  @override
  String get technicianUpdateDenied =>
      'You do not have permission to update this technician.';

  @override
  String get technicianUpdateFailed =>
      'Could not update the technician. Please try again.';

  @override
  String get technicianDeactivateDenied =>
      'You do not have permission to deactivate this technician.';

  @override
  String get technicianDeactivateFailed =>
      'Could not deactivate the technician. Please try again.';

  @override
  String get companyUpdateDenied =>
      'You do not have permission to edit this company.';

  @override
  String get companyUpdateFailed =>
      'Could not update the company profile. Please try again.';

  @override
  String get navHome => 'Home';

  @override
  String get navDashboard => 'Dashboard';

  @override
  String get navProducts => 'Products';

  @override
  String get navCompanies => 'Companies';

  @override
  String get navOrders => 'Orders';

  @override
  String get navProfile => 'Profile';

  @override
  String get navMyOrders => 'My Orders';

  @override
  String reviewsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count reviews',
      one: '1 review',
      zero: 'no reviews',
    );
    return '($_temp0)';
  }

  @override
  String get commonPhoneInvalid => 'Enter a valid phone number.';

  @override
  String get commonViewOrderStatus => 'View Order Status';

  @override
  String get homeSearchProducts => 'Search products...';

  @override
  String get homeSearchCompanies => 'Search companies...';

  @override
  String get homeNoProducts => 'No products found';

  @override
  String get homeNoCompanies => 'No companies found';

  @override
  String productInStockCount(int count) {
    return 'In Stock ($count)';
  }

  @override
  String get productOutOfStock => 'Out of Stock';

  @override
  String get productVerifiedSeller => 'Verified Seller';

  @override
  String get productInstallationAvailable =>
      'Professional Installation Available';

  @override
  String productInstallationNote(String price, String currency) {
    return 'Installation price: $price $currency. On-site setup option is selected during checkout.';
  }

  @override
  String get productDescription => 'Description';

  @override
  String get productSpecifications => 'Specifications';

  @override
  String get productBuyNow => 'Buy Now';

  @override
  String productBuyNowPrice(String price, String currency) {
    return 'Buy Now • $price $currency';
  }

  @override
  String get companyAbout => 'About Company';

  @override
  String companyProductsCount(int count) {
    return 'Products ($count)';
  }

  @override
  String get companyNoProducts => 'No products listed by this company yet.';

  @override
  String get checkoutTitle => 'Checkout';

  @override
  String checkoutUnit(String price, String currency) {
    return 'Unit: $price $currency';
  }

  @override
  String checkoutQty(int count) {
    return 'Qty: $count';
  }

  @override
  String checkoutSubtotal(String price, String currency) {
    return 'Subtotal: $price $currency';
  }

  @override
  String get checkoutDeliveryContact => 'Delivery & Contact';

  @override
  String get checkoutPickupContact => 'Pickup & Contact';

  @override
  String get checkoutDelivery => 'Delivery';

  @override
  String get checkoutPickup => 'Pickup';

  @override
  String get checkoutPickupLocation => 'Pickup Location';

  @override
  String get checkoutPickupFallback =>
      'Company pickup location (the company will confirm by phone)';

  @override
  String get checkoutAddressHint =>
      'Street name, building/house, neighborhood, city';

  @override
  String get checkoutContactPhone => 'Contact Phone Number';

  @override
  String get checkoutContactPhoneHelper =>
      'The company will call this number to coordinate delivery';

  @override
  String get checkoutPhoneRequired => 'Please enter a contact phone number';

  @override
  String get checkoutInstallationOption => 'Installation Option';

  @override
  String get checkoutInstallationTitle => 'On-site Professional Installation';

  @override
  String checkoutInstallationNote(String price, String currency) {
    return 'Certified technician setup available for $price $currency.';
  }

  @override
  String get checkoutProductOnly => 'Product Only';

  @override
  String get checkoutProductInstallation => 'Product + Installation';

  @override
  String get checkoutPriceSummary => 'Price Summary';

  @override
  String checkoutProductSubtotal(int count) {
    return 'Product Subtotal ($count items)';
  }

  @override
  String get checkoutInstallationService => 'Installation Service';

  @override
  String get checkoutNotIncluded => 'Not included';

  @override
  String get checkoutDeliveryFee => 'Delivery Fee';

  @override
  String get checkoutFinalTotal => 'Final Total';

  @override
  String checkoutConfirmOrder(String price, String currency) {
    return 'Confirm Order • $price $currency';
  }

  @override
  String get paymentTitle => 'Manual Payment';

  @override
  String paymentCopied(String label) {
    return '$label copied to clipboard';
  }

  @override
  String get paymentAccountNumberLabel => 'Account number';

  @override
  String get paymentPhoneNumberLabel => 'Phone number';

  @override
  String get paymentReceiptRequired =>
      'Please upload or select a transfer receipt image before submitting.';

  @override
  String get paymentSubmitFailed =>
      'Could not submit your receipt. Please try again.';

  @override
  String get paymentAmountToTransfer => 'Amount to Transfer';

  @override
  String get paymentOrderCreatedAfter =>
      'Your order will be created after receipt submission.';

  @override
  String get paymentInstructions =>
      'Please transfer the exact amount externally using your mobile banking app (Bankak, Fawry, etc.) or cash transfer. After completing the payment, upload a screenshot of your transfer receipt below.';

  @override
  String get paymentAccounts => 'Payment Accounts';

  @override
  String get paymentUploadReceipt => 'Upload Transfer Receipt';

  @override
  String get paymentUploadHint =>
      'Upload a clear screenshot or photo of your transfer notification slip.';

  @override
  String get paymentTapToUpload => 'Tap to Upload Receipt / Screenshot';

  @override
  String get paymentSupports =>
      'Supports JPG, PNG, or screenshot from Bankak/Fawry';

  @override
  String get receiptPreparing => 'Preparing image…';

  @override
  String get receiptTooLarge =>
      'This image is still too large after compression. Please choose a smaller one.';

  @override
  String get receiptUnreadable =>
      'This file could not be read as an image. Choose a photo or screenshot of your receipt.';

  @override
  String get receiptViewTitle => 'Payment receipt';

  @override
  String get receiptView => 'View receipt';

  @override
  String get receiptNone => 'No receipt image is available for this order.';

  @override
  String get receiptLoadFailed =>
      'Could not load the receipt. Check your connection and try again.';

  @override
  String get paymentReceiptSelected => 'Receipt Selected';

  @override
  String get paymentReplace => 'Replace';

  @override
  String get paymentPendingNote =>
      'Submitting this receipt saves the transfer reference as \"Pending Verification\". Payment will be marked Confirmed after the company verifies it.';

  @override
  String get paymentSubmitting => 'Submitting...';

  @override
  String get paymentSubmit => 'Submit Receipt for Verification';

  @override
  String get paymentAccountName => 'Account Name';

  @override
  String get paymentAccountMban => 'Account / MBAN';

  @override
  String get paymentPhoneIdentifier => 'Phone Identifier';

  @override
  String get ordersLoadFailed => 'Could not load orders';

  @override
  String get ordersRetry => 'Retry';

  @override
  String get ordersEmptyTitle => 'No Orders Yet';

  @override
  String get ordersEmptyBody =>
      'When you purchase IT hardware or products from the marketplace, your orders and their live status will be tracked here.';

  @override
  String orderTitleNumber(String id) {
    return 'Order #$id';
  }

  @override
  String get orderTotalAmount => 'Total Amount';

  @override
  String get orderDetailsButton => 'Details';

  @override
  String get orderItemOrdered => 'Item Ordered';

  @override
  String orderUnitLine(String price) {
    return 'Unit: $price SDG';
  }

  @override
  String orderQtyLine(int count) {
    return 'Qty: $count';
  }

  @override
  String orderSubtotalLine(String price) {
    return 'Subtotal: $price SDG';
  }

  @override
  String get orderPickupDetails => 'Pickup Details';

  @override
  String get orderDeliveryDetails => 'Delivery Details';

  @override
  String get orderAddress => 'Address';

  @override
  String get orderContactPhone => 'Contact Phone';

  @override
  String get orderType => 'Order Type';

  @override
  String orderTypeInstallation(String fee) {
    return 'Product + Installation (+$fee SDG)';
  }

  @override
  String get orderDeliveryFee => 'Delivery Fee';

  @override
  String get orderOrderedAt => 'Ordered At';

  @override
  String get orderPaymentStatus => 'Payment Status';

  @override
  String get orderStatusLabel => 'Status';

  @override
  String get orderReceiptAttached => 'Receipt Attached';

  @override
  String get orderProductSubtotal => 'Product Subtotal';

  @override
  String get orderInstallationFee => 'Installation Fee';

  @override
  String get orderTotal => 'Total';

  @override
  String get orderOrderStatus => 'Order Status';

  @override
  String get pendingBanner => 'PENDING VERIFICATION';

  @override
  String get pendingTitle => 'Receipt Submitted for Verification';

  @override
  String get pendingBody =>
      'Your transfer receipt reference has been saved. It is awaiting confirmation from the company. Payment will be marked Confirmed only after manual verification.';

  @override
  String get pendingOrderReference => 'Order Reference';

  @override
  String get pendingDeliveryAddress => 'Delivery Address';

  @override
  String get pendingInstallation => 'Installation';

  @override
  String pendingInstallationIncluded(String fee) {
    return 'Included ($fee SDG)';
  }

  @override
  String get pendingUploaded => 'Uploaded';

  @override
  String get pendingTotalAmount => 'Total Amount';

  @override
  String get pendingBackToMarketplace => 'Back to Marketplace';

  @override
  String get pendingViewInMyOrders => 'View in My Orders';

  @override
  String get orderStatusProcessing => 'Processing';

  @override
  String get orderStatusOutForDelivery => 'Out for Delivery';

  @override
  String get orderStatusCompleted => 'Completed';

  @override
  String get paymentStatusPending => 'Pending Verification';

  @override
  String get paymentStatusConfirmed => 'Confirmed';

  @override
  String get deliveryMethodDelivery => 'Delivery';

  @override
  String get deliveryMethodPickup => 'Pickup';

  @override
  String get jobStatusPending => 'Pending';

  @override
  String get jobStatusInProgress => 'In Progress';

  @override
  String customerFallback(String id) {
    return 'Customer $id';
  }

  @override
  String get profileMyProfile => 'My profile';

  @override
  String get profileFullName => 'Full name';

  @override
  String get profilePhoneNumber => 'Phone number';

  @override
  String get profileFullNameRequired => 'Enter your full name.';

  @override
  String get profileEdit => 'Edit profile';

  @override
  String get profileUpdated => 'Profile updated successfully.';

  @override
  String get profileChangePassword => 'Change password';

  @override
  String get profileChangePasswordSubtitle => 'Update your account password';

  @override
  String get profileCurrentPassword => 'Current password';

  @override
  String get profileCurrentPasswordRequired => 'Enter your current password.';

  @override
  String get profilePasswordMin => 'Use at least 6 characters.';

  @override
  String get profileConfirmPasswordRequired => 'Confirm your new password.';

  @override
  String get profileUpdatePassword => 'Update password';

  @override
  String get profilePasswordChanged => 'Password changed successfully.';

  @override
  String get notificationsLoadFailed => 'Could not load notifications.';

  @override
  String get notificationsEmpty => 'No notifications yet.';

  @override
  String get notifNewOrderTitle => 'New order received';

  @override
  String notifNewOrderBody(String product) {
    return 'A new order for \"$product\" was placed and is awaiting payment verification.';
  }

  @override
  String get notifPaymentConfirmedTitle => 'Payment confirmed';

  @override
  String notifPaymentConfirmedBody(String product) {
    return 'Your payment for \"$product\" has been confirmed.';
  }

  @override
  String get notifOutForDeliveryTitle => 'Order out for delivery';

  @override
  String notifOutForDeliveryBody(String product) {
    return 'Your order \"$product\" is out for delivery.';
  }

  @override
  String get notifOrderCompletedTitle => 'Order completed';

  @override
  String get notifOrderCompletedBody => 'Your order has been completed.';

  @override
  String get notifTechnicianAssignedTitle => 'New installation job assigned';

  @override
  String notifTechnicianAssignedBody(String product) {
    return 'You have been assigned to install \"$product\".';
  }

  @override
  String get navTechnicians => 'Technicians';

  @override
  String get adminInstallationJobs => 'Installation Jobs';

  @override
  String get adminNavInstallations => 'Installations';

  @override
  String get adminCompanyProfile => 'Company Profile';

  @override
  String get adminCompanyDashboard => 'Company Dashboard';

  @override
  String get techShellDashboard => 'Technician Dashboard';

  @override
  String get techShellJobs => 'My Jobs';

  @override
  String get techNavJobs => 'Jobs';

  @override
  String get adminWelcome => 'Welcome';

  @override
  String get adminDashboardOverview => 'Overview of your products and orders';

  @override
  String get adminTotalProducts => 'Total Products';

  @override
  String get adminTotalOrders => 'Total Orders';

  @override
  String get adminPendingOrders => 'Pending Orders';

  @override
  String get adminRecentOrders => 'Recent Orders';

  @override
  String get adminViewAll => 'View all';

  @override
  String get adminOrdersLoadFailedShort => 'Could not load orders.';

  @override
  String get adminNoOrdersYet => 'No orders yet.';

  @override
  String get orderDetailsTitle => 'Order Details';

  @override
  String get adminOrderNotFound => 'This order was not found.';

  @override
  String get adminJobNotFound => 'This job was not found.';

  @override
  String get adminProductNotFound => 'This product was not found.';

  @override
  String get adminOrdersLoadFailed => 'Could not load your orders.';

  @override
  String adminFilterAll(int count) {
    return 'All ($count)';
  }

  @override
  String adminFilterStatus(String status, int count) {
    return '$status ($count)';
  }

  @override
  String get adminNoOrdersToShow => 'No orders to show.';

  @override
  String adminQtyShort(int count) {
    return 'Qty $count';
  }

  @override
  String get adminCustomer => 'Customer';

  @override
  String get adminName => 'Name';

  @override
  String get adminProduct => 'Product';

  @override
  String get adminQuantity => 'Quantity';

  @override
  String get adminUnitPrice => 'Unit Price';

  @override
  String get adminMethod => 'Method';

  @override
  String get adminSelection => 'Selection';

  @override
  String get adminJobStatus => 'Job Status';

  @override
  String get adminPayment => 'Payment';

  @override
  String get adminReceiptReference => 'Receipt Reference';

  @override
  String get adminNotProvided => 'Not provided';

  @override
  String get adminOrderInformation => 'Order Information';

  @override
  String get adminOrderNumber => 'Order Number';

  @override
  String get adminCreated => 'Created';

  @override
  String get adminLastUpdated => 'Last Updated';

  @override
  String get adminCurrentStatus => 'Current Status';

  @override
  String get adminManageOrder => 'Manage Order';

  @override
  String get adminVerifyReceipt =>
      'Verify the transfer receipt before processing this order.';

  @override
  String get adminConfirmPaymentTitle => 'Confirm payment';

  @override
  String adminConfirmPaymentBody(String id) {
    return 'Mark the payment for order #$id as confirmed?';
  }

  @override
  String get adminPaymentConfirmed => 'Payment confirmed.';

  @override
  String get adminConfirmPaymentButton => 'Confirm Payment';

  @override
  String get adminOrderCompleted => 'This order is completed.';

  @override
  String get adminMarkCompletedHint =>
      'Mark completed once the technician has finished the installation.';

  @override
  String get adminUpdateOrderStatus => 'Update order status';

  @override
  String adminChangeOrderStatusBody(String id, String status) {
    return 'Change order #$id to \"$status\"? This cannot be undone.';
  }

  @override
  String adminOrderMarked(String status) {
    return 'Order marked $status.';
  }

  @override
  String get adminMarkOutForDelivery => 'Mark Out for Delivery';

  @override
  String get adminMarkCompletedInstalled => 'Mark Completed (Installed)';

  @override
  String get adminMarkCompleted => 'Mark Completed';

  @override
  String get adminMarkProcessing => 'Mark Processing';

  @override
  String get adminInstallationJobsLoadFailed =>
      'Could not load installation jobs.';

  @override
  String get adminInstallationJobsEmpty =>
      'No installation jobs yet.\nOrders with Product + Installation appear here.';

  @override
  String get adminInstallationJob => 'Installation Job';

  @override
  String adminJobTitleNumber(String id) {
    return 'Job #$id';
  }

  @override
  String get adminJobDetails => 'Job Details';

  @override
  String get adminJobOrderNumber => 'Job / Order Number';

  @override
  String get adminCustomerLocation => 'Customer & Location';

  @override
  String get adminInstallationAddress => 'Installation Address';

  @override
  String get adminLocation => 'Location';

  @override
  String get adminCustomerPickupConfirm =>
      'Customer pickup — confirm the installation location by phone';

  @override
  String get adminCustomerPickupConfirmShort =>
      'Customer pickup — confirm the location by phone';

  @override
  String get adminCustomerPickup => 'Customer pickup';

  @override
  String get adminViewFullOrder => 'View full order';

  @override
  String get adminTechnicianAssigned => 'Technician assigned.';

  @override
  String get adminAssignTechnician => 'Assign Technician';

  @override
  String get adminChangeTechnician => 'Change Technician';

  @override
  String get adminTechnicianSection => 'Technician';

  @override
  String get adminAssignedTo => 'Assigned to';

  @override
  String get adminNotAssigned => 'Not assigned';

  @override
  String get adminTechniciansLoadFailedShort => 'Could not load technicians.';

  @override
  String get adminAddTechnicianFirst =>
      'Add a technician first to assign this job.';

  @override
  String get adminAddProduct => 'Add Product';

  @override
  String get adminEditProduct => 'Edit Product';

  @override
  String get adminProductsLoadFailed => 'Could not load your products.';

  @override
  String get adminProductsEmpty =>
      'You have not added any products yet.\nTap \"Add Product\" to create your first one.';

  @override
  String adminInStock(int count) {
    return 'In stock: $count';
  }

  @override
  String get adminUnavailable => 'Unavailable';

  @override
  String get adminOutOfStock => 'Out of stock';

  @override
  String get adminInstallationBadge => 'Installation';

  @override
  String get adminPickupOnlyBadge => 'Pickup only';

  @override
  String get adminDeleteProduct => 'Delete product';

  @override
  String adminDeleteProductBody(String name) {
    return 'Delete \"$name\"? This cannot be undone.';
  }

  @override
  String get adminProductDeleted => 'Product deleted.';

  @override
  String get adminProductDetails => 'Product Details';

  @override
  String get adminEditProductTooltip => 'Edit product';

  @override
  String get adminAvailability => 'Availability';

  @override
  String get adminStatus => 'Status';

  @override
  String get adminAvailable => 'Available';

  @override
  String get adminNotAvailable => 'Not available';

  @override
  String get adminNotAvailablePickup => 'Not available (pickup only)';

  @override
  String get adminStock => 'Stock';

  @override
  String get adminDeliveryInstallation => 'Delivery & Installation';

  @override
  String get adminInstallationPrice => 'Installation Price';

  @override
  String get formProductAdded => 'Product added.';

  @override
  String get formProductUpdated => 'Product updated.';

  @override
  String get formProductName => 'Product Name';

  @override
  String get formProductNameRequired => 'Product name is required.';

  @override
  String get formCategoryLabel => 'Category';

  @override
  String adminUnitsLeft(int count) {
    return '$count left';
  }

  @override
  String get adminStockLow => 'Low stock';

  @override
  String get adminAttentionRestock => 'Restock';

  @override
  String get adminAttentionAssignTechnician => 'Assign technician';

  @override
  String get adminAttentionVerifyPayment => 'Verify payment';

  @override
  String get adminQuickTechnician => 'Technician';

  @override
  String get adminQuickService => 'Service';

  @override
  String get adminQuickProduct => 'Product';

  @override
  String get adminStatLowStock => 'Low stock';

  @override
  String get adminStatSalesWeek => 'Sales this week';

  @override
  String get adminStatNewOrders => 'New orders';

  @override
  String get adminNothingToDo => 'Nothing needs your attention right now.';

  @override
  String get adminNeedsAttention => 'Needs your attention';

  @override
  String get adminMenuTitle => 'Menu';

  @override
  String get adminSearchOrders => 'Search by product or customer';

  @override
  String get adminSearchProducts => 'Search products';

  @override
  String get adminServiceOwnBadge => 'Created by you';

  @override
  String get adminServiceCategoryInvalid => 'Choose a valid category.';

  @override
  String get adminServiceCategoryRequired => 'Choose a category.';

  @override
  String get adminServiceDescriptionLabel => 'Description';

  @override
  String get adminServiceNameRequired => 'Service name is required.';

  @override
  String get adminServiceNameLabel => 'Service name';

  @override
  String get adminServiceFormEditTitle => 'Edit service';

  @override
  String get adminServiceCreateFirst => 'Create your first service';

  @override
  String get adminServiceNew => 'New service';

  @override
  String get adminServicesYours => 'Your services';

  @override
  String get formCategoryInactiveSuffix => '(inactive)';

  @override
  String get formCategoryNone => 'No category';

  @override
  String get homeFilterAllCategories => 'All';

  @override
  String get homeCategoriesTitle => 'Categories';

  @override
  String get homeCategoriesMore => 'More';

  @override
  String get adminProductUncategorized => 'No category';

  @override
  String get formPriceOptional => 'Price (SDG) - optional';

  @override
  String get formPriceInvalid => 'Enter a valid price greater than 0.';

  @override
  String get formInstallationPriceRequired => 'Installation price is required.';

  @override
  String get formInstallationPriceInvalid =>
      'Enter a valid installation price greater than 0.';

  @override
  String get formStockSection => 'Stock / Availability';

  @override
  String get formStockQuantity => 'Stock Quantity';

  @override
  String get formStockRequired => 'Enter the stock quantity (0 or more).';

  @override
  String get formAvailableForSale => 'Available for sale';

  @override
  String get formAvailableHint =>
      'Customers can buy this product while it has stock.';

  @override
  String get formSpecName => 'Name';

  @override
  String get formSpecValue => 'Value';

  @override
  String get formAddSpec => 'Add specification';

  @override
  String get formDeliveryAvailable => 'Delivery Available';

  @override
  String get formDeliveryOn => 'Customers can choose delivery at checkout.';

  @override
  String get formDeliveryOff =>
      'Customers collect this product from your pickup location.';

  @override
  String get formInstallationAvailable => 'Installation Available';

  @override
  String get formInstallationOn =>
      'Customers can choose Product + Installation.';

  @override
  String get formInstallationOff =>
      'Customers will not see any installation option.';

  @override
  String get formInstallationPrice => 'Installation Price (SDG)';

  @override
  String get adminCompanyLoadFailed => 'Could not load your company profile.';

  @override
  String get adminCompanyNotFound =>
      'Your company record was not found. Please contact the platform administrator.';

  @override
  String get adminContact => 'Contact';

  @override
  String get adminPhone => 'Phone';

  @override
  String get adminCity => 'City';

  @override
  String get adminEditCompanyProfile => 'Edit Company Profile';

  @override
  String get adminCompanyProfileUpdated => 'Company profile updated.';

  @override
  String get adminCompanyName => 'Company Name';

  @override
  String get adminCompanyNameRequired => 'Company name is required.';

  @override
  String get adminPickupAddress => 'Pickup Location / Address';

  @override
  String get adminShortDescription => 'Short Description';

  @override
  String get adminAddTechnician => 'Add Technician';

  @override
  String get adminEditTechnician => 'Edit Technician';

  @override
  String get adminDeactivateTechnician => 'Deactivate technician';

  @override
  String adminDeactivateTechnicianBody(String name) {
    return 'Deactivate \"$name\"? They will no longer be available for new installation jobs.';
  }

  @override
  String get adminTechnicianDeactivated => 'Technician deactivated.';

  @override
  String get adminTechniciansLoadFailed => 'Could not load your technicians.';

  @override
  String get adminTechniciansEmpty =>
      'You have not added any technicians yet.\nTap \"Add Technician\" to create your first technician account.';

  @override
  String get adminActive => 'Active';

  @override
  String get adminInactive => 'Inactive';

  @override
  String get adminTechnicianUpdated => 'Technician updated.';

  @override
  String get adminTechnicianNameRequired => 'Technician name is required.';

  @override
  String get adminPhoneRequired => 'Phone number is required.';

  @override
  String get adminTechnicianEmailRequired => 'Technician email is required.';

  @override
  String get adminInactiveTechnicianNote =>
      'Inactive technicians cannot be assigned to new jobs.';

  @override
  String get techDashboardLoadFailed => 'Could not load your dashboard.';

  @override
  String techWelcome(String name) {
    return 'Welcome, $name';
  }

  @override
  String get techTotalJobs => 'Total Jobs';

  @override
  String get techUpcomingJobs => 'Upcoming Jobs';

  @override
  String get techNoPendingJobs => 'No pending jobs right now.';

  @override
  String get techJobsLoadFailed => 'Could not load your jobs.';

  @override
  String get techNoJobsAssigned => 'No installation jobs assigned to you yet.';

  @override
  String get techJobCompleted => 'This job is completed.';

  @override
  String get techUpdateJobStatus => 'Update job status';

  @override
  String techChangeJobBody(String id, String status) {
    return 'Change job #$id to \"$status\"? This cannot be undone.';
  }

  @override
  String techJobMarked(String status) {
    return 'Job marked $status.';
  }

  @override
  String get techMarkInstallationCompleted => 'Mark Installation Completed';

  @override
  String get techProfileLoadFailed => 'Could not load your profile.';

  @override
  String get techCompany => 'Company';

  @override
  String get techMyDetails => 'My Details';

  @override
  String get techEditName => 'Edit name';

  @override
  String comingSoonTitle(String title) {
    return '$title is coming soon';
  }

  @override
  String get paymentAccountsManage => 'Payment accounts';

  @override
  String get paymentAccountsIntro =>
      'Customers transfer their order payments to these accounts. Add at least one so customers can pay you.';

  @override
  String get paymentAccountsEmpty => 'No payment accounts yet.';

  @override
  String get paymentAccountAdd => 'Add account';

  @override
  String get paymentAccountEdit => 'Edit account';

  @override
  String get paymentAccountBankName => 'Bank / wallet name';

  @override
  String get paymentAccountBankRequired => 'Enter the bank or wallet name.';

  @override
  String get paymentAccountHolderRequired => 'Enter the account holder name.';

  @override
  String get paymentAccountNumberRequired => 'Enter the account number.';

  @override
  String get paymentAccountPhoneOptional => 'Linked phone number (optional)';

  @override
  String get paymentAccountSaved => 'Payment account saved.';

  @override
  String get paymentAccountRemoved => 'Payment account removed.';

  @override
  String get paymentAccountRemoveTitle => 'Remove this account?';

  @override
  String get paymentAccountRemoveBody =>
      'Customers will no longer see it on the payment screen.';

  @override
  String paymentAccountLimit(int max) {
    return 'You can add up to $max accounts.';
  }

  @override
  String get paymentNoAccountsForCompany =>
      'This company has not added payment accounts yet, so it cannot receive a payment right now. Please contact the company.';

  @override
  String get adminTechnicianAccountNote =>
      'This creates the technician\'s account with a temporary password. Give them this email and password; they choose their own password the first time they sign in.';

  @override
  String get adminTechnicianTempPassword => 'Temporary password';

  @override
  String get adminTechnicianPasswordRequired => 'Enter a temporary password.';

  @override
  String get adminAddTechnicianSubmit => 'Add technician';

  @override
  String get adminTechnicianCreated =>
      'Technician added. Share the email and temporary password with them.';

  @override
  String get technicianEmailInUse =>
      'An account with this email already exists.';

  @override
  String get technicianEmailInvalid => 'This email address is not valid.';

  @override
  String get technicianPasswordWeak =>
      'The temporary password is too weak. Choose a longer, harder one.';

  @override
  String get technicianTooManyRequests =>
      'Too many attempts. Wait a few minutes and try again.';

  @override
  String get technicianAuthDisabled =>
      'Creating accounts by email is turned off for this project. Contact the platform administrator.';

  @override
  String get comingSoonBody =>
      'This section will be available in a later update.';

  @override
  String get navServices => 'Services';

  @override
  String get navChats => 'Chats';

  @override
  String get navMore => 'More';

  @override
  String get homeSearchServices => 'Search services...';

  @override
  String get homeNoServices => 'No services found';

  @override
  String get homeServicesLoadFailed => 'Services could not be loaded.';

  @override
  String get ordersTabProducts => 'Products';

  @override
  String get ordersTabServices => 'Services';

  @override
  String get serviceDetailsTitle => 'Service details';

  @override
  String get serviceAvailableCompanies => 'Available companies';

  @override
  String get serviceNoCompanies => 'No company offers this service yet.';

  @override
  String get serviceCompaniesLoadFailed => 'The companies could not be loaded.';

  @override
  String get serviceRequestAction => 'Request service';

  @override
  String get serviceRequestFormTitle => 'Request service';

  @override
  String get serviceRequestDetailsLabel => 'What do you need?';

  @override
  String get serviceRequestDetailsHint =>
      'Describe the work, the device or system, and anything the company should know.';

  @override
  String get serviceRequestDetailsRequired => 'Please describe what you need.';

  @override
  String get serviceRequestLocationOptional => 'Address (optional)';

  @override
  String get serviceRequestAddressHint => 'Where should the service be done?';

  @override
  String get serviceRequestSubmit => 'Send request';

  @override
  String get serviceRequestSent =>
      'Your request was sent. You can now chat with the company.';

  @override
  String get serviceRequestCreateDenied =>
      'This request could not be sent. The company may no longer offer this service.';

  @override
  String get serviceRequestCreateFailed =>
      'The request could not be sent. Please try again.';

  @override
  String get serviceRequestUpdateFailed =>
      'The request could not be updated. Please try again.';

  @override
  String get serviceRequestsLoadFailed =>
      'Service requests could not be loaded.';

  @override
  String get serviceRequestNotFound => 'This service request was not found.';

  @override
  String get serviceRequestsEmptyCustomer =>
      'You have not requested any services yet.';

  @override
  String get serviceRequestsEmptyCompany => 'No service requests yet.';

  @override
  String get serviceRequestDetailsTitle => 'Service request';

  @override
  String get serviceRequestCustomer => 'Customer';

  @override
  String get serviceRequestCompany => 'Company';

  @override
  String get serviceRequestPrice => 'Price';

  @override
  String get serviceRequestSentAt => 'Sent';

  @override
  String get serviceRequestNumber => 'Request';

  @override
  String get serviceRequestContact => 'Contact and location';

  @override
  String get serviceRequestAddress => 'Address';

  @override
  String get serviceRequestOpenChat => 'Open chat';

  @override
  String get serviceRequestViewDetails => 'Request details';

  @override
  String get serviceRequestCancel => 'Cancel request';

  @override
  String get serviceRequestCancelTitle => 'Cancel this request?';

  @override
  String get serviceRequestCancelBody =>
      'The company will see that you cancelled it. This cannot be undone.';

  @override
  String get serviceRequestAccept => 'Accept';

  @override
  String get serviceRequestReject => 'Reject';

  @override
  String get serviceRequestRejectTitle => 'Reject this request?';

  @override
  String get serviceRequestRejectBody =>
      'The customer will see that the request was rejected. This cannot be undone.';

  @override
  String get serviceRequestStart => 'Start work';

  @override
  String get serviceRequestComplete => 'Mark as completed';

  @override
  String get serviceRequestStatusPending => 'Pending';

  @override
  String get serviceRequestStatusAccepted => 'Accepted';

  @override
  String get serviceRequestStatusRejected => 'Rejected';

  @override
  String get serviceRequestStatusInProgress => 'In progress';

  @override
  String get serviceRequestStatusCompleted => 'Completed';

  @override
  String get serviceRequestStatusCancelled => 'Cancelled';

  @override
  String serviceRequestStatusLine(String status) {
    return 'Request status: $status';
  }

  @override
  String get chatsEmptyCustomer =>
      'No chats yet. When you request a service, your conversation with the company appears here.';

  @override
  String get chatsEmptyCompany =>
      'No chats yet. Each service request sent to your company opens a conversation here.';

  @override
  String get chatNoMessagesYet => 'No messages yet';

  @override
  String get chatEmpty => 'No messages yet. Write to start the conversation.';

  @override
  String get chatInputHint => 'Write a message';

  @override
  String get chatSend => 'Send';

  @override
  String get chatYou => 'You';

  @override
  String chatYouPrefix(String text) {
    return 'You: $text';
  }

  @override
  String chatYesterdayAt(String time) {
    return 'Yesterday $time';
  }

  @override
  String get chatCustomerFallback => 'Customer';

  @override
  String get chatUnread => 'Unread';

  @override
  String get chatNotFound => 'This conversation was not found.';

  @override
  String get chatLoadFailed => 'The chat could not be loaded.';

  @override
  String get chatSendDenied => 'You cannot send messages in this conversation.';

  @override
  String get chatSendFailed =>
      'The message could not be sent. Please try again.';

  @override
  String get chatMessageInvalid => 'Write a message of up to 2000 characters.';

  @override
  String get adminServiceRequestsTab => 'Requests';

  @override
  String get adminMyServicesTab => 'My services';

  @override
  String get adminServicesLoadFailed => 'Services could not be loaded.';

  @override
  String get adminServicesOffered => 'Services you offer';

  @override
  String get adminServicesOfferedEmpty =>
      'You do not offer any services yet. Create one to start receiving requests.';

  @override
  String get adminServicesAvailable => 'From the platform catalogue';

  @override
  String get adminServicesCatalogueEmpty =>
      'The service catalogue is empty for now.';

  @override
  String get adminServicesAllAdded =>
      'You already offer every service in the catalogue.';

  @override
  String get adminServiceAdd => 'Add';

  @override
  String get adminServiceSaved => 'Service saved.';

  @override
  String get adminServiceRemoved => 'Service removed.';

  @override
  String get adminServiceRemoveTitle => 'Stop offering this service?';

  @override
  String adminServiceRemoveBody(String name) {
    return 'Customers will no longer be able to request $name from your company. Existing requests are kept.';
  }

  @override
  String get adminServicePriceHelper =>
      'Leave empty if you do not want to show a price.';

  @override
  String get adminServiceNoteLabel => 'Note for customers (optional)';

  @override
  String get adminServiceNoteHint =>
      'For example: done on site or remotely, what is included';

  @override
  String get companyServiceAlreadyOffered =>
      'Your company already offers this service.';

  @override
  String get companyServiceNotFound => 'This service is no longer available.';
}
