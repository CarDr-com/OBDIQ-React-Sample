import Foundation
import CoreBluetooth
import OBDIQIosSdk
import RepairClubSDK
import React

@objc(CarDrModule)
class CarDrModule: RCTEventEmitter {

    private var connectionManager: CarDrConnectionApi?
    private var vin: String = ""
    private var dtcErrorArray: [DTCResponseModel] = []
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
            "onReadyForScan",
            "onVINReceived",
            "onDTCReceived",
            "onReadyForRepairInfo",
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
      connectionManager?.setSampleVehicle(.chevroletSilverado2021)
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

    @objc
    func getRepairCost(_ vin: String, dtcCodes: NSArray) {
        let dtcModels = matchingDtcResponseModels(for: dtcCodes)
        print("getRepairCost called vin=\(vin) dtcCount=\(dtcModels.count)")
        connectionManager?.getRepairCostSummary(vinNumber: vin, dtcErrorCodeArray: dtcModels)
    }

    private func matchingDtcResponseModels(for dtcCodes: NSArray) -> [DTCResponseModel] {
        var requestedKeys = Set<String>()

        for item in dtcCodes {
            guard
                let codeMap = item as? [String: Any],
                let code = codeMap["code"] as? String,
                !code.isEmpty
            else {
                continue
            }

            let moduleName = codeMap["moduleName"] as? String ?? ""
            requestedKeys.insert("\(moduleName)|\(code)")
        }

        guard !requestedKeys.isEmpty else { return [] }

        return dtcErrorArray.filter { model in
            model.dtcCodeArray.contains { item in
                requestedKeys.contains("\(model.moduleName)|\(item.dtcErrorCode)")
            }
        }
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

        dtcErrorArray = model

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
    }

    func didReceivedRepairCost(jsonString: String) {

        print("didReceivedRepairCost jsonString: \(jsonString)")

        emit("onRepairCostReceived", [
            "result": jsonString
        ])
    }

    // MARK: Optional callbacks

    func didCheckScanStatus(status: String) {}

    func didFetchMil(mil: Bool) {}

    func isReadyForScan(status: Bool, isGeneric: Bool) {
        emit("onReadyForScan", [
            "status": status,
            "isGeneric": isGeneric
        ])
    }

    func didScanForDevice(startScan: Bool) {}

    func didReadyForRepairInfo(isReady: Bool) {
        emit("onReadyForRepairInfo", [
            "isReady": isReady
        ])
    }

    func didReceiveRepairCost(result: [String : Any]?) {
        print("didReceiveRepairCost result: \(String(describing: result))")

        emit("onRepairCostReceived", [
            "result": result ?? [:]
        ])
    }
}
