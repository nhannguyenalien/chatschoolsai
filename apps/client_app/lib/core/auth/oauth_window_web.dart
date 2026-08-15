// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use

import 'dart:html' as html;

class OAuthWindow {
  OAuthWindow._(this._window);

  final html.WindowBase? _window;

  /// Must be called synchronously from the button handler. Otherwise browsers
  /// can block the OAuth popup while PocketBase prepares the authorization URL.
  static OAuthWindow reserve() {
    return OAuthWindow._(
      html.window.open(
        'about:blank',
        'schools_ai_google_oauth',
        'popup=yes,width=520,height=720',
      ),
    );
  }

  bool get wasBlocked => _window == null;

  Future<bool> navigate(Uri url) async {
    final window = _window;
    if (window == null) return false;

    window.location.href = url.toString();
    return true;
  }

  void close() => _window?.close();
}
