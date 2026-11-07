package expo.modules.highlightmenu

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HighlightMenuModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HighlightMenu")

    View(HighlightMenuView::class) {
      Events("onHighlightRequest")

      Prop("label") { view: HighlightMenuView, label: String ->
        view.label = label
      }

      Prop("enabled") { view: HighlightMenuView, enabled: Boolean ->
        view.menuEnabled = enabled
      }
    }
  }
}
