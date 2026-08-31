import SwiftUI

struct LifeHealthView: View {
    @Environment(AppStore.self) private var store
    private let healthService = HealthSyncService()

    private var today: [LifeHealthMetric] { store.lifeSnapshot.health.filter { Calendar.current.isDateInToday($0.startAt) } }
    private var steps: Int { Int(today.filter { $0.type == "steps" }.reduce(0) { $0 + $1.value }) }
    private var energy: Int { Int(today.filter { $0.type == "active_energy" }.reduce(0) { $0 + $1.value }) }
    private var exercise: Int { Int(today.filter { $0.type == "exercise_minutes" }.reduce(0) { $0 + $1.value }) }
    private var sleep: Double? { store.lifeSnapshot.health.filter { $0.type == "sleep" }.sorted { $0.startAt > $1.startAt }.first?.value }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("BODY").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                                Text("Health, without the noise.").font(.largeTitle.bold())
                                Text("Your body becomes useful context, not another score.").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                            }
                            Spacer()
                            Button("Sync", systemImage: "heart.text.square") { sync() }
                                .buttonStyle(.borderedProminent)
                                .buttonBorderShape(.capsule)
                                .tint(RememberDesign.accent)
                                .foregroundStyle(RememberDesign.accentInk)
                                .disabled(store.isSyncingHealth)
                        }
                        VStack(spacing: 11) {
                            Image(systemName: "heart.circle.fill").font(.system(size: 58)).foregroundStyle(RememberDesign.accent)
                            Text("TODAY’S MOVEMENT").font(.caption2.bold()).foregroundStyle(RememberDesign.secondaryText)
                            Text(steps.formatted()).font(.system(size: 58, weight: .bold, design: .rounded))
                            Text("steps").font(.caption).foregroundStyle(RememberDesign.secondaryText)
                        }
                        .frame(maxWidth: .infinity, minHeight: 280)
                        .background(RadialGradient(colors: [RememberDesign.accent.opacity(0.15), RememberDesign.surface], center: .center, startRadius: 0, endRadius: 250), in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                        HStack(spacing: 10) {
                            metric("Energy", value: "\(energy)", unit: "kcal")
                            metric("Exercise", value: "\(exercise)", unit: "min")
                            metric("Sleep", value: sleep.map { $0.formatted(.number.precision(.fractionLength(1))) } ?? "—", unit: "hr")
                        }
                        Label {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("Apple Health stays permission-controlled").font(.subheadline.bold()).foregroundStyle(.primary)
                                Text("Sync reads steps, energy, exercise, sleep stages, weight, resting heart rate, HRV, water, mindful sessions, and workouts for the previous 30 days. Remember never writes to Health.").font(.caption).foregroundStyle(RememberDesign.secondaryText)
                            }
                        } icon: { Image(systemName: "lock.shield").foregroundStyle(RememberDesign.accent) }
                        .padding(18)
                        .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: 17))
                        if !store.lifeSnapshot.health.isEmpty {
                            Text("RECENT MEASUREMENTS").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                            ForEach(store.lifeSnapshot.health.prefix(20)) { item in
                                HStack {
                                    Image(systemName: "waveform.path.ecg").foregroundStyle(RememberDesign.accent)
                                    Text(item.type.replacingOccurrences(of: "_", with: " ").capitalized).font(.subheadline)
                                    Spacer()
                                    Text("\(item.value.formatted(.number.precision(.fractionLength(0...1)))) \(item.unit)").font(.caption).foregroundStyle(RememberDesign.secondaryText)
                                }
                                Divider().overlay(RememberDesign.line)
                            }
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, 96)
                }
                .refreshable { await store.loadLife() }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func metric(_ title: String, value: String, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption2).foregroundStyle(RememberDesign.secondaryText)
            Spacer()
            Text(value).font(.title.bold()).minimumScaleFactor(0.65)
            Text(unit).font(.caption2).foregroundStyle(RememberDesign.secondaryText)
        }
        .frame(maxWidth: .infinity, minHeight: 125, alignment: .leading)
        .padding(14)
        .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: 17))
    }

    private func sync() {
        Task {
            do { await store.syncHealth(try await healthService.readApprovedMetrics()) }
            catch {
                store.errorMessage = error.localizedDescription
                store.errorIsPresented = true
            }
        }
    }
}
