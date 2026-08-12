package expo.modules.highlightmenu

import android.content.Context
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * Contenedor que añade un ítem "Subrayar" al menú flotante de selección del
 * texto que lleva dentro.
 *
 * En Android el menú de selección es un `ActionMode`, y se personaliza con
 * `setCustomSelectionActionModeCallback` sobre el propio `TextView`. Sirve
 * igual para el `Text selectable` (`ReactTextView`) que para el `TextInput`
 * (`ReactEditText`): los dos son `TextView`.
 *
 * Se envuelve el texto —en vez de buscarlo por su tag— por el mismo motivo que
 * en iOS: con la nueva arquitectura la búsqueda por tag ya no es de fiar, y
 * teniendo el texto dentro basta con recorrer las subvistas.
 */
class HighlightMenuView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  private val onHighlightRequest by EventDispatcher()

  var label: String = "Subrayar"

  /**
   * OJO con el nombre: NO puede llamarse `isEnabled`. `android.view.View` ya
   * tiene esa propiedad, y declararla aquí es un *accidental override* — misma
   * firma JVM (`isEnabled()Z`) — que rompe la compilación de Android entera.
   */
  var menuEnabled: Boolean = true

  private var attachedTextView: TextView? = null
  private var attachedCallback: HighlightActionModeCallback? = null

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    super.onLayout(changed, l, t, r, b)
    // El TextView puede aparecer después del primer layout: se reintenta.
    attachIfNeeded()
  }

  override fun onDetachedFromWindow() {
    detach()
    super.onDetachedFromWindow()
  }

  /** Devuelve al TextView el callback que tuviera antes del nuestro. */
  private fun detach() {
    val textView = attachedTextView
    val callback = attachedCallback
    if (textView != null && textView.customSelectionActionModeCallback === callback) {
      textView.customSelectionActionModeCallback = callback?.original
    }
    attachedTextView = null
    attachedCallback = null
  }

  private fun attachIfNeeded() {
    val textView = findTextView(this) ?: return

    // Ya enganchado a ESTE TextView y con nuestro callback en su sitio.
    if (textView === attachedTextView &&
      textView.customSelectionActionModeCallback === attachedCallback
    ) {
      return
    }

    // Llegar aquí significa que el TextView cambió o que alguien reasignó el
    // callback (React Native lo hace al recrear el Text/TextInput). Sin el
    // reintento, el ítem del menú desaparecía al remontarse el texto —cambio de
    // día, de fuente, de modo— y no volvía.
    detach()

    val previous = textView.customSelectionActionModeCallback
    // Nunca encadenar callbacks nuestros: si el que hay ya es uno nuestro, nos
    // quedamos con el original que él envolvía.
    val original =
      if (previous is HighlightActionModeCallback) previous.original else previous
    val callback = HighlightActionModeCallback(textView, original)
    textView.customSelectionActionModeCallback = callback
    attachedTextView = textView
    attachedCallback = callback
  }

  private fun findTextView(view: View): TextView? {
    if (view is TextView) return view
    if (view !is ViewGroup) return null
    for (i in 0 until view.childCount) {
      findTextView(view.getChildAt(i))?.let { return it }
    }
    return null
  }

  /**
   * Añade el ítem al menú y reenvía todo lo demás al callback que hubiera
   * antes, para no quedarnos sin Copiar/Seleccionar todo/Traducir.
   */
  private inner class HighlightActionModeCallback(
    private val target: TextView,
    val original: ActionMode.Callback?,
  ) : ActionMode.Callback {

    override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
      original?.onCreateActionMode(mode, menu)
      if (menuEnabled) {
        menu.add(Menu.NONE, MENU_ITEM_ID, Menu.FIRST, label)
      }
      return true
    }

    override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean {
      original?.onPrepareActionMode(mode, menu)
      return true
    }

    override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
      if (item.itemId == MENU_ITEM_ID) {
        val start = target.selectionStart
        val end = target.selectionEnd
        if (start >= 0 && end >= 0 && start != end) {
          onHighlightRequest(
            mapOf(
              "start" to minOf(start, end),
              "end" to maxOf(start, end),
            ),
          )
        }
        mode.finish()
        return true
      }
      return original?.onActionItemClicked(mode, item) ?: false
    }

    override fun onDestroyActionMode(mode: ActionMode) {
      original?.onDestroyActionMode(mode)
    }
  }

  private companion object {
    /** Id propio, alto para no chocar con los del sistema. */
    const val MENU_ITEM_ID = 0x4D434D01
  }
}
