import SwiftUI

struct LifeHealthView: View {
    @Environment(AppStore.self) private var store
    @Binding private var lifeSection: LifeSection
    private let healthService = HealthSyncService()

    init(lifeSection: Binding<LifeSection> = .constant(.health)) {
        _lifeSection = lifeSection
    }

    private var steps: Int {
        Int(HealthMetricAggregation.cumulativeTotal(in: store.lifeSnapshot.health, type: "steps"))
    }

    private var energy: Int {
        Int(HealthMetricAggregation.cumulativeTotal(in: store.lifeSnapshot.health, type: "active_energy"))
    }

    private var exercise: Int {
        Int(HealthMetricAggregation.cumulativeTotal(in: store.lifeSnapshot.health, type: "exercise_minutes"))
    }

    private var latestSleep: Double? {
        HealthMetricAggregation.latestSleepHours(in: store.lifeSnapshot.health)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                AdaptiveSectionControl(
                    selection: $lifeSection,
                    choices: LifeSection.allCases,
                    accessibilityIdentifier: "remember.section.life",
                    title: { $0.rawValue }
                )
                Group {
                    if store.lifeSnapshot.health.isEmpty {
                        ScrollView {
                            RememberEmptyState(
                                systemImage: "heart.fill",
                                title: "Connect Apple Health",
                                message: "Sleep and movement help Jev plan around your energy. Remember only reads; nothing is written back.",
                                actionTitle: store.isSyncingHealth ? "Connecting…" : "Connect Health",
                                action: sync
                            )
                            .disabled(store.isSyncingHealth)
                        }
                    } else {
                        ScrollView {
                        LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                                SectionHeading(title: "Steps today")
                                Text(steps.formatted())
                                    .font(.system(size: 48, weight: .bold, design: .rounded).monospacedDigit())
                                if let lastHealthSync = store.lastHealthSync {
                                    Text("Updated \(lastHealthSync, format: .relative(presentation: .named))")
                                        .font(.caption)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .rememberCard()

                            VStack(spacing: 0) {
                                metricRow("Active energy", value: energy.formatted(), unit: "kcal", symbol: "flame")
                                Divider().overlay(RememberDesign.line).padding(.leading, 48)
                                metricRow("Exercise", value: exercise.formatted(), unit: "min", symbol: "figure.run")
                                Divider().overlay(RememberDesign.line).padding(.leading, 48)
                                metricRow(
                                    "Latest sleep",
                                    value: latestSleep.map { $0.formatted(.number.precision(.fractionLength(1))) } ?? "—",
                                    unit: latestSleep == nil ? "No sleep data" : "hr",
                                    symbol: "moon"
                                )
                            }
                            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))

                            if !store.lifeSnapshot.health.isEmpty {
                                SectionHeading(title: "Recent")
                                VStack(spacing: 0) {
                                    ForEach(store.lifeSnapshot.health.prefix(20)) { item in
                                        HStack(spacing: 12) {
                                            Image(systemName: symbol(for: item.type))
                                                .foregroundStyle(RememberDesign.text2)
                                                .frame(width: 28)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(label(for: item.type))
                                                    .font(.subheadline.weight(.semibold))
                                                Text(item.startAt, format: .dateTime.month(.abbreviated).day().hour().minute())
                                                    .font(.caption)
                                                    .foregroundStyle(RememberDesign.secondaryText)
                                            }
                                            Spacer()
                                            Text("\(item.value.formatted(.number.precision(.fractionLength(0...1)))) \(item.unit)")
                                                .font(.subheadline.monospacedDigit())
                                        }
                                        .frame(minHeight: 54)
                                        if item.id != store.lifeSnapshot.health.prefix(20).last?.id {
                                            Divider().overlay(RememberDesign.line).padding(.leading, 48)
                                        }
                                    }
                                }
                                .padding(.horizontal, RememberDesign.spacing)
                                .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                            }

                            Button {
                                sync()
                            } label: {
                                Label(store.isSyncingHealth ? "Syncing…" : "Sync Health", systemImage: "arrow.triangle.2.circlepath")
                            }
                            .buttonStyle(.rememberQuiet)
                            .disabled(store.isSyncingHealth)
                            .frame(maxWidth: .infinity)
                        }
                        .padding(RememberDesign.spacing)
                        .padding(.bottom, RememberDesign.spacingXLarge)
                        }
                        .refreshable { await store.loadLife() }
                    }
                }
            }
            .rememberBottomDock()
            .rememberPrimaryActions()
        }
    }

    private func metricRow(_ title: String, value: String, unit: String, symbol: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(RememberDesign.text2)
                .frame(width: 28)
            Text(title)
                .font(.subheadline)
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(value)
                    .font(.headline.monospacedDigit())
                Text(unit)
                    .font(.caption)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
        .frame(minHeight: 62)
        .padding(.horizontal, RememberDesign.spacing)
    }

    private func label(for type: String) -> String {
        type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func symbol(for type: String) -> String {
        switch type {
        case "steps": "figure.walk"
        case "active_energy": "flame"
        case "exercise_minutes", "workout": "figure.run"
        case "sleep": "moon"
        case "weight": "scalemass"
        case "resting_heart_rate": "heart"
        case "heart_rate_variability": "waveform.path.ecg"
        case "water": "drop"
        case "mindful_minutes": "brain.head.profile"
        default: "circle"
        }
    }

    private func sync() {
        Task {
            do {
                await store.syncHealth(try await healthService.readApprovedMetrics())
            } catch {
                store.errorMessage = error.localizedDescription
                store.errorIsPresented = true
            }
        }
    }
}
