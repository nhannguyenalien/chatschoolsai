import Cocoa
import FlutterMacOS
import Security

class MainFlutterWindow: NSWindow {
  private let keychainService = "com.schoolsai.app"

  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    RegisterGeneratedPlugins(registry: flutterViewController)

    let keychainChannel = FlutterMethodChannel(
      name: "com.schoolsai.app/keychain",
      binaryMessenger: flutterViewController.engine.binaryMessenger
    )
    keychainChannel.setMethodCallHandler { [weak self] call, result in
      self?.handleKeychainCall(call, result: result)
    }

    super.awakeFromNib()
  }

  private func handleKeychainCall(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard
      let arguments = call.arguments as? [String: Any],
      let key = arguments["key"] as? String
    else {
      result(FlutterError(code: "invalid_arguments", message: "Missing key", details: nil))
      return
    }

    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: keychainService,
      kSecAttrAccount: key,
    ]

    switch call.method {
    case "read":
      var readQuery = query
      readQuery[kSecReturnData] = true
      readQuery[kSecMatchLimit] = kSecMatchLimitOne
      var item: CFTypeRef?
      let status = SecItemCopyMatching(readQuery as CFDictionary, &item)
      if status == errSecItemNotFound {
        result(nil)
      } else if status == errSecSuccess, let data = item as? Data {
        result(String(data: data, encoding: .utf8))
      } else {
        result(keychainError(status))
      }

    case "write":
      guard
        let value = arguments["value"] as? String,
        let data = value.data(using: .utf8)
      else {
        result(FlutterError(code: "invalid_arguments", message: "Missing value", details: nil))
        return
      }
      var attributes = query
      attributes[kSecValueData] = data
      attributes[kSecAttrAccessible] = kSecAttrAccessibleWhenUnlocked
      let existingStatus = SecItemCopyMatching(query as CFDictionary, nil)
      let status: OSStatus
      if existingStatus == errSecSuccess {
        status = SecItemUpdate(query as CFDictionary, [kSecValueData: data] as CFDictionary)
      } else if existingStatus == errSecItemNotFound {
        status = SecItemAdd(attributes as CFDictionary, nil)
      } else {
        status = existingStatus
      }
      result(status == errSecSuccess ? nil : keychainError(status))

    case "delete":
      let status = SecItemDelete(query as CFDictionary)
      result(status == errSecSuccess || status == errSecItemNotFound ? nil : keychainError(status))

    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func keychainError(_ status: OSStatus) -> FlutterError {
    let message = SecCopyErrorMessageString(status, nil) as String? ?? "Keychain error"
    return FlutterError(code: "keychain_\(status)", message: message, details: status)
  }
}
