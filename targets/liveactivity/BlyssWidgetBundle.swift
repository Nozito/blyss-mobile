import WidgetKit
import SwiftUI

@main
struct BlyssWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Live Activity. Its complementary Home/Lock Screen widget used to be
        // LiveRdvHomeWidget, dropped as a duplicate of NextAppointmentWidget
        // below (same "next appointment" content, same families covered).
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
