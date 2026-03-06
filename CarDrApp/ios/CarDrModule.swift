import Foundation
import CoreBluetooth
import OBDIQIosSdk
import RepairClubSDK
import React

@objc(CarDrModule)
class CarDrModule: RCTEventEmitter {

    private var connectionManager: CarDrConnectionApi?
    private var vin: String = ""
    private var hasListeners = false

    override init() {
        super.init()
    }

    // MARK: React Native Requirement
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func supportedEvents() -> [String]! {
        return [
            "onBluetoothState",
            "onDevicesFound",
            "onScanProgress",
            "onVINReceived",
            "onDTCReceived",
            "onRepairCostReceived"
        ]
    }

    // MARK: Listener lifecycle (recommended for RCTEventEmitter)

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    // MARK: Safe Event Emitter

    private func emit(_ name: String, _ body: Any) {

        guard hasListeners else { return }

        DispatchQueue.main.async {
            self.sendEvent(withName: name, body: body)
        }
    }

    // MARK: SDK Initialization

    @objc
    func initializeSDK(_ partnerID: String) {

        connectionManager = CarDrConnectionApi()

        connectionManager?.initialize(
            partnerID: partnerID,
            isProductionReady: false,
            listener: self
        )
    }

    // MARK: Scan Device

    @objc
    func scanForDevice() {
        connectionManager?.scanForDevice()
    }

    // MARK: Start Scan

    @objc
    func startScan() {
        connectionManager?.startScan()
    }

    // MARK: Stop Scan

    @objc
    func stopScan() {
        connectionManager?.stopAdvanceScan()
    }
}

// MARK: SDK Listener

extension CarDrModule: ConnectionListener {

    func didFetchVehicleInfo(vehicleEntry: VehicleEntries) {

        vin = vehicleEntry.VIN

        emit("onVINReceived", [
            "vin": vin
        ])
    }

    func didDevicesFetch(foundedDevices: [DeviceItem]?) {

        let deviceNames = foundedDevices?.map { $0.name } ?? []

        emit("onDevicesFound", [
            "devices": deviceNames
        ])
    }

    func didUpdateProgress(progressStatus: String, percent: String) {
        print(percent)
        emit("onScanProgress", [
            "status": progressStatus,
            "percent": percent
        ])
    }

    func didReceivedCode(model: [DTCResponseModel]?) {

        guard let model = model else { return }

        var codes: [[String: Any]] = []

        for module in model {

            for item in module.dtcCodeArray {

                codes.append([
                    "moduleName": module.moduleName,
                    "code": item.dtcErrorCode
                ])
            }
        }

        emit("onDTCReceived", [
            "codes": codes
        ])

        connectionManager?.getRepairCostSummary(
            vinNumber: vin,
            dtcErrorCodeArray: model
        )
    }

    func didReceivedRepairCost(jsonString: String) {

        emit("onRepairCostReceived", [
            "result": jsonString
        ])
    }

    // MARK: Optional callbacks

    func didCheckScanStatus(status: String) {}

    func didFetchMil(mil: Bool) {}

    func isReadyForScan(status: Bool, isGeneric: Bool) {}

    func didScanForDevice(startScan: Bool) {}

    func didReadyForRepairInfo(isReady: Bool) {}

    func didReceiveRepairCost(result: [String : Any]?) {}
}
