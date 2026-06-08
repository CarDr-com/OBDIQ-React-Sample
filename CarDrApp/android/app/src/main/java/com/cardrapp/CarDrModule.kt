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
    private var dtcErrorArray: List<DTCResponseModel> = emptyList()
    private var isSDKInitialized = false
    private var pendingDeviceScan = false

    override fun getName(): String {
        return "CarDrModule"
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required by NativeEventEmitter.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required by NativeEventEmitter.
    }

    private fun sendEvent(event: String, params: WritableMap?) {
        reactContext.runOnUiQueueThread {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, params)
        }
    }

    // MARK: Initialize SDK

    @ReactMethod
    fun initializeSDK(partnerID: String) {

        isSDKInitialized = false
        pendingDeviceScan = false
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
        if (!isSDKInitialized) {
            pendingDeviceScan = true
            return
        }

        pendingDeviceScan = false
        connectionManager?.scanForDevice()
    }

    // MARK: Start scan

    @ReactMethod
    fun startScan() {
        Log.d("CarDrModule", "Starting scan using SDK auto mode")
        connectionManager?.startScan()
    }

    @ReactMethod
    fun startAdvancedScan() {
        Log.d("CarDrModule", "Starting advanced scan")
        connectionManager?.startAdvancedScan()
    }

    @ReactMethod
    fun startGenericScan() {
        Log.d("CarDrModule", "Starting generic scan")
        connectionManager?.startGenericScan()
    }

    // MARK: Stop scan

    @ReactMethod
    fun stopScan() {
        connectionManager?.disconnectOBD()
    }

    @ReactMethod
    fun getRepairCost(vin: String, dtcCodes: ReadableArray) {
        val dtcModels = matchingDtcResponseModels(dtcCodes)

        Log.d("CarDrModule", "getRepairCost called vin=$vin dtcCount=${dtcModels.size}")
        connectionManager?.getRepairCostSummary(vin, dtcModels) { success, json ->
            Log.d("CarDrModule", "getRepairCost result success=$success json=$json")

            if (success && json != null) {
                val repairMap = Arguments.createMap()
                repairMap.putString("result", json.toString())

                sendEvent("onRepairCostReceived", repairMap)
            }
        }
    }

    private fun matchingDtcResponseModels(dtcCodes: ReadableArray): List<DTCResponseModel> {
        val requestedKeys = mutableSetOf<String>()

        for (index in 0 until dtcCodes.size()) {
            val codeMap = dtcCodes.getMap(index) ?: continue
            val code = codeMap.getString("code") ?: continue

            if (code.isEmpty()) {
                continue
            }

            val moduleName = codeMap.getString("moduleName") ?: ""
            requestedKeys.add("$moduleName|$code")
        }

        if (requestedKeys.isEmpty()) {
            return emptyList()
        }

        return dtcErrorArray.filter { module ->
            module.dtcCodeArray.any { item ->
                requestedKeys.contains("${module.moduleName}|${item.dtcErrorCode}")
            }
        }
    }

    // ============================================================
    // ConnectionListner callbacks (bridge to React Native)
    // ============================================================

    override fun didScanForDevice(startScan: Boolean) {

        isSDKInitialized = startScan

        val map = Arguments.createMap()
        map.putBoolean("status", startScan)

        sendEvent("onBluetoothState", map)

        if (startScan && pendingDeviceScan) {
            pendingDeviceScan = false
            connectionManager?.scanForDevice()
        }
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

        sendVinReceived()
    }

    override fun didFetchMil(mil: Boolean) {
        // optional
    }

    override fun isReadyForScan(status: Boolean, isGenric: Boolean) {
        Log.d("CarDrModule", "Ready for scan: status=$status isGeneric=$isGenric")

        val map = Arguments.createMap()
        map.putBoolean("status", status)
        map.putBoolean("isGeneric", isGenric)

        sendEvent("onReadyForScan", map)
    }

    private fun sendVinReceived() {
        val map = Arguments.createMap()
        map.putString("vin", vin)

        sendEvent("onVINReceived", map)
    }

    override fun didUpdateProgress(progressStatus: String, percent: String) {

        val map = Arguments.createMap()
        map.putString("status", progressStatus)
        map.putString("percent", percent)

        sendEvent("onScanProgress", map)
    }

    override fun didReceivedCode(model: List<DTCResponseModel>?) {

        if (model == null) {
            Log.d("CarDrModule", "DTC response model is null")
            return
        }

        Log.d("CarDrModule", "DTC response modules=${model.size}")
        dtcErrorArray = model

        val codesArray = Arguments.createArray()

        for (module in model) {

            module.removeDuplicateDTCResponses()
            Log.d(
                "CarDrModule",
                "DTC module=${module.moduleName} responseStatus=${module.responseStatus} codes=${module.dtcCodeArray.size}"
            )

            for (item in module.dtcCodeArray) {
                Log.d(
                    "CarDrModule",
                    "DTC code module=${module.moduleName} code=${item.dtcErrorCode} status=${item.status}"
                )

                val codeMap = Arguments.createMap()

                codeMap.putString("moduleName", module.moduleName)
                codeMap.putString("code", item.dtcErrorCode)

                codesArray.pushMap(codeMap)
            }
        }

        val result = Arguments.createMap()
        result.putArray("codes", codesArray)

        sendEvent("onDTCReceived", result)
    }

    override fun didReceivedRepairCost(jsonString: String) {

        val map = Arguments.createMap()
        map.putString("result", jsonString)

        sendEvent("onRepairCostReceived", map)
    }

    override fun didReadyForRepairInfo(isReady: Boolean) {
        val map = Arguments.createMap()
        map.putBoolean("isReady", isReady)

        sendEvent("onReadyForRepairInfo", map)
    }

    override fun didReceiveRepairCost(result: Map<String, Any>?) {
        Log.d("CarDrModule", "didReceiveRepairCost result=$result")

        val map = Arguments.createMap()
        map.putString("result", result?.toString() ?: "")

        sendEvent("onRepairCostReceived", map)
    }
}
