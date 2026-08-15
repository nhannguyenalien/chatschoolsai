import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/auth/desktop_webview_bootstrap.dart';

void main(List<String> args) {
  WidgetsFlutterBinding.ensureInitialized();
  if (runDesktopWebViewTitleBar(args)) return;
  runApp(const ProviderScope(child: SchoolsAiApp()));
}
