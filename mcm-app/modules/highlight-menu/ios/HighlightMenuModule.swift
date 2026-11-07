import ExpoModulesCore

public class HighlightMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HighlightMenu")

    View(HighlightMenuView.self) {
      Events("onHighlightRequest")

      Prop("label") { (view: HighlightMenuView, label: String) in
        view.label = label
      }

      Prop("enabled") { (view: HighlightMenuView, enabled: Bool) in
        view.menuEnabled = enabled
      }
    }
  }
}
