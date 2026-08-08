import ExpoModulesCore
import UIKit

/// Vista contenedora que añade un ítem "Subrayar" al menú nativo de selección
/// del texto que lleva dentro.
///
/// ## Por qué una vista contenedora y no buscar la vista por su tag
///
/// Buscar por tag obliga a preguntarle al UIManager, y con la nueva
/// arquitectura (Fabric) eso ya no es fiable. Envolviendo el texto tenemos sus
/// subvistas a mano: basta recorrer el árbol hasta el primer `UITextView`, que
/// es exactamente lo que monta el `TextInput` de solo lectura de
/// `HighlightableReading`.
///
/// ## Por qué un proxy del delegate
///
/// Desde iOS 16 el menú de edición se construye en
/// `textView(_:editMenuForTextIn:suggestedActions:)`, y ese delegate **ya lo
/// ocupa React Native** (`RCTUITextView`). Si se lo quitamos, se rompen cosas
/// que sí usamos, como `onSelectionChange`. El proxy implementa SOLO ese método
/// y reenvía todos los demás al delegate original mediante
/// `forwardingTarget(for:)`, así que para React Native nada cambia.
final class HighlightMenuView: ExpoView {
  /// Evento a JS con los offsets de la selección: `{ start, end }`.
  let onHighlightRequest = EventDispatcher()

  /// Texto del ítem del menú. Se recibe de JS para no dejar castellano
  /// incrustado en el código nativo.
  var label: String = "Subrayar"

  /// Permite apagar el ítem sin desmontar la vista.
  var menuEnabled: Bool = true

  private var proxy: TextViewDelegateProxy?
  private weak var attachedTextView: UITextView?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    attachIfNeeded()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // El `UITextView` puede aparecer después del primer layout (RN monta los
    // hijos de forma asíncrona), así que se reintenta hasta engancharlo.
    attachIfNeeded()
  }

  deinit {
    // Devolver el delegate original: si esta vista se va y dejamos el proxy
    // puesto, el text view quedaría hablando con un objeto muerto.
    detach()
  }

  /// Suelta el text view al que estuviéramos enganchados, devolviéndole su
  /// delegate original si el nuestro sigue puesto.
  private func detach() {
    if let textView = attachedTextView, textView.delegate === proxy {
      textView.delegate = proxy?.original
    }
    attachedTextView = nil
    proxy = nil
  }

  private func attachIfNeeded() {
    guard let textView = Self.findTextView(in: self) else { return }

    // Ya enganchado a ESTE text view y con el proxy todavía en su sitio.
    if textView === attachedTextView, let proxy = proxy, textView.delegate === proxy {
      return
    }

    // Llegar aquí con algo enganchado significa que el text view cambió o que
    // React Native se REASIGNÓ el delegate (lo hace al recrear o reconfigurar
    // el TextInput). Sin este reintento, el ítem del menú desaparecía en cuanto
    // el texto se volvía a montar —cambio de día, de fuente, de modo— y no
    // volvía hasta reiniciar la app.
    detach()

    let proxy = TextViewDelegateProxy()
    // Nunca encadenar proxies: si el delegate que hay ya es uno nuestro (de una
    // vista que se está desmontando), nos quedamos con SU original.
    proxy.original = (textView.delegate as? TextViewDelegateProxy)?.original ?? textView.delegate
    proxy.makeMenu = { [weak self] range, base in
      guard let self = self, self.menuEnabled, range.length > 0 else { return base }
      let action = UIAction(
        title: self.label,
        image: UIImage(systemName: "highlighter")
      ) { [weak self] _ in
        // `range` es el rango para el que se construyó el menú, en unidades
        // UTF-16 — las mismas que usan los índices de string en JavaScript,
        // así que los offsets casan con el texto canónico sin convertir nada.
        self?.onHighlightRequest([
          "start": range.location,
          "end": range.location + range.length,
        ])
      }
      return base.replacingChildren([action] + base.children)
    }

    textView.delegate = proxy
    self.proxy = proxy
    self.attachedTextView = textView
  }

  /// Primer `UITextView` en profundidad. `RCTUITextView` es una subclase suya.
  private static func findTextView(in view: UIView) -> UITextView? {
    for subview in view.subviews {
      if let textView = subview as? UITextView { return textView }
      if let found = findTextView(in: subview) { return found }
    }
    return nil
  }
}

/// Delegate que solo se queda con la construcción del menú y reenvía el resto.
private final class TextViewDelegateProxy: NSObject, UITextViewDelegate {
  weak var original: (any UITextViewDelegate)?
  var makeMenu: ((NSRange, UIMenu) -> UIMenu)?

  private static let menuSelector = #selector(
    UITextViewDelegate.textView(_:editMenuForTextIn:suggestedActions:)
  )

  override func responds(to aSelector: Selector!) -> Bool {
    if aSelector == Self.menuSelector { return true }
    return super.responds(to: aSelector) || original?.responds(to: aSelector) == true
  }

  /// Todo lo que no implementamos aquí lo atiende el delegate de React Native.
  override func forwardingTarget(for aSelector: Selector!) -> Any? {
    if aSelector == Self.menuSelector { return nil }
    return original
  }

  func textView(
    _ textView: UITextView,
    editMenuForTextIn range: NSRange,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    // Punto de partida: lo que devolvería React Native si aún manda algo, y si
    // no, el menú que propone el sistema (Copiar, Traducir, Buscar…).
    let base: UIMenu
    if let original = original,
       original.responds(to: Self.menuSelector),
       let originalMenu = original.textView?(
        textView, editMenuForTextIn: range, suggestedActions: suggestedActions
       ) {
      base = originalMenu
    } else {
      base = UIMenu(children: suggestedActions)
    }
    return makeMenu?(range, base) ?? base
  }
}
