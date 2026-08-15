import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/auth/auth_controller.dart';
import '../core/localization/app_localizations.dart';
import '../features/auth/presentation/login_screen.dart';
import 'router.dart';
import 'theme.dart';

class SchoolsAiApp extends ConsumerWidget {
  const SchoolsAiApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final locale = ref.watch(localeProvider);

    final List<LocalizationsDelegate<dynamic>> localizationDelegates = [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ];

    if (!auth.initialized) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        locale: locale,
        supportedLocales: supportedLocales,
        localizationsDelegates: localizationDelegates,
        home: const _AppLoadingScreen(),
      );
    }

    if (!auth.isAuthenticated) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Schools AI',
        theme: buildAppTheme(),
        locale: locale,
        supportedLocales: supportedLocales,
        localizationsDelegates: localizationDelegates,
        home: const LoginScreen(),
      );
    }

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Schools AI',
      theme: buildAppTheme(),
      locale: locale,
      supportedLocales: supportedLocales,
      localizationsDelegates: localizationDelegates,
      routerConfig: ref.watch(appRouterProvider),
    );
  }
}

class _AppLoadingScreen extends StatelessWidget {
  const _AppLoadingScreen();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}
