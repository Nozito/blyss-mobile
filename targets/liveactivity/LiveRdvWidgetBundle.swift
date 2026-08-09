import WidgetKit
import SwiftUI

@main
struct LiveRdvWidgetBundle: WidgetBundle {
    var body: some Widget {
        LiveRdvHomeWidget()
        if #available(iOS 16.2, *) {
            LiveRdvLiveActivity()
        }
    }
}
