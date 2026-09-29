import 'package:flutter/material.dart';

/// The app's root navigator and messenger, for the few things that happen
/// outside any screen (opening a tapped push notification, a banner for a
/// push that arrives while the app is open).
final appNavigatorKey = GlobalKey<NavigatorState>();
final appScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();
