package com.cardrapp

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.cardr.cardrandroidsdk.*
import com.cardr.obdiqandroidsdk.VehicleEntries
import com.repairclub.repaircludsdk.models.DeviceItem

class CarDrModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ConnectionListner {

    private var connectionManager: ConnectionManager? = null
    private var vin: String = ""

    override fun getName(): String {
        return "CarDrModule"
    }

    private fun sendEvent(event: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, params)
    }

    // MARK: Initialize SDK

    @ReactMethod
    fun initializeSDK(partnerID: String) {

        connectionManager = ConnectionManager(reactContext)

        connectionManager?.initialize(
            patnerID = partnerID,
            isProductionReady = false,
            context = reactContext,
            connectionListner = this
        )
    }

    // MARK: Scan device

    @ReactMethod
    fun scanForDevice() {
        connectionManager?.scanForDevice()
    }

    // MARK: Start scan

    @ReactMethod
    fun startScan() {
        connectionManager?.startScan()
    }

    // MARK: Stop scan

    @ReactMethod
    fun stopScan() {
        connectionManager?.disconnectOBD()
    }

    // ============================================================
    // ConnectionListner callbacks (bridge to React Native)
    // ============================================================

    override fun didScanForDevice(startScan: Boolean) {

        val map = Arguments.createMap()
        map.putBoolean("status", startScan)

        sendEvent("onBluetoothState", map)
    }

    override fun didDevicesFetch(foundedDevices: List<DeviceItem>?) {

        val devices = Arguments.createArray()

        foundedDevices?.forEach {
            devices.pushString(it.name)
        }

        val map = Arguments.createMap()
        map.putArray("devices", devices)

        sendEvent("onDevicesFound", map)
    }

    override fun didCheckScanStatus(status: String) {

        val map = Arguments.createMap()
        map.putString("status", status)

        sendEvent("onScanProgress", map)
    }

    override fun didFetchVehicalInfo(vehicleEntry: VehicleEntries) {

        vin = vehicleEntry.VIN ?: ""

        val map = Arguments.createMap()
        map.putString("vin", vin)

        sendEvent("onVINReceived", map)
    }

    override fun didFetchMil(mil: Boolean) {
        // optional
    }

    override fun isReadyForScan(status: Boolean, isGenric: Boolean) {
        // optional
    }

    override fun didUpdateProgress(progressStatus: String, percent: String) {

        val map = Arguments.createMap()
        map.putString("status", progressStatus)
        map.putString("percent", percent)

        sendEvent("onScanProgress", map)
    }

    override fun didReceivedCode(model: List<DTCResponseModel>?) {

        if (model == null) return

        val codesArray = Arguments.createArray()

        for (module in model) {

            module.removeDuplicateDTCResponses()

            for (item in module.dtcCodeArray) {

                val codeMap = Arguments.createMap()

                codeMap.putString("moduleName", module.moduleName)
                codeMap.putString("code", item.dtcErrorCode)

                codesArray.pushMap(codeMap)
            }
        }

        val result = Arguments.createMap()
        result.putArray("codes", codesArray)

        sendEvent("onDTCReceived", result)

        connectionManager?.getRepairCostSummary(vin, model) { success, json ->

            if (success && json != null) {

                val repairMap = Arguments.createMap()
                repairMap.putString("result", json.toString())

                sendEvent("onRepairCostReceived", repairMap)
            }
        }
    }

    override fun didReceivedRepairCost(jsonString: String) {

        val map = Arguments.createMap()
        map.putString("result", jsonString)

        sendEvent("onRepairCostReceived", map)
    }

    override fun didReadyForRepairInfo(isReady: Boolean) {
        // optional
    }

    override fun didReceiveRepairCost(result: Map<String, Any>?) {

        val map = Arguments.createMap()

        sendEvent("onRepairCostReceived", map)
    }
}