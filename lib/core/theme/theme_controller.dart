import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../localization/locale_controller.dart';

/// Where the chosen appearance is remembered on this device.
const themeModePreferenceKey = 'theme_mode';

/// Light, dark, or follow the phone. Watched by the root MaterialApp, so a
/// change repaints every open screen in place, with no restart.
final themeModeControllerProvider =
    NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    final stored = ref.read(sharedPreferencesProvider)?.getString(
          themeModePreferenceKey,
        );
    return ThemeMode.values.asNameMap()[stored] ?? ThemeMode.system;
  }

  Future<void> setMode(ThemeMode mode) async {
    if (state != mode) state = mode;
    await ref
        .read(sharedPreferencesProvider)
        ?.setString(themeModePreferenceKey, mode.name);
  }
}
