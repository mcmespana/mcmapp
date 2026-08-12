//
//  NotificationService.swift
//  MCMNotificationService
//
//  Notification Service Extension: se ejecuta ANTES de que iOS pinte la
//  notificación y puede modificarla. Aquí sirve para una sola cosa: descargar
//  la imagen que manda el Panel y adjuntarla, que es lo único que iOS no sabe
//  hacer solo (en Android la imagen ya se veía; en iOS no, y no había forma de
//  arreglarlo sin esta extensión).
//
//  Dos condiciones para que esto llegue siquiera a ejecutarse:
//    1. El push tiene que traer `mutable-content: 1` en el `aps`. Con la API de
//       Expo eso es `mutableContent: true`.
//    2. Tiene que haber una URL de imagen accesible por HTTPS en el payload.
//
//  Si algo falla —no hay URL, la descarga se cae, iOS corta por tiempo— se
//  entrega la notificación TAL CUAL. Una notificación sin foto es un problema
//  menor; una notificación que no llega es un problema gordo.
//

import UserNotifications

class NotificationService: UNNotificationServiceExtension {

  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?
  private var downloadTask: URLSessionDownloadTask?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler

    guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
      contentHandler(request.content)
      return
    }
    bestAttemptContent = content

    guard let url = Self.imageURL(in: request.content.userInfo) else {
      contentHandler(content)
      return
    }

    downloadTask = URLSession.shared.downloadTask(with: url) { [weak self] location, response, _ in
      guard let self = self else { return }
      defer { self.deliver() }

      guard let location = location else { return }
      guard let attachment = Self.attachment(from: location, response: response, url: url) else { return }
      self.bestAttemptContent?.attachments = [attachment]
    }
    downloadTask?.resume()
  }

  /// iOS corta la extensión a los ~30 s. Se entrega lo que haya.
  override func serviceExtensionTimeWillExpire() {
    downloadTask?.cancel()
    deliver()
  }

  private func deliver() {
    guard let contentHandler = contentHandler, let content = bestAttemptContent else { return }
    // Solo una vez: `serviceExtensionTimeWillExpire` puede solaparse con el
    // final de la descarga, y llamar dos veces al handler es un crash.
    self.contentHandler = nil
    contentHandler(content)
  }

  // MARK: - Payload

  /// Busca la URL de la imagen en el payload del push.
  ///
  /// Expo mete el `data` del mensaje bajo la clave `body`, así que se mira ahí
  /// y también en la raíz. Las claves cubren lo que manda hoy el MCM Panel
  /// (`data.imageUrl`), el campo `richContent.image` de la API de Expo y la
  /// convención `attachment-url` por si algún día se usa otro emisor.
  static func imageURL(in userInfo: [AnyHashable: Any]) -> URL? {
    var containers: [[AnyHashable: Any]] = [userInfo]
    if let body = userInfo["body"] as? [AnyHashable: Any] {
      containers.append(body)
      if let rich = body["richContent"] as? [AnyHashable: Any] {
        containers.append(rich)
      }
    }
    if let rich = userInfo["richContent"] as? [AnyHashable: Any] {
      containers.append(rich)
    }

    let keys = ["imageUrl", "image", "attachment-url", "attachmentUrl"]
    for container in containers {
      for key in keys {
        guard let raw = container[key] as? String, !raw.isEmpty else { continue }
        guard let url = URL(string: raw), url.scheme?.hasPrefix("http") == true else { continue }
        return url
      }
    }
    return nil
  }

  // MARK: - Adjunto

  /// `UNNotificationAttachment` decide el tipo por la EXTENSIÓN del fichero, y
  /// lo que descarga `URLSession` no tiene ninguna. Hay que renombrarlo.
  private static func attachment(
    from location: URL,
    response: URLResponse?,
    url: URL
  ) -> UNNotificationAttachment? {
    let ext = fileExtension(response: response, url: url)
    let destination = URL(fileURLWithPath: NSTemporaryDirectory())
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(ext)

    do {
      try FileManager.default.moveItem(at: location, to: destination)
      return try UNNotificationAttachment(identifier: "mcm-image", url: destination, options: nil)
    } catch {
      try? FileManager.default.removeItem(at: destination)
      return nil
    }
  }

  private static func fileExtension(response: URLResponse?, url: URL) -> String {
    switch response?.mimeType {
    case "image/png": return "png"
    case "image/jpeg": return "jpg"
    case "image/gif": return "gif"
    case "image/webp": return "webp"
    default: break
    }
    // Sin MIME útil, la extensión de la URL; y si tampoco, jpg (lo que suben
    // en el Panel casi siempre).
    let pathExtension = url.pathExtension.lowercased()
    let known = ["png", "jpg", "jpeg", "gif", "webp"]
    return known.contains(pathExtension) ? pathExtension : "jpg"
  }
}
