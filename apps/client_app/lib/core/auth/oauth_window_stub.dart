import 'dart:io';

import 'package:desktop_webview_window/desktop_webview_window.dart';
import 'package:url_launcher/url_launcher.dart';

class OAuthWindow {
  OAuthWindow._();

  Webview? _webview;

  static OAuthWindow reserve() => OAuthWindow._();

  bool get wasBlocked => false;

  Future<bool> navigate(Uri url) async {
    if (Platform.isMacOS || Platform.isWindows || Platform.isLinux) {
      if (!await WebviewWindow.isWebviewAvailable()) return false;

      final webview = await WebviewWindow.create(
        configuration: const CreateConfiguration(
          title: 'Đăng nhập Google — Schools AI',
          windowWidth: 520,
          windowHeight: 720,
          titleBarTopPadding: 0,
        ),
      );
      _webview = webview;
      webview.launch(url.toString());
      return true;
    }

    return launchUrl(url, mode: LaunchMode.platformDefault);
  }

  void close() {
    _webview?.close();
    _webview = null;
  }
}
