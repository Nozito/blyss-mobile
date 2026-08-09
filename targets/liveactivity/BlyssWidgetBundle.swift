import WidgetKit
import SwiftUI

@main
struct BlyssWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Live Activity + its complementary Home/Lock Screen widget.
        LiveRdvHomeWidget()
        if #available(iOS 16.2, *) {
            LiveRdvLiveActivity()
        }

        // Pro
        NextAppointmentWidget()
        DaySummaryWidget()
        RevenueWidget()

        // Admin
        PlatformOverviewWidget()
        AlertsWidget()
        GrowthWidget()

        // Shared
        BlyssLogoWidget()
    }
}
