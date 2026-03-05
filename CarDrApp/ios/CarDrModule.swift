import Foundation
import CoreBluetooth
import OBDIQIosSdk
import RepairClubSDK
import React

@objc(CarDrModule)
class CarDrModule: RCTEventEmitter {

    private var connectionManager: CarDrConnectionApi?
    private var vin: String = ""

    override init() {
        super.init()
    }

    // React Native requirement
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

    // Required for EventEmitter
  @objc override func addListener(_ eventName: String) {}
  @objc override func removeListeners(_ count: Double) {}

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

    // MARK: Start Scan
    @objc
    func scanForDevice() {
        connectionManager?.scanForDevice()
    }
  
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

// MARK: - SDK Listener
extension CarDrModule: ConnectionListener {

    func didFetchVehicleInfo(vehicleEntry: VehicleEntries) {
        vin = vehicleEntry.VIN

        sendEvent(withName: "onVINReceived", body: [
            "vin": vin
        ])
    }

    func didDevicesFetch(foundedDevices: [DeviceItem]?) {

        let deviceNames = foundedDevices?.map { $0.name } ?? []

        sendEvent(withName: "onDevicesFound", body: [
            "devices": deviceNames
        ])
    }

    func didUpdateProgress(progressStatus: String, percent: String) {

        sendEvent(withName: "onScanProgress", body: [
            "status": progressStatus,
            "percent": percent
        ])
    }

    func didReceivedCode(model: [DTCResponseModel]?) {

        guard let model = model else { return }

        let codes = model.map { $0.dtcCodeArray }

        sendEvent(withName: "onDTCReceived", body: [
            "codes": codes
        ])

        connectionManager?.getRepairCostSummary(
            vinNumber: vin,
            dtcErrorCodeArray: model
        )
    }

    func didReceivedRepairCost(jsonString: String) {

        sendEvent(withName: "onRepairCostReceived", body: [
            "result": jsonString
        ])
    }

    func didCheckScanStatus(status: String) {}
    func didFetchMil(mil: Bool) {}
    func isReadyForScan(status: Bool, isGeneric: Bool) {}
    func didScanForDevice(startScan: Bool) {}
    func didReadyForRepairInfo(isReady: Bool) {}
    func didReceiveRepairCost(result: [String : Any]?) {}
}
