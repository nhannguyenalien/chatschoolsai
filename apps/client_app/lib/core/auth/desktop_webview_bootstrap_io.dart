import 'dart:io';

import 'package:desktop_webview_window/desktop_webview_window.dart';

bool runDesktopWebViewTitleBar(List<String> args) {
  if (!Platform.isMacOS && !Platform.isWindows && !Platform.isLinux) {
    return false;
  }
  return runWebViewTitleBarWidget(args);
}
